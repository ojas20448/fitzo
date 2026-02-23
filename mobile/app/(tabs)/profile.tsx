import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Modal,
    TextInput,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { memberAPI, caloriesAPI, nutritionAPI, measurementsAPI } from '../../src/services/api';
import Avatar from '../../src/components/Avatar';
import GlassCard from '../../src/components/GlassCard';
import Button from '../../src/components/Button';
import WorkoutCalendar from '../../src/components/WorkoutCalendar';
import Skeleton, { SkeletonCard } from '../../src/components/Skeleton';
import { useToast } from '../../src/components/Toast';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/styles/theme';

export default function ProfileScreen() {
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

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editAvatar, setEditAvatar] = useState('');
    const [saving, setSaving] = useState(false);

    // Preset Avatars
    const AVATAR_PRESETS = [
        'https://api.dicebear.com/7.x/avataaars/png?seed=Felix',
        'https://api.dicebear.com/7.x/avataaars/png?seed=Aneka',
        'https://api.dicebear.com/7.x/avataaars/png?seed=Mark',
        'https://api.dicebear.com/7.x/avataaars/png?seed=Jasmine',
        'https://api.dicebear.com/7.x/avataaars/png?seed=Diego',
        'https://api.dicebear.com/7.x/avataaars/png?seed=Sarah',
        'https://api.dicebear.com/7.x/bottts/png?seed=1',
        'https://api.dicebear.com/7.x/bottts/png?seed=2'
    ];

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        try {
            const [homeRes, caloriesRes, profileRes, measurementsRes, calHistoryRes] = await Promise.all([
                memberAPI.getHome(),
                caloriesAPI.getToday().catch(() => ({ totals: { calories: 0, entry_count: 0 } })),
                nutritionAPI.getProfile().catch(() => ({ profile: null })),
                measurementsAPI.getLatest().catch(() => ({ measurement: null })),
                caloriesAPI.getHistory(30).catch(() => ({ history: [] }))
            ]);

            // Extract unique dates from calorie entries
            const foodDates = calHistoryRes.history
                ? [...new Set(calHistoryRes.history.map((entry: any) => {
                    const date = entry.logged_date || entry.created_at;
                    return date ? new Date(date).toISOString().split('T')[0] : null;
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
        setEditAvatar(user?.avatar_url || AVATAR_PRESETS[0]);
        setIsEditing(true);
    };

    const handleUpdateProfile = async () => {
        if (!editName.trim()) return;
        setSaving(true);
        try {
            await memberAPI.updateProfile({
                name: editName,
                avatar_url: editAvatar
            });

            // Refresh both the home data AND the AuthContext user state
            await Promise.all([loadData(), refreshUser()]);

            setIsEditing(false);
            toast.success('Profile updated', 'Your changes have been saved');
        } catch (error: any) {
            console.error('Failed to update profile', error);
            toast.error('Update failed', error?.message || 'Could not save profile changes');
        } finally {
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
                    <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/member/settings' as any)}>
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
                <TouchableOpacity onPress={handleEditOpen}>
                    <GlassCard style={styles.settingsBtn}>
                        <MaterialIcons name="edit" size={20} color={colors.text.primary} />
                    </GlassCard>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
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

                    <Text style={styles.userName}>{user?.name || 'Member'}</Text>

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


                {/* Monthly Progress */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Activity History</Text>
                    <WorkoutCalendar history={stats.history} foodHistory={stats.foodHistory} />
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
                            <MaterialIcons name="monitoring" size={24} color={colors.text.secondary} />
                            <Text style={styles.settingLabel}>Health Report</Text>
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
                        >
                            <MaterialIcons name="notifications" size={24} color={colors.text.secondary} />
                            <Text style={styles.settingLabel}>Notifications</Text>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>
                        <View style={styles.settingDivider} />
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => Linking.openURL('https://fitzoapp.in/privacy')}
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
                onRequestClose={() => setIsEditing(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Edit Profile</Text>
                        <TouchableOpacity onPress={() => setIsEditing(false)}>
                            <GlassCard style={styles.closeBtn}>
                                <MaterialIcons name="close" size={20} color={colors.text.primary} />
                            </GlassCard>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.modalContent}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Display Name</Text>
                            <TextInput
                                style={styles.input}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="Your Name"
                                placeholderTextColor={colors.text.subtle}
                            />
                        </View>

                        <Text style={styles.inputLabel}>Choose Avatar</Text>
                        <View style={styles.avatarGrid}>
                            {AVATAR_PRESETS.map((uri, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.avatarOption,
                                        editAvatar === uri && styles.avatarOptionSelected
                                    ]}
                                    onPress={() => setEditAvatar(uri)}
                                >
                                    <Avatar uri={uri} size="md" />
                                    {editAvatar === uri && (
                                        <View style={styles.checkBadge}>
                                            <MaterialIcons name="check" size={12} color={colors.background} />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <Button
                            title={saving ? "Saving..." : "Save Changes"}
                            onPress={handleUpdateProfile}
                            disabled={saving}
                            fullWidth
                        />
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
        flex: 1,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
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
        fontSize: 8,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 0.5,
    },
    biometricDivider: {
        width: 1,
        height: '60%',
        backgroundColor: colors.glass.border,
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
    },
    modalTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        padding: spacing.xl,
    },
    inputGroup: {
        marginBottom: spacing.xl,
    },
    inputLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    input: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        fontSize: typography.sizes.base,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.medium,
    },
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    avatarOption: {
        padding: 4,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    avatarOptionSelected: {
        borderColor: colors.primary,
    },
    checkBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.primary,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.background,
    },
    modalFooter: {
        padding: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
});
