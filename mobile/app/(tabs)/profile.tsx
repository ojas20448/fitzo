import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { memberAPI, caloriesAPI } from '../../src/services/api';
import Avatar from '../../src/components/Avatar';
import GlassCard from '../../src/components/GlassCard';
import Button from '../../src/components/Button';
import WorkoutCalendar from '../../src/components/WorkoutCalendar';
import NutritionAnalytics from '../../src/components/NutritionAnalytics';
import Skeleton, { SkeletonCard } from '../../src/components/Skeleton';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/styles/theme';

export default function ProfileScreen() {
    const { user, logout } = useAuth();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        streak: 0,
        history: [] as string[],
        calories: { total_calories: 0, entry_count: 0 }
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [homeRes, caloriesRes] = await Promise.all([
                memberAPI.getHome(),
                caloriesAPI.getToday().catch(() => ({ totals: { calories: 0, entry_count: 0 } }))
            ]);

            setStats({
                streak: homeRes.streak.current,
                history: homeRes.streak.history || [],
                calories: {
                    total_calories: caloriesRes.totals?.calories || 0,
                    entry_count: caloriesRes.totals?.entry_count || 0,
                }
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

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>PROFILE</Text>
                        <View style={styles.headerDot} />
                        <Text style={styles.headerSubtitle}>YOU</Text>
                    </View>
                    <TouchableOpacity style={styles.settingsBtn}>
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
                <TouchableOpacity style={styles.settingsBtn}>
                    <MaterialIcons name="settings" size={20} color={colors.text.muted} />
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
                {/* Profile Card */}
                <GlassCard style={styles.profileCard} padding="lg">
                    <Avatar uri={user?.avatar_url} size="xl" />
                    <Text style={styles.userName}>{user?.name || 'Member'}</Text>
                    <Text style={styles.userEmail}>{user?.email}</Text>
                    <View style={styles.proBadge}>
                        <MaterialIcons name="verified" size={12} color={colors.background} />
                        <Text style={styles.proText}>{String(user?.role || 'Member').toUpperCase()}</Text>
                    </View>
                </GlassCard>

                {/* Main Stats */}
                <View style={styles.statsRow}>
                    <GlassCard style={styles.statCard} padding="md">
                        <View style={styles.statContent}>
                            <MaterialIcons name="local-fire-department" size={24} color={colors.primary} />
                            <Text style={styles.statValue}>{stats.streak}</Text>
                            <Text style={styles.statLabel}>Day Streak</Text>
                        </View>
                    </GlassCard>
                    <GlassCard style={styles.statCard} padding="md">
                        <View style={styles.statContent}>
                            <MaterialIcons name="diamond" size={24} color={colors.crowd.medium} />
                            <Text style={styles.statValue}>{user?.xp_points || 0}</Text>
                            <Text style={styles.statLabel}>XP Points</Text>
                        </View>
                    </GlassCard>
                </View>

                {/* Progress Visuals */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Monthly Consistency</Text>
                    <WorkoutCalendar history={stats.history} />
                </View>



                {/* Fitness Profile Section */}
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                        <Text style={styles.sectionTitle}>Body & Goals</Text>
                        <TouchableOpacity onPress={() => router.push('/member/fitness-profile' as any)}>
                            <Text style={{ color: colors.primary, fontFamily: typography.fontFamily.bold }}>Edit</Text>
                        </TouchableOpacity>
                    </View>
                    <GlassCard style={styles.settingsCard} padding="none">
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => router.push('/member/fitness-profile' as any)}
                        >
                            <MaterialIcons name="accessibility" size={24} color={colors.text.secondary} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.settingLabel}>Fitness Profile</Text>
                                <Text style={{ fontSize: 12, color: colors.text.muted }}>Goal, Weight, TDEE</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>
                        <View style={styles.settingDivider} />
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() => router.push('/member/measurements' as any)}
                        >
                            <MaterialIcons name="straighten" size={24} color={colors.text.secondary} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.settingLabel}>Body Measurements</Text>
                                <Text style={{ fontSize: 12, color: colors.text.muted }}>Log & Track History</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>
                    </GlassCard>
                </View>

                {/* Settings & Other Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <GlassCard style={styles.settingsCard} padding="none">
                        <TouchableOpacity style={styles.settingItem}>
                            <MaterialIcons name="notifications" size={24} color={colors.text.secondary} />
                            <Text style={styles.settingLabel}>Notifications</Text>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>
                        <View style={styles.settingDivider} />
                        <TouchableOpacity style={styles.settingItem}>
                            <MaterialIcons name="privacy-tip" size={24} color={colors.text.secondary} />
                            <Text style={styles.settingLabel}>Privacy & Security</Text>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                        </TouchableOpacity>
                        <View style={styles.settingDivider} />
                        <TouchableOpacity style={styles.settingItem}>
                            <MaterialIcons name="help" size={24} color={colors.text.secondary} />
                            <Text style={styles.settingLabel}>Help & Support</Text>
                            <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
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
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
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
});
