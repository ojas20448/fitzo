import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import GlassCard from './GlassCard';
import { colors, typography } from '../styles/theme';
import { isHealthAvailable, requestBackgroundHealthPermission, requestPermissions } from '../services/healthService';
import { syncHealthDays } from '../services/healthSync';
import { isBackgroundSyncAvailable, reconcileHealthBackground } from '../services/healthBackground';
import { disableHealthImport, enableHealthImport, isBackgroundHealthEnabled, isHealthImportEnabled, setBackgroundHealthEnabled } from '../utils/healthImportPreference';

export default function HealthImportSettings({ userId }: { userId?: string }) {
    const [enabled, setEnabled] = useState(false);
    const [background, setBackground] = useState(false);
    const [backgroundAvailable, setBackgroundAvailable] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const mounted = useRef(true);
    const preferenceVersion = useRef(0);
    const available = isHealthAvailable();
    const provider = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
    useEffect(() => {
        mounted.current = true;
        Promise.all([isHealthImportEnabled(userId), isBackgroundHealthEnabled(userId), isBackgroundSyncAvailable()])
            .then(([on, bg, supported]) => { if (mounted.current) { setEnabled(on); setBackground(bg); setBackgroundAvailable(supported); } })
            .catch(() => { if (mounted.current) setMessage('Could not load import settings. Reopen this page to retry.'); })
            .finally(() => { if (mounted.current) setLoading(false); });
        return () => { mounted.current = false; };
    }, [userId]);

    const run = async (days: number, connect = false) => {
        if (!userId || busy) return;
        setBusy(true);
        setMessage(connect ? `Opening ${provider} permissions…` : 'Starting import…');
        try {
            if (connect) {
                const granted = await requestPermissions();
                if (!granted) {
                    if (mounted.current) setMessage(`${provider} connection was not completed.`);
                    return;
                }
                await enableHealthImport(userId);
                if (mounted.current) setEnabled(true);
            }
            const result = await syncHealthDays(userId, { days, onProgress: p => {
                if (mounted.current) setMessage(`Checked ${p.checked} of ${p.total} days…`);
            } });
            if (mounted.current) setMessage(result.imported
                ? `Updated ${result.imported} ${result.imported === 1 ? 'day' : 'days'}. Checked ${result.total} days.`
                : 'No readable data available for this period. You can sync again when new readings are recorded.');
        } catch (error) {
            if (mounted.current) setMessage(`${error instanceof Error ? error.message : 'Import could not finish.'} You can retry; saved days are kept.`);
        } finally { if (mounted.current) setBusy(false); }
    };
    const turnOff = async () => {
        if (!userId) return;
        preferenceVersion.current++;
        try {
            await disableHealthImport(userId);
            setEnabled(false);
            setBackground(false);
            await reconcileHealthBackground();
            setMessage('Imports are off. Previously imported data is kept.');
        } catch { setMessage('Could not finish turning imports off. Please try again.'); }
    };
    const toggleBackground = async (value: boolean) => {
        if (!userId || busy) return;
        const version = preferenceVersion.current;
        setBusy(true);
        try {
            if (value && !await requestBackgroundHealthPermission()) throw new Error('Background access is unavailable or was not allowed.');
            if (preferenceVersion.current !== version || !await isHealthImportEnabled(userId)) throw new Error('Health importing is turned off.');
            await setBackgroundHealthEnabled(userId, value);
            if (preferenceVersion.current !== version) {
                await setBackgroundHealthEnabled(userId, false);
                throw new Error('Health importing is turned off.');
            }
            await reconcileHealthBackground(userId);
            if (mounted.current) { setBackground(value); setMessage(value ? 'Background sync is on. Your phone decides when it runs.' : 'Background sync is off.'); }
        } catch (error) {
            await setBackgroundHealthEnabled(userId, false).catch(() => {});
            if (mounted.current) { setBackground(false); setMessage(error instanceof Error ? error.message : 'Could not enable background sync.'); }
        } finally { if (mounted.current) setBusy(false); }
    };
    const button = (label: string, action: () => void, disabled = busy) => (
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
            style={[styles.button, disabled && styles.disabled]} onPress={action}>
            <Text style={styles.buttonText}>{label}</Text>
        </TouchableOpacity>
    );
    return <View>
        <Text style={styles.heading}>Health & Fitness Data</Text>
        <GlassCard style={styles.card}>
            <Text style={styles.title}>{Platform.OS === 'web' ? 'Health importing' : provider}</Text>
            {busy && <ActivityIndicator accessibilityLabel="Importing health data" />}
            {!!message && <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text>}
            {loading ? <ActivityIndicator accessibilityLabel="Loading health settings" /> : !available ?
                <Text style={styles.detail}>Open Fitzo on a supported iPhone or Android device to import health data. A current native build is required.</Text> : <>
                <Text style={styles.detail}>{enabled ? 'Importing is on for this account.' : 'Import steps, active calories, resting heart rate and sleep to your Fitzo account.'}</Text>
                {!enabled ? button('Continue', () => { void run(2, true); }, busy || !userId) : <>
                    {button('Sync now', () => { void run(2); })}
                    {button('Import last 30 days', () => { void run(30); })}
                    <View style={styles.toggleRow}>
                        <Text style={[styles.buttonText, styles.flex]}>Background sync</Text>
                        <Switch accessibilityLabel="Background health sync" hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }} value={background} disabled={busy || !backgroundAvailable}
                            onValueChange={value => { void toggleBackground(value); }} />
                    </View>
                    <Text style={styles.detail}>{backgroundAvailable
                        ? 'Optional. Imports recent readings when your phone allows it. Sync now checks today and yesterday.'
                        : 'Background sync is unavailable in this build or is restricted by your phone. Sync now still works.'}</Text>
                    {button('Turn off health imports', () => { void turnOff(); }, false)}
                </>}
                <Text style={styles.detail}>Only readable metrics are imported. Sleep counts time asleep within each local calendar day.</Text>
            </>}
        </GlassCard>
    </View>;
}

const styles = StyleSheet.create({
    heading: { fontFamily: typography.fontFamily.semiBold, fontSize: 13, color: colors.text.secondary, marginTop: 24, marginBottom: 12 },
    card: { padding: 16, marginBottom: 12, gap: 12 },
    title: { fontFamily: typography.fontFamily.semiBold, fontSize: 18, color: colors.text.primary },
    detail: { fontFamily: typography.fontFamily.regular, fontSize: 13, color: colors.text.secondary, lineHeight: 20 },
    status: { fontFamily: typography.fontFamily.regular, fontSize: 13, color: colors.text.primary, lineHeight: 20 },
    button: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.text.muted, borderRadius: 12, justifyContent: 'center' },
    buttonText: { fontFamily: typography.fontFamily.medium, fontSize: 14, color: colors.text.primary },
    disabled: { opacity: 0.5 },
    toggleRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
    flex: { flex: 1 },
});
