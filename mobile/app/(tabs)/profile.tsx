import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Modal,
    Pressable,
    TextInput,
    Linking,
    Platform,
    Keyboard,
    KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { memberAPI, caloriesAPI, nutritionAPI, measurementsAPI, CalorieEntry, WeekSummary } from '../../src/services/api';
import FoodEntrySheet from '../../src/components/FoodEntrySheet';
import AIConsentModal, { getAIConsent } from '../../src/components/AIConsentModal';
import WeeklyNutritionCard from '../../src/components/WeeklyNutritionCard';
import Avatar from '../../src/components/Avatar';
import AvatarPicker from '../../src/components/AvatarPicker';
import GlassCard from '../../src/components/GlassCard';
import Button from '../../src/components/Button';
import WorkoutCalendar from '../../src/components/WorkoutCalendar';
import Skeleton, { SkeletonCard } from '../../src/components/Skeleton';
import { useToast } from '../../src/components/Toast';
import { colors, typography, spacing, borderRadius } from '../../src/styles/theme';
import { displayName } from '../../src/utils/displayName';
import { useMemberContentInset } from '../../src/components/navigation/MemberChromeContext';
import { useMemberTabScroll } from '../../src/hooks/useMemberTabScroll';

export default function ProfileScreen() {
    const contentInset = useMemberContentInset();
    const onScroll = useMemberTabScroll();
    const { user, logout, refreshUser } = useAuth();
    const toast = useToast();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        streak: 0,
        history: [] as string[],
        foodHistory: [] as string[],
        calories: { total_calories: 0, entry_count: 0 },
        profile: null as any,
        latestMeasurement: null as any
    });
    const [weekSummary, setWeekSummary] = useState<WeekSummary | null>(null);
    const [dayView, setDayView] = useState<{ date: string; entries: CalorieEntry[] } | null>(null);
    const [openEntry, setOpenEntry] = useState<CalorieEntry | null>(null);
    const [aiConsentGranted, setAiConsentGranted] = useState(false);
    const [aiModalVisible, setAiModalVisible] = useState(false);

    // Tapping a calendar dot opens that day's food. Failures show an empty day
    // rather than nothing at all, so a tap always produces a visible response.
    const openDay = useCallback((date: string) => {
        caloriesAPI.getDay(date)
            .then((r) => setDayView({ date, entries: r.entries || [] }))
            .catch(() => setDayView({ date, entries: [] }));
    }, []);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editAvatar, setEditAvatar] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [editError, setEditError] = useState('');
    const [nameFocused, setNameFocused] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const profileSaving = useRef(false);
    const profileChanged = editName.trim() !== (user?.name || '').trim() || editAvatar !== (user?.avatar_url || null);

    useFocusEffect(
        useCallback(() => {
            loadData();
            let active = true;
            getAIConsent().then((granted) => { if (active) setAiConsentGranted(granted); });
            return () => { active = false; };
        }, [])
    );

    const loadData = async () => {
        try {
            const [homeRes, caloriesRes, profileRes, measurementsRes, calHistoryRes, weeklyRes] = await Promise.all([
                memberAPI.getHome(),
                caloriesAPI.getToday().catch(() => ({ totals: { calories: 0, entry_count: 0 } })),
                nutritionAPI.getProfile().catch(() => ({ profile: null })),
                measurementsAPI.getLatest().catch(() => ({ measurement: null })),
                caloriesAPI.getHistory(30).catch(() => ({ history: [] })),
                nutritionAPI.getWeekly().catch(() => ({ history: [], summary: null }))
            ]);

            // ?? null because the .catch path yields null, but a malformed
            // success response could omit `summary` entirely.
            setWeekSummary(weeklyRes.summary ?? null);

            // Extract unique dates from calorie entries.
            //
            // logged_date is already a 'YYYY-MM-DD' day, stamped server-side in
            // IST. Take its leading 10 characters rather than round-tripping it
            // through `new Date(...).toISOString()`: that parses the date at the
            // device's local midnight and re-serialises in UTC, which shifts the
            // day by one for any device east of UTC — including IST, the very
            // timezone this feature standardises on. The dot would then point at
            // the wrong day and open an empty sheet.
            const foodDates = calHistoryRes.history
                ? [...new Set(calHistoryRes.history.map((entry: any) => {
                    if (typeof entry.logged_date === 'string') {
                        return entry.logged_date.slice(0, 10);
                    }
                    // Fallback only: created_at is a timestamp, so it genuinely
                    // needs converting, and there is no better source here.
                    return entry.created_at
                        ? new Date(entry.created_at).toISOString().slice(0, 10)
                        : null;
                }).filter(Boolean))] as string[]
                : [];

            setStats({
                streak: homeRes.streak.current,
                history: homeRes.streak.history || [],
                foodHistory: foodDates,
                calories: {
                    total_calories: caloriesRes.totals?.calories || 0,
                    entry_count: caloriesRes.totals?.entry_count || 0,
                },
                profile: profileRes.profile,
                latestMeasurement: measurementsRes.measurement
            });
        } catch (error) {
            console.error('Failed to load profile data:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleEditOpen = () => {
        setEditName(user?.name || '');
        setEditAvatar(user?.avatar_url || null);
        setEditError(''); setConfirmDiscard(false); setNameFocused(false);
        setIsEditing(true);
    };

    const closeEditor = () => {
        if (profileSaving.current) return;
        Keyboard.dismiss();
        if (profileChanged) setConfirmDiscard(true);
        else setIsEditing(false);
    };

    const handleUpdateProfile = async () => {
        if (profileSaving.current) return;
        const name = editName.trim();
        if (!name || name.length > 100) { setEditError('Enter a display name between 1 and 100 characters.'); return; }
        if (!profileChanged) return;
        Keyboard.dismiss(); profileSaving.current = true; setSaving(true); setEditError('');
        try {
            await memberAPI.updateProfile({
                name,
                avatar_url: editAvatar
            });

            // Refresh both the home data AND the AuthContext user state
            await Promise.all([loadData(), refreshUser()]);

            setIsEditing(false);
            toast.success('Profile updated', 'Your changes have been saved');
        } catch (error: any) {
            setEditError(error?.message || 'Couldn’t save your profile. Your changes are still here. Try again.');
        } finally {
            profileSaving.current = false;
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>PROFILE</Text>
                        <View style={styles.headerDot} />
                        <Text style={styles.headerSubtitle}>YOU</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.settingsBtn}
                        onPress={() => router.push('/member/settings' as any)}
                        accessibilityRole="button"
                        accessibilityLabel="Open settings"
                    >
                        <MaterialIcons name="settings" size={20} color={colors.text.muted} />
                    </TouchableOpacity>
                </View>
                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                    <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
                        <Skeleton width={100} height={100} borderRadius={50} />
                        <Skeleton width={150} height={24} style={{ marginTop: spacing.md }} />
                        <Skeleton width={200} height={16} style={{ marginTop: spacing.sm }} />
                    </View>
                    <View style={styles.statsRow}>
                        <SkeletonCard style={{ flex: 1 }} />
                        <SkeletonCard style={{ flex: 1 }} />
                    </View>
                    <SkeletonCard style={{ marginBottom: spacing.xl }} />
                    <SkeletonCard />
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>PROFILE</Text>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerSubtitle}>YOU</Text>
                </View>
                <View style={styles.headerRightActions}>
                    <TouchableOpacity
                        onPress={() => router.push('/member/add-buddy?tab=code' as any)}
                        accessibilityRole="button"
                        accessibilityLabel="My QR code and invite"
                    >
                        <GlassCard style={styles.settingsBtn}>
                            <MaterialIcons name="qr-code-2" size={20} color={colors.text.primary} />
                        </GlassCard>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleEditOpen} accessibilityRole="button" accessibilityLabel="Edit profile">
                        <GlassCard style={styles.settingsBtn}>
                            <MaterialIcons name="edit" size={20} color={colors.text.primary} />
                        </GlassCard>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: contentInset }]}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Identity Hero Section */}
                <View style={styles.identityHero}>
                    <View style={styles.avatarContainer}>
                        <Avatar uri={user?.avatar_url} size="xl" />
                    </View>

                    <Text style={styles.userName}>{displayName(user)}</Text>

                    {/* Quick Status Badges */}
                    <View style={styles.badgeRow}>
                        <View style={styles.statusBadge}>
                            <MaterialIcons name="local-fire-department" size={16} color={colors.primary} />
                            <Text style={styles.statusBadgeText}>{stats.streak} Day Streak</Text>
                        </View>
                        {user?.gym_name && (
                            <View style={styles.statusBadge}>
                                <MaterialIcons name="business" size={16} color={colors.crowd.medium} />
                                <Text style={styles.statusBadgeText}>{user.gym_name}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <GlassCard style={{ marginBottom: spacing.xl }}>
                    <TouchableOpacity
                        style={styles.settingItem}
                        onPress={() => setAiModalVisible(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`AI Data Sharing & Privacy, ${aiConsentGranted ? 'enabled' : 'disabled'}`}
                        accessibilityHint="Review or change consent for AI features"
                    >
                        <MaterialIcons name="auto-awesome" size={24} color={aiConsentGranted ? colors.primary : colors.text.secondary} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingLabel}>AI Data Sharing & Privacy</Text>
                            <Text style={styles.settingSubtext}>
                                {aiConsentGranted ? 'Enabled · Tap to review or turn off' : 'Disabled · Enable here or when you use AI'}
                            </Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                    </TouchableOpacity>
                </GlassCard>

                <GlassCard style={{ marginBottom: spacing.xl }}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Progress" style={styles.settingItem} onPress={() => router.push('/stats' as any)}>
                        <MaterialIcons name="bar-chart" size={24} color={colors.text.secondary} /><Text style={styles.settingLabel}>Progress</Text><MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                    </TouchableOpacity>
                    <View style={styles.settingDivider} />
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Learn" style={styles.settingItem} onPress={() => router.push('/member/learn' as any)}>
                        <MaterialIcons name="menu-book" size={24} color={colors.text.secondary} /><Text style={styles.settingLabel}>Learn</Text><MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                    </TouchableOpacity>
                    <View style={styles.settingDivider} />
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Your gym" style={styles.settingItem} onPress={() => router.navigate('/(tabs)/gym' as any)}>
                        <MaterialIcons name="business" size={24} color={colors.text.secondary} /><Text style={styles.settingLabel}>Your gym</Text><MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                    </TouchableOpacity>
                </GlassCard>

                {/* Monthly Progress */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Activity History</Text>
                    <WeeklyNutritionCard
                        summary={weekSummary}
                        onPress={() => router.push('/member/nutrition-insights' as any)}
                    />

                    <WorkoutCalendar
                        history={stats.history}
                        foodHistory={stats.foodHistory}
                        onDayPress={openDay}
                    />
                </View>

                {/* Biometrics & Health Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Health & Biometrics</Text>
                    <GlassCard style={styles.biometricsCard}>
                        <View style={styles.biometricsHeader}>
                            <View style={styles.biometricStat}>
                                <Text style={styles.biometricValue}>
                                    {stats.profile?.height_cm && stats.profile?.weight_kg
                                        ? (stats.profile.weight_kg / Math.pow(stats.profile.height_cm / 100, 2)).toFixed(1)
                                        : '—'
                                    }
                                </Text>
                                <Text style={styles.biometricLabel}>BMI</Text>
                            </View>
                            <View style={styles.biometricDivider} />
                            <View style={styles.biometricStat}>
                                <Text style={styles.biometricValue}>
                                    {stats.profile?.target_calories || '—'}
                                </Text>
                                <Text style={styles.biometricLabel}>MAINTENANCE</Text>
                            </View>
                            <View style={styles.biometricDivider} />
                            <View style={styles.biometricStat}>
                                <Text style={styles.biometricValue}>
                                    {stats.latestMeasurement?.weight || stats.profile?.weight_kg || '—'}
                                    <Text style={styles.biometricUnit}>kg</Text>
                                </Text>
                                <Text style={styles.biometricLabel}>WEIGHT</Text>
                            </View>
                        </View>

                        <View style={styles.settingDivider} />

                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => router.push('/member/fitness-profile' as any)}
                        >
                            <MaterialIcons name="calculate" size={24} color={colors.text.secondary} />
                            <Text style={styles.settingLabel}>Calculator & Goal Settings</Text>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>
                        <View style={styles.settingDivider} />
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => router.push('/member/measurements' as any)}
                        >
                            <MaterialIcons name="straighten" size={24} color={colors.text.secondary} />
                            <Text style={styles.settingLabel}>Body Measurements</Text>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>
                        <View style={styles.settingDivider} />
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => router.push('/member/health-report' as any)}
                        >
                            <MaterialIcons name="favorite" size={24} color={colors.accent.rose} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.settingLabel}>
                                    {Platform.OS === 'ios' ? 'Health Report (Apple Health)' : 'Health Report'}
                                </Text>
                                <Text style={styles.settingSubtext}>
                                    {Platform.OS === 'ios' ? 'Steps, calories, sleep & heart rate via HealthKit' : 'Activity, sleep & recovery summary'}
                                </Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>
                    </GlassCard>
                </View>


                {/* Settings & Other Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <GlassCard style={styles.settingsCard}>
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => router.push('/member/settings' as any)}
                            accessibilityRole="button"
                            accessibilityLabel="Open settings and account management"
                        >
                            <MaterialIcons name="settings" size={24} color={colors.text.secondary} />
                            <Text style={styles.settingLabel}>Settings & Account</Text>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>
                        <View style={styles.settingDivider} />
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => Linking.openURL('https://www.fitzoapp.in/privacy-policy')}
                        >
                            <MaterialIcons name="privacy-tip" size={24} color={colors.text.secondary} />
                            <Text style={styles.settingLabel}>Privacy & Security</Text>
                            <MaterialIcons name="open-in-new" size={20} color={colors.text.muted} />
                        </TouchableOpacity>
                        <View style={styles.settingDivider} />
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => Linking.openURL('mailto:contact@fitzoapp.in')}
                        >
                            <MaterialIcons name="help" size={24} color={colors.text.secondary} />
                            <Text style={styles.settingLabel}>Help & Support</Text>
                            <MaterialIcons name="open-in-new" size={20} color={colors.text.muted} />
                        </TouchableOpacity>
                    </GlassCard>
                </View>

                {/* Logout */}
                <Button
                    title="Log Out"
                    onPress={async () => {
                        await logout();
                        router.replace('/login' as any);
                    }}
                    variant="secondary"
                    fullWidth
                    style={{ marginTop: spacing.xl, marginBottom: 100 }}
                />
            </ScrollView>

            {/* Edit Modal */}
            <Modal
                visible={isEditing}
                animationType="slide"
                presentationStyle="pageSheet"
                allowSwipeDismissal={false}
                onRequestClose={closeEditor}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle} accessibilityRole="header">Edit profile</Text>
                        <TouchableOpacity onPress={closeEditor} disabled={saving} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close editor" accessibilityState={{ disabled: saving }}>
                                <MaterialIcons name="close" size={20} color={colors.text.primary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
                        <Text style={styles.editorHint}>Choose how you appear in Fitzo.</Text>
                        <AvatarPicker value={editAvatar} name={editName.trim()} disabled={saving} onChange={value => { setEditAvatar(value); setEditError(''); setConfirmDiscard(false); }} />
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Display name</Text>
                            <TextInput
                                style={[styles.input, nameFocused && styles.inputFocused]}
                                value={editName}
                                onChangeText={value => { setEditName(value); setEditError(''); setConfirmDiscard(false); }}
                                placeholder="Your name"
                                placeholderTextColor={colors.text.subtle}
                                accessibilityLabel="Display name"
                                editable={!saving}
                                autoComplete="name"
                                textContentType="name"
                                autoCapitalize="words"
                                autoCorrect={false}
                                maxLength={100}
                                onFocus={() => setNameFocused(true)}
                                onBlur={() => setNameFocused(false)}
                                returnKeyType="done"
                                onSubmitEditing={() => { void handleUpdateProfile(); }}
                            />
                            <Text style={styles.editorHint}>Shown on your profile and to friends.</Text>
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        {!!editError && <Text style={styles.editorError} accessibilityRole="alert" accessibilityLiveRegion="polite">{editError}</Text>}
                        {confirmDiscard ? <>
                            <Text style={styles.discardTitle} accessibilityRole="alert">Discard your changes?</Text>
                            <Button title="Keep editing" variant="secondary" onPress={() => setConfirmDiscard(false)} fullWidth />
                            <Button title="Discard changes" variant="danger" onPress={() => { setConfirmDiscard(false); setIsEditing(false); }} fullWidth style={{ marginTop: 10 }} />
                        </> : <Button title="Save changes" onPress={handleUpdateProfile} loading={saving} disabled={saving || !profileChanged} fullWidth />}
                    </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            {/* Day's food log — opened by tapping a calendar dot.
                This and FoodEntrySheet are SIBLINGS on purpose: FoodEntrySheet
                renders its own Modal, and nesting Modals is unreliable on
                Android. */}
            <Modal
                visible={dayView !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setDayView(null)}
            >
                <Pressable style={styles.dayBackdrop} onPress={() => setDayView(null)}>
                    <Pressable style={styles.daySheet} onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.dayTitle}>{dayView?.date}</Text>

                        {dayView?.entries.length === 0 ? (
                            <Text style={styles.dayEmpty}>Nothing logged this day</Text>
                        ) : (
                            <ScrollView>
                                {dayView?.entries.map((e) => (
                                    <Pressable
                                        key={e.id}
                                        style={styles.dayRow}
                                        onPress={() => setOpenEntry(e)}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${e.food_name || 'Entry'}, ${e.calories} calories. Tap to edit or delete.`}
                                    >
                                        <Text style={styles.dayRowName} numberOfLines={1}>
                                            {e.food_name || 'Entry'}
                                        </Text>
                                        <Text style={styles.dayRowKcal}>{e.calories} kcal</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>

            <AIConsentModal
                visible={aiModalVisible}
                featureTitle="AI Data Sharing"
                onAccept={() => {
                    setAiConsentGranted(true);
                    setAiModalVisible(false);
                    toast.success('AI Features Enabled', 'Your AI preferences have been updated.');
                }}
                onDecline={() => {
                    setAiConsentGranted(false);
                    setAiModalVisible(false);
                    toast.info('AI Features Disabled', 'AI features will remain off.');
                }}
            />

            <FoodEntrySheet
                entry={openEntry}
                onClose={() => setOpenEntry(null)}
                onChanged={() => { if (dayView) openDay(dayView.date); }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    dayBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    daySheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.xl,
        borderTopWidth: 1,
        borderColor: colors.glass.border,
        maxHeight: '70%',
    },
    dayTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    dayEmpty: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        paddingVertical: spacing.lg,
    },
    dayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    dayRowName: {
        flex: 1,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    dayRowKcal: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    headerTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        letterSpacing: 2,
    },
    headerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.text.subtle,
    },
    headerSubtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    headerRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    settingsBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: 200,
    },
    profileCard: {
        alignItems: 'center',
        marginBottom: spacing.xl,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    identityHero: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        marginBottom: spacing.lg,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: spacing.md,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xl,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.glass.surface,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    statusBadgeText: {
        fontSize: 12,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
    },
    consistencyCard: {
        marginTop: spacing.sm,
    },
    consistencyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayCol: {
        alignItems: 'center',
        gap: spacing.xs,
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    dayCircleDone: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dayText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    dateLabel: {
        fontSize: 9,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.subtle,
        marginBottom: 2,
    },
    userName: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginTop: spacing.md,
        letterSpacing: 0.5,
    },
    userEmail: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.xs,
        letterSpacing: 0.5,
    },
    proBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.primary,
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: borderRadius.full,
        marginTop: spacing.md,
    },
    proText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
        letterSpacing: 1,
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    statCard: {
        flex: 1,
    },
    statContent: {
        alignItems: 'center',
        gap: spacing.xs,
    },
    statValue: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.light,
        color: colors.text.primary,
        letterSpacing: -1,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.subtle,
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: spacing.md,
        letterSpacing: 0.5,
    },
    settingsCard: {
        // padding: 0 handled via prop
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.md,
    },
    settingLabel: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    settingSubtext: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },
    settingDivider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginLeft: 56, // Align with text
    },
    biometricsCard: {
        marginTop: spacing.sm,
    },
    biometricsHeader: {
        flexDirection: 'row',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    biometricStat: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    biometricValue: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: 2,
    },
    biometricUnit: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginLeft: 2,
    },
    biometricLabel: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 1,
    },
    biometricDivider: {
        width: 1,
        height: 36,
        backgroundColor: colors.glass.borderLight,
        alignSelf: 'center',
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
        width: '100%', maxWidth: 600, alignSelf: 'center',
    },
    modalTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    closeBtn: {
        width: 44,
        height: 44,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        padding: spacing.xl,
        width: '100%', maxWidth: 600, alignSelf: 'center',
    },
    inputGroup: {
        marginBottom: spacing.xl,
        marginTop: spacing.xl,
    },
    inputLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    input: {
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        fontSize: typography.sizes.base,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.medium,
        minHeight: 56,
        ...Platform.select({ web: { outlineWidth: 0 } }),
    },
    inputFocused: { borderColor: colors.text.secondary },
    editorHint: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 21, marginBottom: 16, marginTop: 8 },
    editorError: { color: '#FCA5A5', fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 21, marginBottom: 14 },
    discardTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 16, lineHeight: 24, marginBottom: 16 },
    modalFooter: {
        padding: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        width: '100%', maxWidth: 600, alignSelf: 'center',
    },

});
