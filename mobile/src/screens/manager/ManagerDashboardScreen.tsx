import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Modal,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
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
        active_now?: number;
        capacity?: number;
    };
    upcoming_classes: UpcomingClass[];
    trainers: {
        total: number;
        active: number;
    };
}

interface AtRiskMember {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    last_checkin: string | null;
    days_inactive: number | null;
    total_checkins: number;
}

interface RetentionSummary {
    week4_retention_pct: number | null;
    retained: number;
    eligible: number;
    note: string | null;
}

const ManagerDashboardScreen: React.FC = () => {
    const { user, logout } = useAuth();
    const [data, setData] = useState<DashboardData | null>(null);
    const [atRisk, setAtRisk] = useState<AtRiskMember[]>([]);
    const [atRiskCount, setAtRiskCount] = useState(0);
    const [retention, setRetention] = useState<RetentionSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [editedCapacity, setEditedCapacity] = useState('');
    const [updatingCapacity, setUpdatingCapacity] = useState(false);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        try {
            const [dashboard, atRiskRes, retentionRes] = await Promise.all([
                managerAPI.getDashboard(),
                managerAPI.getAtRisk(14).catch(() => null),
                managerAPI.getRetention().catch(() => null),
            ]);
            setData(dashboard);
            if (atRiskRes) {
                setAtRisk(atRiskRes.members.slice(0, 5));
                setAtRiskCount(atRiskRes.count);
            }
            if (retentionRes) {
                setRetention(retentionRes.summary);
            }
        } catch (error: any) {
            // silently handled
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadDashboard();
        setRefreshing(false);
    };

    const handleSaveCapacity = async () => {
        const capacityNum = parseInt(editedCapacity, 10);
        if (!capacityNum || isNaN(capacityNum) || capacityNum < 1 || capacityNum > 5000) {
            Alert.alert('Invalid Capacity', 'Please enter a number between 1 and 5000');
            return;
        }

        setUpdatingCapacity(true);
        try {
            await managerAPI.updateGymCapacity(capacityNum);
            
            // Update local state capacity and percentage
            if (data) {
                const activeNow = data.crowd.active_now ?? data.today.active_now ?? 0;
                const percentage = Math.min(100, Math.round((activeNow / capacityNum) * 100));
                setData({
                    ...data,
                    crowd: {
                        ...data.crowd,
                        capacity: capacityNum,
                        percentage,
                    }
                });
            }

            Alert.alert('Success', `Gym capacity updated to ${capacityNum} members`);
            setShowSettingsModal(false);
        } catch (error: any) {
            Alert.alert('Error', error?.response?.data?.message || 'Failed to update capacity');
        } finally {
            setUpdatingCapacity(false);
        }
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
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={() => {
                            setEditedCapacity(String(data.crowd.capacity || 50));
                            setShowSettingsModal(true);
                        }}
                        accessibilityLabel="Settings"
                    >
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
                                { width: `${Math.max(data.crowd.percentage, 2)}%` },
                                data.crowd.level === 'low' && { backgroundColor: colors.crowd.low },
                                data.crowd.level === 'medium' && { backgroundColor: colors.crowd.medium },
                                data.crowd.level === 'high' && { backgroundColor: colors.crowd.high },
                            ]}
                        />
                    </View>
                    {data.crowd.capacity != null && (
                        <Text style={styles.crowdCaption}>
                            {data.crowd.active_now ?? data.today.active_now} of {data.crowd.capacity} capacity · {data.crowd.percentage}% full
                        </Text>
                    )}
                </GlassCard>

                {/* Member Health: retention + at-risk */}
                <View style={styles.statsGrid}>
                    <GlassCard style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {retention?.week4_retention_pct !== null && retention?.week4_retention_pct !== undefined
                                ? `${retention.week4_retention_pct}%`
                                : '—'}
                        </Text>
                        <Text style={styles.statLabel}>Week-4 Retention</Text>
                        <Text style={styles.statSubLabel}>
                            {retention && retention.eligible > 0
                                ? `${retention.retained}/${retention.eligible} members still active`
                                : 'Needs 4+ weeks of data'}
                        </Text>
                    </GlassCard>

                    <GlassCard style={styles.statCard}>
                        <Text style={[styles.statNumber, atRiskCount > 0 && styles.atRiskNumber]}>
                            {atRiskCount}
                        </Text>
                        <Text style={styles.statLabel}>At Risk</Text>
                        <Text style={styles.statSubLabel}>No check-in for 14+ days</Text>
                    </GlassCard>
                </View>

                {/* At-Risk Members list */}
                {atRisk.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Needs a Nudge</Text>
                            <TouchableOpacity onPress={() => router.push('/manager/people?initialTab=members' as any)}>
                                <Text style={styles.viewAll}>View all</Text>
                            </TouchableOpacity>
                        </View>
                        {atRisk.map((member) => (
                            <GlassCard key={member.id} style={styles.atRiskCard}>
                                <Avatar uri={member.avatar_url || undefined} name={member.name} size="sm" />
                                <View style={styles.atRiskInfo}>
                                    <Text style={styles.atRiskName}>{member.name}</Text>
                                    <Text style={styles.atRiskMeta}>
                                        {member.days_inactive === null
                                            ? 'Never checked in'
                                            : `Last seen ${member.days_inactive} days ago`}
                                    </Text>
                                </View>
                                <View style={styles.atRiskBadge}>
                                    <MaterialIcons name="warning-amber" size={14} color={colors.crowd?.medium || '#FFB020'} />
                                </View>
                            </GlassCard>
                        ))}
                    </View>
                )}

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

            {/* Settings Modal (Gym Capacity Edit) */}
            <Modal
                visible={showSettingsModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowSettingsModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <TouchableOpacity
                        style={styles.modalDismissArea}
                        activeOpacity={1}
                        onPress={() => setShowSettingsModal(false)}
                    />
                    <GlassCard style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>GYM SETTINGS</Text>
                            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                                <MaterialIcons name="close" size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalLabel}>Gym Capacity</Text>
                        <Text style={styles.modalDescription}>
                            Set the maximum comfortable capacity of your gym. This drives the real-time occupancy crowd indicator (Green/Yellow/Red) for members.
                        </Text>

                        <TextInput
                            style={styles.modalInput}
                            value={editedCapacity}
                            onChangeText={setEditedCapacity}
                            placeholder="e.g. 50"
                            placeholderTextColor={colors.text.muted}
                            keyboardType="numeric"
                            maxLength={4}
                            editable={!updatingCapacity}
                            accessibilityLabel="Gym capacity"
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setShowSettingsModal(false)}
                                disabled={updatingCapacity}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveBtn, updatingCapacity && styles.saveBtnDisabled]}
                                onPress={handleSaveCapacity}
                                disabled={updatingCapacity}
                            >
                                {updatingCapacity ? (
                                    <ActivityIndicator size="small" color={colors.background} />
                                ) : (
                                    <Text style={styles.saveBtnText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </GlassCard>
                </KeyboardAvoidingView>
            </Modal>
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
    statSubLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
        textAlign: 'center',
    },
    atRiskNumber: {
        color: colors.crowd.medium,
    },
    atRiskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    atRiskInfo: {
        flex: 1,
    },
    atRiskName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    atRiskMeta: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        marginTop: 2,
    },
    atRiskBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    crowdCard: {
        marginBottom: spacing.xl,
    },
    crowdCaption: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.sm,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalDismissArea: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
    modalContent: {
        width: '90%',
        maxWidth: 400,
        padding: spacing.xl,
        gap: spacing.md,
        borderRadius: borderRadius.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
        paddingBottom: spacing.sm,
    },
    modalTitle: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        letterSpacing: 1,
    },
    modalLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginTop: spacing.sm,
    },
    modalDescription: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        lineHeight: 16,
    },
    modalInput: {
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        color: colors.text.primary,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        minHeight: 44,
        marginVertical: spacing.xs,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    cancelBtn: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        justifyContent: 'center',
    },
    cancelBtnText: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.sm,
    },
    saveBtn: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 80,
    },
    saveBtnDisabled: {
        opacity: 0.6,
    },
    saveBtnText: {
        color: colors.background,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.sm,
    },
});

export default ManagerDashboardScreen;
