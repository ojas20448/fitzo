import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HealthSyncStatus, healthSyncStatusText, readHealthSyncStatus, subscribeHealthSyncStatus } from '../utils/healthSyncStatus';
import { colors, typography } from '../styles/theme';

export default function HealthSyncStatusDetails({ userId }: { userId?: string }) {
    const [status, setStatus] = useState<HealthSyncStatus>({});
    const [storageError, setStorageError] = useState(false);
    useEffect(() => {
        let active = true;
        let updated = false;
        setStatus({});
        setStorageError(false);
        const unsubscribe = userId ? subscribeHealthSyncStatus(userId, next => {
            updated = true;
            if (active) { setStatus(next); setStorageError(false); }
        }) : () => {};
        readHealthSyncStatus(userId).then(next => { if (active && !updated) setStatus(next); })
            .catch(() => { if (active && !updated) setStorageError(true); });
        return () => { active = false; unsubscribe(); };
    }, [userId]);
    const timestamp = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return <View style={styles.container}>
        <Text accessibilityLiveRegion="polite" style={styles.text}>{storageError ? 'Import history on this device is unavailable. Sync now to check for updates.' : healthSyncStatusText(status)}</Text>
        {status.lastCheckedAt && <Text style={styles.detail}>Last check on this device: {timestamp(status.lastCheckedAt)}</Text>}
        {status.lastImportedAt && <Text style={styles.detail}>Last saved import: {timestamp(status.lastImportedAt)}</Text>}
    </View>;
}
const styles = StyleSheet.create({
    container: { gap: 6 },
    text: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20 },
    detail: { color: colors.text.muted, fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 18 },
});
