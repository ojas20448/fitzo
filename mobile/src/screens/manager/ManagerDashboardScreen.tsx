import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { managerAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import CrowdIndicator from '../../components/CrowdIndicator';
import Skeleton from '../../components/Skeleton';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

interface UpcomingClass {
    id: string;
    name: string;
    trainer: string;
    starts_in: string;
    bookings: number;
}

interface DashboardData {
    today: {
        total_checkins: number;
        active_now: number;
    };
    crowd: {
        level: 'low' | 'medium' | 'high';
        percentage: number;
    };
    upcoming_classes: UpcomingClass[];
    trainers: {
        total: number;
        active: number;
    };
}

const ManagerDashboardScreen: React.FC = () => {
    const { user, logout } = useAuth();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const response = await managerAPI.getDashboard();
            setData(response);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadDashboard();
        setRefreshing(false);
    };

    if (loading || !data) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Skeleton Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>MANAGER</Text>
                        <Text style={styles.headerDot}>·</Text>
                        <Text style={styles.headerSubtitle}>OVERVIEW</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <Skeleton width={40} height={40} borderRadius={20} />
                        <Skeleton width={40} height={40} borderRadius={20} />
                    </View>
                </View>

                {/* Skeleton User Row */}
                <View style={styles.userRow}>
                    <Skeleton width={48} height={48} borderRadius={24} />
                    <View style={{ gap: spacing.xs }}>
                        <Skeleton width={100} height={14} borderRadius={4} />
                        <Skeleton width={140} height={20} borderRadius={4} />
                    </View>
                </View>

                {/* Skeleton Stats */}
                <View style={[styles.content, { paddingTop: spacing.xl }]}>
                    <View style={styles.statsGrid}>
                        <GlassCard style={styles.primaryStatCard}>
                            <Skeleton width={48} height={48} borderRadius={24} style={{ backgroundColor: 'rgba(0,0,0,0.2)' }} />
                            <Skeleton width={80} height={48} borderRadius={8} style={{ marginTop: spacing.sm }} />
                            <Skeleton width={60} height={14} borderRadius={4} style={{ marginTop: spacing.xs }} />
                        </GlassCard>
                        <GlassCard style={styles.statCard}>
                            <Skeleton width={80} height={40} borderRadius={8} />
                            <Skeleton width={100} height={14} borderRadius={4} style={{ marginTop: spacing.sm }} />
                        </GlassCard>
                    </View>

                    {/* Skeleton Actions */}
                    <View style={{ marginTop: spacing.xl }}>
                        <Skeleton width={120} height={24} borderRadius={4} style={{ marginBottom: spacing.md }} />
                        <View style={styles.actionsRow}>
                            {[1, 2, 3].map((i) => (
                                <View key={i} style={styles.actionCard}>
                                    <Skeleton width={48} height={48} borderRadius={24} />
                                    <Skeleton width={60} height={12} borderRadius={4} style={{ marginTop: spacing.sm }} />
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>MANAGER</Text>
                    <Text style={styles.headerDot}>·</Text>
                    <Text style={styles.headerSubtitle}>OVERVIEW</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.headerBtn} accessibilityLabel="Settings">
                        <MaterialIcons name="settings" size={18} color={colors.text.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={logout} accessibilityLabel="Logout">
                        <MaterialIcons name="logout" size={18} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* User Info Row */}
            <View style={styles.userRow}>
                <Avatar uri={user?.avatar_url} size="md" />
                <View style={styles.greeting}>
                    <Text style={styles.welcomeText}>Welcome back,</Text>
                    <Text style={styles.userName}>{user?.name}</Text>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Today's Stats */}
                <View style={styles.statsGrid}>
                    <GlassCard style={styles.primaryStatCard}>
                        <View style={styles.statIconBg}>
                            <MaterialIcons name="groups" size={28} color={colors.background} />
                        </View>
                        <Text style={styles.bigStatNumber}>{data.today.active_now}</Text>
                        <Text style={styles.statLabel}>Active Now</Text>
                    </GlassCard>

                    <GlassCard style={styles.statCard}>
                        <Text style={styles.statNumber}>{data.today.total_checkins}</Text>
                        <Text style={styles.statLabel}>Check-ins Today</Text>
                    </GlassCard>
                </View>

                {/* Crowd Level */}
                <GlassCard style={styles.crowdCard}>
                    <CrowdIndicator level={data.crowd.level} />
                    <View style={styles.crowdBar}>
                        <View
                            style={[
                                styles.crowdBarFill,
                                { width: `${data.crowd.percentage}%` },
                                data.crowd.level === 'low' && { backgroundColor: colors.crowd.low },
                                data.crowd.level === 'medium' && { backgroundColor: colors.crowd.medium },
                                data.crowd.level === 'high' && { backgroundColor: colors.crowd.high },
                            ]}
                        />
                    </View>
                </GlassCard>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => router.push('/manager/people?initialTab=members' as any)}
                        >
                            <View style={styles.actionIcon}>
                                <MaterialIcons name="person-add" size={24} color={colors.primary} />
                            </View>
                            <Text style={styles.actionLabel}>Add Member</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => router.push('/manager/people?initialTab=trainers' as any)}
                        >
                            <View style={styles.actionIcon}>
                                <MaterialIcons name="fitness-center" size={24} color={colors.primary} />
                            </View>
                            <Text style={styles.actionLabel}>Add Trainer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => router.push('/classes')}
                        >
                            <View style={styles.actionIcon}>
                                <MaterialIcons name="event" size={24} color={colors.primary} />
                            </View>
                            <Text style={styles.actionLabel}>Add Class</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Upcoming Classes */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Upcoming Classes</Text>
                        <TouchableOpacity onPress={() => router.push('/classes' as any)}>
                            <Text style={styles.viewAll}>View all</Text>
                        </TouchableOpacity>
                    </View>

                    {data.upcoming_classes.length === 0 ? (
                        <GlassCard style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No classes scheduled today</Text>
                        </GlassCard>
                    ) : (
                        data.upcoming_classes.map((classItem) => (
                            <GlassCard key={classItem.id} style={styles.classCard}>
                                <View style={styles.classInfo}>
                                    <Text style={styles.className}>{classItem.name}</Text>
                                    <Text style={styles.trainerName}>with {classItem.trainer}</Text>
                                </View>
                                <View style={styles.classStats}>
                                    <Text style={styles.startsIn}>{classItem.starts_in}</Text>
                                    <Text style={styles.bookings}>{classItem.bookings} booked</Text>
                                </View>
                            </GlassCard>
                        ))
                    )}
                </View>

                {/* Trainers */}
                <GlassCard style={styles.trainersCard}>
                    <View style={styles.trainersInfo}>
                        <MaterialIcons name="person" size={24} color={colors.text.secondary} />
                        <View style={styles.trainersText}>
                            <Text style={styles.trainersLabel}>Trainers On-Duty</Text>
                            <Text style={styles.trainersCount}>
                                {data.trainers.active}/{data.trainers.total}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => router.push('/manager/people?initialTab=trainers' as any)}
                    >
                        <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                </GlassCard>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

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
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: typography.letterSpacing.wider,
    },
    headerDot: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.light,
        color: colors.text.subtle,
    },
    headerSubtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.light,
        color: colors.text.secondary,
        letterSpacing: typography.letterSpacing.wide,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    headerBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.lg,
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.borderLight,
    },
    greeting: {
        gap: 2,
    },
    welcomeText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
    },
    userName: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xl,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    primaryStatCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.xl,
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    statIconBg: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0,0,0,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    bigStatNumber: {
        fontSize: typography.sizes['4xl'],
        fontFamily: typography.fontFamily.light,
        color: colors.background,
        letterSpacing: typography.letterSpacing.tighter,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
    },
    statNumber: {
        fontSize: typography.sizes['3xl'],
        fontFamily: typography.fontFamily.light,
        color: colors.text.primary,
        letterSpacing: typography.letterSpacing.tighter,
    },
    statLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginTop: spacing.xs,
    },
    crowdCard: {
        marginBottom: spacing.xl,
    },
    crowdBar: {
        height: 8,
        backgroundColor: colors.glass.surface,
        borderRadius: 4,
        marginTop: spacing.md,
        overflow: 'hidden',
    },
    crowdBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    viewAll: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
        textTransform: 'uppercase',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    actionCard: {
        flex: 1,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.lg,
        alignItems: 'center',
        gap: spacing.sm,
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    classCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    classInfo: {
        flex: 1,
    },
    className: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    trainerName: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        marginTop: 2,
    },
    classStats: {
        alignItems: 'flex-end',
    },
    startsIn: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    bookings: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },
    emptyCard: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    emptyText: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
    },
    trainersCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    trainersInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    trainersText: {
        gap: 2,
    },
    trainersLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    trainersCount: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    viewBtn: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    viewBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
});

export default ManagerDashboardScreen;
