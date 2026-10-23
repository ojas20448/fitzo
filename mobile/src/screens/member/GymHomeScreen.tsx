import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { checkinAPI, gymAPI, memberAPI, settingsAPI, type BusyTimes } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import ConfirmationSheet from '../../components/ConfirmationSheet';
import BusyTimesStrip from '../../components/BusyTimesStrip';
import { useToast } from '../../components/Toast';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';
import { MemberScreen, MemberAction, memberStyles as s } from '../../components/navigation/MemberScreen';

type Gym = { id: string; name: string; capacity?: number };
type GymState = { owner: string; gym: Gym | null; checkedIn: boolean | null; count: number | null; busy: BusyTimes | null };

export default function GymHomeScreen() {
    const { user, refreshUser } = useAuth();
    const toast = useToast();
    const [saved, setSaved] = useState<GymState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [leaveOpen, setLeaveOpen] = useState(false);
    const [leaveError, setLeaveError] = useState('');
    const request = useRef(0);
    const mutation = useRef(false);
    const owner = useRef(user?.id); owner.current = user?.id;
    const load = useCallback(async () => {
        const id = ++request.current;
        if (!user?.id) { setLoading(false); return; }
        setLoading(true); setError(false);
        try {
            const response = await settingsAPI.getGym();
            if (id !== request.current) return;
            const gym: Gym | null = response.gym || null;
            setSaved({ owner: user.id, gym, checkedIn: null, count: null, busy: null });
            if (gym) {
                const [status, home, times] = await Promise.allSettled([checkinAPI.getStatus(), memberAPI.getHome(), gymAPI.getBusyTimes(gym.id)]);
                if (id !== request.current) return;
                setSaved({ owner: user.id, gym,
                    checkedIn: status.status === 'fulfilled' ? !!status.value.checked_in && status.value.gym_id === gym.id : null,
                    count: home.status === 'fulfilled' && home.value.gym?.name === gym.name && Number.isFinite(home.value.crowd?.count) ? home.value.crowd.count : null,
                    busy: times.status === 'fulfilled' ? times.value.busy_times : null,
                });
            }
        } catch { if (id === request.current) setError(true); }
        finally { if (id === request.current) setLoading(false); }
    }, [user?.id]);
    useFocusEffect(useCallback(() => { setCode(''); setLeaveOpen(false); setLeaveError(''); void load(); return () => { request.current++; }; }, [load]));
    const data = saved?.owner === user?.id ? saved : null;
    const run = async (action: () => Promise<unknown>, message: string) => {
        if (mutation.current || !user?.id || owner.current !== user.id) return false;
        const account = user.id;
        mutation.current = true; setBusy(true);
        try {
            await action();
            if (owner.current !== account) return false;
            setCode(''); toast.success(message); await refreshUser();
            if (owner.current === account) await load();
            return true;
        } catch (e: any) { if (owner.current === account) toast.error('Could not update gym', e?.message || 'Please try again'); return false; }
        finally { mutation.current = false; setBusy(false); }
    };
    return <MemberScreen title="My gym" subtitle="YOUR SPACE" refreshing={loading && !!data} onRefresh={() => void load()}>
        {loading && !data ? <ActivityIndicator accessibilityLabel="Loading your gym" color={colors.primary} /> : null}
        {error ? <EmptyState variant="error" title="Could not load your gym" onAction={() => void load()} /> : null}
        {data && !data.gym && <GlassCard style={s.card}>
            <View style={styles.gymIcon}><Ionicons name="business-outline" size={30} color={colors.text.primary} /></View><Text style={styles.gymName}>Join your gym</Text>
            <Text style={s.detail}>Connect your gym for check-ins, attendance and classes.</Text>
            <Button title="Scan gym QR code" variant="secondary" icon={<Ionicons name="qr-code-outline" size={20} color={colors.text.primary} />} disabled={busy} onPress={() => router.push({ pathname: '/qr-checkin', params: { mode: 'join' } })} fullWidth />
            <View style={styles.joinField}><Text style={styles.fieldLabel}>Gym access code</Text><TextInput style={[s.input, styles.codeInput]} value={code} onChangeText={setCode} placeholder="Enter your code" placeholderTextColor={colors.text.muted} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Gym access code" editable={!busy} returnKeyType="done" onSubmitEditing={() => { if (code.trim() && !busy) void run(() => settingsAPI.joinGym(code.trim().toUpperCase()), 'Gym joined'); }} /></View>
            <Button title="Join gym" loading={busy} disabled={!code.trim() || busy} onPress={() => void run(() => settingsAPI.joinGym(code.trim().toUpperCase()), 'Gym joined')} fullWidth />
            <Text style={styles.footnote}>Scan the QR code at your gym or ask for its access code. You can use workouts and food without joining.</Text>
        </GlassCard>}
        {data?.gym && <>
            <GlassCard style={s.card}>
                <View style={s.row}><View style={styles.gymIcon}><Ionicons name="business-outline" size={26} color={colors.text.primary} /></View><View style={styles.status}><Ionicons name={data.checkedIn ? 'checkmark-circle-outline' : 'ellipse-outline'} size={15} color={colors.text.secondary} /><Text style={styles.statusText}>{data.checkedIn === null ? loading ? 'Checking status…' : 'Status unavailable' : data.checkedIn ? 'Checked in' : 'Not checked in'}</Text></View></View>
                <Text style={styles.gymName}>{data.gym.name}</Text>
                <Text style={s.detail}>{data.checkedIn === null ? 'Your gym is connected.' : data.checkedIn ? 'You’re checked in. Check out when you finish training.' : 'Scan your gym’s QR code when you arrive.'}</Text>
                {data.checkedIn === null ? <Text style={s.detail}>Check-in status unavailable. Refresh before checking in again.</Text>
                    : <Button title={data.checkedIn ? 'Check out' : 'Check in'} icon={<Ionicons name={data.checkedIn ? 'exit-outline' : 'qr-code-outline'} size={20} color={colors.text.dark} />} loading={busy} disabled={busy} fullWidth onPress={() => data.checkedIn ? void run(() => checkinAPI.checkout(), 'Checked out') : router.push('/qr-checkin')} />}
            </GlassCard>
            <View style={styles.section}><Text style={s.section}>At the gym</Text><GlassCard style={s.card}>
                <View style={s.row}><Text style={s.title}>Recorded attendance</Text><Ionicons name="people-outline" size={22} color={colors.text.secondary} /></View>
                {data.count === null ? <Text style={s.detail}>Attendance is unavailable. Pull to refresh.</Text> : <View style={styles.attendance}><Text style={styles.count}>{data.count}</Text><Text style={s.detail}>app check-ins</Text></View>}
                <Text style={styles.footnote}>Based on app check-ins. This may not include everyone at the gym.</Text>
            </GlassCard></View>
            {data.busy && <GlassCard style={s.card}><Text style={s.title}>Popular times</Text><BusyTimesStrip grid={data.busy.grid} quietest={data.busy.quietest} confidence={data.busy.confidence} /><Text style={styles.footnote}>Based on recorded app attendance.</Text></GlassCard>}
            <GlassCard><MemberAction icon="calendar-outline" title="Classes & bookings" detail="See scheduled classes at your gym" onPress={() => router.push('/classes')} /><MemberAction icon="people-outline" title="Friends" detail="Find people you train with" onPress={() => router.navigate('/(tabs)/buddies')} /></GlassCard>
            <Button title="Leave gym" variant="ghost" disabled={busy} onPress={() => { setLeaveError(''); setLeaveOpen(true); }} />
        </>}
        <ConfirmationSheet busy={busy} action={leaveOpen && data?.gym ? {
            title: `Leave ${data.gym.name}?`, message: `${leaveError ? leaveError + '\n\n' : ''}Your workout and food history will stay with your account. You can rejoin with the gym access code.`,
            confirmLabel: 'Leave gym', destructive: true,
            onConfirm: async () => {
                if (mutation.current) return;
                setLeaveError('');
                if (await run(() => settingsAPI.leaveGym(), 'Gym connection removed')) setLeaveOpen(false);
                else if (owner.current === user?.id) setLeaveError('Could not leave the gym. Please try again.');
            },
        } : null} onCancel={() => { if (!busy) { setLeaveOpen(false); setLeaveError(''); } }} />
    </MemberScreen>;
}
const styles = StyleSheet.create({
    gymIcon: { width: 56, height: 56, borderRadius: borderRadius.lg, backgroundColor: colors.glass.surfaceLight, alignItems: 'center', justifyContent: 'center' },
    gymName: { color: colors.text.primary, fontFamily: typography.fontFamily.semiBold, fontSize: 25, letterSpacing: -0.6, lineHeight: 33 },
    status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.full, flexShrink: 1 },
    statusText: { color: colors.text.secondary, fontFamily: typography.fontFamily.medium, fontSize: 11, flexShrink: 1 },
    fieldLabel: { color: colors.text.secondary, fontFamily: typography.fontFamily.medium, fontSize: 12 },
    joinField: { gap: spacing.sm, marginTop: spacing.sm },
    codeInput: { minHeight: 54 },
    footnote: { color: colors.text.muted, fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 19 },
    section: { gap: spacing.md },
    attendance: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm },
    count: { color: colors.text.primary, fontFamily: typography.fontFamily.semiBold, fontSize: 34, letterSpacing: -1 },
});
