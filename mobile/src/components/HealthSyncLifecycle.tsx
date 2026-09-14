import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { reconcileHealthBackground } from '../services/healthBackground';
import { syncHealthDays } from '../services/healthSync';
import { isHealthImportEnabled } from '../utils/healthImportPreference';

export default function HealthSyncLifecycle() {
    const { user, isLoading } = useAuth();
    useEffect(() => {
        if (isLoading) return;
        void reconcileHealthBackground(user?.id).catch(() => {});
        const subscription = AppState.addEventListener('change', state => {
            if (state !== 'active' || !user?.id) return;
            void isHealthImportEnabled(user.id).then(enabled => enabled ? syncHealthDays(user.id) : undefined).catch(() => {});
        });
        return () => subscription.remove();
    }, [user?.id, isLoading]);
    return null;
}
