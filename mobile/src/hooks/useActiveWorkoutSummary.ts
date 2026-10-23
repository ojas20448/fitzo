import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { loadActiveWorkoutDraft, subscribeActiveWorkoutDraft, type ActiveWorkoutDraft } from '../utils/activeWorkoutDraft';

export function useActiveWorkoutSummary(userId: string | undefined, pathname: string) {
    const [saved, setSaved] = useState<{ userId: string; draft: ActiveWorkoutDraft | null } | null>(null);
    useEffect(() => {
        let active = true;
        let revision = 0;
        const read = async () => {
            if (!userId) return;
            const request = ++revision;
            try {
                const draft = await loadActiveWorkoutDraft(userId);
                if (active && request === revision) setSaved({ userId, draft });
            } catch { /* A transient read failure must not erase a known draft. */ }
        };
        const unsubscribe = subscribeActiveWorkoutDraft((owner, draft) => {
            if (active && owner === userId) { revision++; setSaved({ userId: owner, draft }); }
        });
        const app = AppState.addEventListener('change', state => { if (state === 'active') void read(); });
        void read();
        return () => { active = false; revision++; unsubscribe(); app.remove(); };
    }, [userId, pathname]);
    const draft = saved?.userId === userId ? saved?.draft : null;
    return { hasActiveWorkout: !!draft?.exercises.length, label: draft?.intent.session_label || null };
}
