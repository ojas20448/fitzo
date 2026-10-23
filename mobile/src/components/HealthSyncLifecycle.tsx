import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { reconcileHealthBackground } from '../services/healthBackground';
import { syncHealthDays } from '../services/healthSync';
import { subscribeToHealthChanges } from '../services/healthService';
import { isHealthImportEnabled } from '../utils/healthImportPreference';

export default function HealthSyncLifecycle() {
    const { user, isLoading } = useAuth();
    useEffect(() => {
        if (isLoading) return;
        void reconcileHealthBackground(user?.id).catch(() => {});
        if (!user?.id) return;
        const userId = user.id;
        let alive = true;
        let active = AppState.currentState === 'active';
        let running = false;
        let pending = false;
        let stopObserving: (() => void) | undefined;
        let timer: ReturnType<typeof setInterval> | undefined;
        const shouldContinue = async () => {
            const enabled = await isHealthImportEnabled(userId);
            return alive && active && enabled;
        };
        const refresh = async () => {
            if (!alive || !active) return;
            if (running) { pending = true; return; }
            running = true;
            try {
                if (!await shouldContinue()) {
                    stopObserving?.();
                    stopObserving = undefined;
                    return;
                }
                if (!stopObserving) stopObserving = subscribeToHealthChanges(() => { void refresh(); });
                await syncHealthDays(userId, { shouldContinue });
            } catch { /* Sync status records failures; the next refresh retries. */ }
            finally {
                running = false;
                if (pending) { pending = false; void refresh(); }
            }
        };
        const start = () => {
            if (!timer) timer = setInterval(() => { void refresh(); }, 30000);
            void refresh();
        };
        const stop = () => {
            if (timer) clearInterval(timer);
            timer = undefined;
            stopObserving?.();
            stopObserving = undefined;
            pending = false;
        };
        if (active) start();
        const subscription = AppState.addEventListener('change', state => {
            const nextActive = state === 'active';
            if (active === nextActive) return;
            active = nextActive;
            if (active) start();
            else stop();
        });
        return () => { alive = false; stop(); subscription.remove(); };
    }, [user?.id, isLoading]);
    return null;
}
