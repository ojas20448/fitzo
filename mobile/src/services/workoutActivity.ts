import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { ActiveWorkoutDraft } from '../utils/activeWorkoutDraft';

export interface WorkoutActivitySnapshot {
    sessionId: string;
    title: string;
    currentExercise: string;
    startedAtMs: number;
    completedSets: number;
    totalSets: number;
}

interface NativeWorkoutActivity {
    sync(snapshot: WorkoutActivitySnapshot): Promise<boolean>;
    stop(): Promise<void>;
}

export function workoutActivitySnapshot(userId: string, draft: ActiveWorkoutDraft | null): WorkoutActivitySnapshot | null {
    if (!draft?.exercises.length) return null;
    const startedAtMs = Date.parse(draft.startedAt);
    if (!Number.isFinite(startedAtMs)) return null;
    const sets = draft.exercises.flatMap(exercise => exercise.sets);
    const current = draft.exercises.find(exercise => exercise.sets.some(set => !set.completed)) ?? draft.exercises[draft.exercises.length - 1];
    return {
        sessionId: `${userId}:${draft.startedAt}`,
        title: draft.intent.session_label || 'Workout',
        currentExercise: current.name,
        startedAtMs,
        completedSets: sets.filter(set => set.completed).length,
        totalSets: sets.length,
    };
}

let queue: Promise<void> = Promise.resolve();
let revision = 0;
const promptedSessions = new Set<string>();

/** Native timers keep counting without background JS, a network call, or a service polling loop. */
export function syncWorkoutActivity(userId: string, draft: ActiveWorkoutDraft | null, requestPermission = false): Promise<void> {
    const snapshot = workoutActivitySnapshot(userId, draft);
    const ticket = ++revision;
    queue = queue.catch(() => {}).then(async () => {
        if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
        const native = requireOptionalNativeModule<NativeWorkoutActivity>('FitzoWorkoutActivity');
        // Existing installed builds and Expo Go keep working until rebuilt with this module.
        if (!native) return;
        if (!snapshot) { await native.stop(); return; }
        if (ticket !== revision) return;
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('workout-active', {
                name: 'Active workout', importance: Notifications.AndroidImportance.LOW,
                sound: null, enableVibrate: false, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
            });
            let permission = await Notifications.getPermissionsAsync();
            if (!permission.granted && permission.canAskAgain && requestPermission
                && AppState.currentState === 'active' && !promptedSessions.has(snapshot.sessionId)) {
                promptedSessions.add(snapshot.sessionId);
                permission = await Notifications.requestPermissionsAsync();
            }
            if (!permission.granted) return;
        }
        // Finishing/signing out while an OS permission dialog is open must win.
        if (ticket === revision) await native.sync(snapshot);
    });
    return queue;
}
