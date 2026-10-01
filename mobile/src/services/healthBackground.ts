import { Platform } from 'react-native';
import { authAPI, getAuthToken } from './api';
import { canReadHealthInBackground } from './healthService';
import { syncHealthDays } from './healthSync';
import { isBackgroundHealthEnabled } from '../utils/healthImportPreference';

const TASK_NAME = 'fitzo-health-sync';
type Background = typeof import('expo-background-task');
type Tasks = typeof import('expo-task-manager');
let background: Background | undefined;
let tasks: Tasks | undefined;
// Old installed builds and web must remain usable until a native rebuild ships.
if (Platform.OS !== 'web') {
    try {
        background = require('expo-background-task');
        tasks = require('expo-task-manager');
    } catch { /* Native modules unavailable in this build. */ }
}

export async function runBackgroundHealthSync(): Promise<void> {
    if (!await getAuthToken() || !await canReadHealthInBackground()) return;
    const account = await authAPI.getMe();
    const userId = account?.user?.id;
    if (!userId || !await isBackgroundHealthEnabled(userId)) return;
    let expired = false;
    const expiration = background?.addExpirationListener(() => { expired = true; });
    try {
        await syncHealthDays(userId, {
            days: 2,
            shouldContinue: async () => !expired && await isBackgroundHealthEnabled(userId) && await canReadHealthInBackground(),
        });
    } finally { expiration?.remove(); }
}

// Imported by the root layout, so the scheduler can invoke this without a screen.
if (tasks && background && !tasks.isTaskDefined(TASK_NAME)) {
    tasks.defineTask(TASK_NAME, async () => {
        try {
            await runBackgroundHealthSync();
            return background!.BackgroundTaskResult.Success;
        } catch { return background!.BackgroundTaskResult.Failed; }
    });
}

export async function isBackgroundSyncAvailable(): Promise<boolean> {
    try {
        return Boolean(background && tasks && await tasks.isAvailableAsync() &&
            await background.getStatusAsync() === background.BackgroundTaskStatus.Available);
    } catch { return false; }
}

let registration = Promise.resolve();
export function reconcileHealthBackground(userId?: string): Promise<void> {
    registration = registration.catch(() => {}).then(async () => {
        if (!background || !tasks || !await isBackgroundSyncAvailable()) return;
        const enabled = await isBackgroundHealthEnabled(userId);
        const registered = await tasks.isTaskRegisteredAsync(TASK_NAME);
        if (enabled && !registered) await background.registerTaskAsync(TASK_NAME, { minimumInterval: 60 });
        if (!enabled && registered) await background.unregisterTaskAsync(TASK_NAME);
    });
    return registration;
}
