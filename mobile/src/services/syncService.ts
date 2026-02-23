/**
 * Offline Sync Service
 *
 * Processes the pending write queue when connectivity returns.
 * Handles retries, conflict resolution, and queue draining.
 *
 * Usage:
 *   - Call `processSyncQueue()` when app comes online
 *   - Call `processSyncQueue()` on app foreground (AppState listener)
 *   - The service processes actions FIFO and stops on auth errors
 */

import { useOfflineStore } from '../stores/offlineStore';
import { workoutsAPI, caloriesAPI, intentAPI, postsAPI } from './api';

type PendingActionType = 'LOG_WORKOUT' | 'LOG_CALORIES' | 'SET_INTENT' | 'CREATE_POST' | 'ADD_COMMENT';

const MAX_RETRIES = 5;

/**
 * Map action types to their API calls
 */
async function executeAction(type: PendingActionType, payload: any): Promise<any> {
    switch (type) {
        case 'LOG_WORKOUT':
            return workoutsAPI.log(payload);

        case 'LOG_CALORIES':
            return caloriesAPI.log(payload);

        case 'SET_INTENT':
            return intentAPI.setIntent(payload);

        case 'CREATE_POST':
            return postsAPI.create(payload);

        case 'ADD_COMMENT':
            return postsAPI.addComment(payload.postId, payload.comment);

        default:
            throw new Error(`Unknown action type: ${type}`);
    }
}

/**
 * Process all pending actions in the queue
 * Returns a summary of sync results
 */
export async function processSyncQueue(): Promise<{
    synced: number;
    failed: number;
    remaining: number;
}> {
    const store = useOfflineStore.getState();

    // Don't run if already syncing or offline
    if (store.isSyncing || !store.isOnline) {
        return { synced: 0, failed: 0, remaining: store.getPendingCount() };
    }

    const pending = store.getPendingActions();
    if (pending.length === 0) {
        return { synced: 0, failed: 0, remaining: 0 };
    }

    store.setSyncing(true);
    let synced = 0;
    let failed = 0;

    for (const action of pending) {
        // Skip actions that have exceeded max retries
        if (action.retryCount >= MAX_RETRIES) {
            failed++;
            continue;
        }

        try {
            await executeAction(action.type, action.payload);
            store.dequeueAction(action.id);
            synced++;
        } catch (error: any) {
            // If it's an auth error (401), stop syncing — user needs to re-login
            if (error.status === 401) {
                break;
            }

            // If it's a conflict (409), the action was already applied — remove it
            if (error.status === 409) {
                store.dequeueAction(action.id);
                synced++;
                continue;
            }

            // If it's a network error, stop syncing — we're offline again
            if (error.code === 'NETWORK_ERROR') {
                store.setOnline(false);
                break;
            }

            // For other errors, mark as failed and continue
            store.markActionFailed(action.id, error.message || 'Unknown error');
            failed++;
        }
    }

    // Clean up actions that exceeded max retries
    store.clearFailedActions();
    store.setSyncing(false);

    const remaining = store.getPendingCount();

    return { synced, failed, remaining };
}

/**
 * Queue a workout log for offline sync
 * Returns the queued action ID
 */
export function queueWorkoutLog(data: {
    workout_type: string;
    exercises?: string;
    notes?: string;
    visibility?: string;
}): string {
    return useOfflineStore.getState().queueAction('LOG_WORKOUT', data);
}

/**
 * Queue a calorie log for offline sync
 */
export function queueCalorieLog(data: {
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    meal_name?: string;
    visibility?: string;
}): string {
    return useOfflineStore.getState().queueAction('LOG_CALORIES', data);
}

/**
 * Queue an intent for offline sync
 */
export function queueIntent(data: {
    training_pattern?: string | null;
    emphasis: string[];
    session_label?: string | null;
    visibility?: string;
    note?: string;
}): string {
    return useOfflineStore.getState().queueAction('SET_INTENT', data);
}

/**
 * Smart log: try online first, fall back to queue if offline
 */
export async function smartLogWorkout(data: {
    workout_type: string;
    exercises?: string;
    notes?: string;
    visibility?: string;
}): Promise<{ success: boolean; offline: boolean; actionId?: string; data?: any }> {
    const { isOnline } = useOfflineStore.getState();

    if (isOnline) {
        try {
            const result = await workoutsAPI.log(data);
            return { success: true, offline: false, data: result };
        } catch (error: any) {
            if (error.code === 'NETWORK_ERROR') {
                // Fall through to offline queue
                useOfflineStore.getState().setOnline(false);
            } else {
                throw error;
            }
        }
    }

    // Queue for later sync
    const actionId = queueWorkoutLog(data);
    return { success: true, offline: true, actionId };
}

/**
 * Smart log: try online first, fall back to queue if offline
 */
export async function smartLogCalories(data: {
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    meal_name?: string;
    visibility?: string;
}): Promise<{ success: boolean; offline: boolean; actionId?: string; data?: any }> {
    const { isOnline } = useOfflineStore.getState();

    if (isOnline) {
        try {
            const result = await caloriesAPI.log(data);
            return { success: true, offline: false, data: result };
        } catch (error: any) {
            if (error.code === 'NETWORK_ERROR') {
                useOfflineStore.getState().setOnline(false);
            } else {
                throw error;
            }
        }
    }

    const actionId = queueCalorieLog(data);
    return { success: true, offline: true, actionId };
}
