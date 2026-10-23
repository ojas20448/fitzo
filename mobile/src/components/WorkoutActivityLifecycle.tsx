import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { loadActiveWorkoutDraft, subscribeActiveWorkoutDraft } from '../utils/activeWorkoutDraft';
import { syncWorkoutActivity } from '../services/workoutActivity';

export default function WorkoutActivityLifecycle() {
    const { user, isLoading } = useAuth();
    useEffect(() => {
        if (isLoading) return;
        const userId = user?.id;
        if (!userId) { void syncWorkoutActivity('', null).catch(() => {}); return; }
        let alive = true;
        let revision = 0;
        const refresh = async () => {
            const ticket = ++revision;
            try {
                const draft = await loadActiveWorkoutDraft(userId);
                if (alive && ticket === revision) await syncWorkoutActivity(userId, draft);
            } catch { /* A storage failure must not end an ongoing, recoverable session. */ }
        };
        const unsubscribe = subscribeActiveWorkoutDraft((owner, draft) => {
            if (!alive || owner !== userId) return;
            revision++;
            void syncWorkoutActivity(userId, draft, true).catch(() => {});
        });
        void refresh();
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
        return () => {
            alive = false;
            unsubscribe();
            subscription.remove();
            void syncWorkoutActivity('', null).catch(() => {});
        };
    }, [user?.id, isLoading]);
    return null;
}
