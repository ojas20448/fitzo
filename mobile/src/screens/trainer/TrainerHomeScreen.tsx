import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { trainerAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import Skeleton from '../../components/Skeleton';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

interface TrainerMember {
    id: string;
    name: string;
    avatar_url: string | null;
    xp_points: number;
    joined_at: string;
    checked_in_today: boolean;
    streak: number;
    today_intent: {
        muscle_group: string;
        note: string | null;
    } | null;
}

const TrainerHomeScreen: React.FC = () => {
    const { user, logout } = useAuth();
    const [members, setMembers] = useState<TrainerMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadMembers();
    }, []);

    const loadMembers = async () => {
        try {
            const response = await trainerAPI.getMembers();
            setMembers(response.members || []);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadMembers();
        setRefreshing(false);
    };

    const handleMemberPress = (memberId: string) => {
        router.push(`/trainer/member/${memberId}` as any);
    };

    const activeMembers = members.filter(m => m.checked_in_today);
    const inactiveMembers = members.filter(m => !m.checked_in_today);

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Skeleton Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>TRAINER</Text>
                        <Text style={styles.headerDot}>·</Text>
                        <Text style={styles.headerSubtitle}>DASHBOARD</Text>
                    </View>
                    <Skeleton width={40} height={40} borderRadius={20} />
                </View>

                {/* Skeleton Stats */}
                <View style={styles.statsRow}>
                    <GlassCard style={styles.statCard}>
                        <Skeleton width={60} height={40} borderRadius={8} />
                        <Skeleton width={80} height={16} borderRadius={4} style={{ marginTop: spacing.sm }} />
                    </GlassCard>
                    <GlassCard style={styles.statCard}>
                        <Skeleton width={60} height={40} borderRadius={8} />
                        <Skeleton width={80} height={16} borderRadius={4} style={{ marginTop: spacing.sm }} />
                    </GlassCard>
                </View>

                {/* Skeleton Members */}
                <View style={styles.content}>
                    <Skeleton width={120} height={24} borderRadius={4} style={{ marginBottom: spacing.md }} />
                    {[1, 2, 3].map((i) => (
                        <GlassCard key={i} style={styles.memberCard}>
                            <Skeleton width={48} height={48} borderRadius={24} />
                            <View style={{ flex: 1, gap: spacing.xs }}>
                                <Skeleton width={140} height={18} borderRadius={4} />
                                <Skeleton width={100} height={14} borderRadius={4} />
                            </View>
                        </GlassCard>
                    ))}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>TRAINER</Text>
                    <Text style={styles.headerDot}>·</Text>
                    <Text style={styles.headerSubtitle}>DASHBOARD</Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={logout} accessibilityLabel="Logout">
                    <MaterialIcons name="logout" size={18} color={colors.text.secondary} />
                </TouchableOpacity>
            </View>

            {/* User Info Row */}
            <View style={styles.userRow}>
                <Avatar uri={user?.avatar_url} size="md" />
                <View style={styles.greeting}>
                    <Text style={styles.welcomeText}>Welcome back,</Text>
                    <Text style={styles.userName}>{user?.name}</Text>
                </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <GlassCard style={styles.statCard}>
                    <Text style={styles.statNumber}>{members.length}</Text>
                    <Text style={styles.statLabel}>Total Members</Text>
                </GlassCard>
                <GlassCard style={styles.statCard}>
                    <View style={styles.activeDot} />
                    <Text style={styles.statNumber}>{activeMembers.length}</Text>
                    <Text style={styles.statLabel}>At Gym Now</Text>
                </GlassCard>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Active Members */}
                {activeMembers.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.activeDotSmall} />
                            <Text style={styles.sectionTitle}>Active Now ({activeMembers.length})</Text>
                        </View>

                        {activeMembers.map((member) => (
                            <TouchableOpacity
                                key={member.id}
                                onPress={() => handleMemberPress(member.id)}
                            >
                                <GlassCard style={styles.memberCard}>
                                    <Avatar uri={member.avatar_url} size="lg" showOnline />
                                    <View style={styles.memberInfo}>
                                        <View style={styles.memberNameRow}>
                                            <Text style={styles.memberName}>{member.name}</Text>
                                            <Text style={styles.streakBadge}>🔥 {member.streak}</Text>
                                        </View>
                                        {member.today_intent && (
                                            <View style={styles.intentRow}>
                                                <Badge
                                                    label={member.today_intent.muscle_group}
                                                    variant="primary"
                                                    size="sm"
                                                />
                                                {member.today_intent.note && (
                                                    <Text style={styles.intentNote} numberOfLines={1}>
                                                        {member.today_intent.note}
                                                    </Text>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                    <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                                </GlassCard>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* All Members */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>All Members ({members.length})</Text>

                    {inactiveMembers.map((member) => (
                        <TouchableOpacity
                            key={member.id}
                            onPress={() => handleMemberPress(member.id)}
                        >
                            <GlassCard style={styles.memberCard} variant="inactive">
                                <Avatar uri={member.avatar_url} size="md" grayscale />
                                <View style={styles.memberInfo}>
                                    <Text style={styles.memberName}>{member.name}</Text>
                                    <Text style={styles.inactiveText}>Not checked in today</Text>
                                </View>
                                <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                            </GlassCard>
                        </TouchableOpacity>
                    ))}
                </View>

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
    logoutBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        gap: spacing.md,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.lg,
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
    activeDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.crowd.low,
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
    },
    activeDotSmall: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.crowd.low,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xl,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    memberInfo: {
        flex: 1,
    },
    memberNameRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    memberName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    streakBadge: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
    },
    intentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    intentNote: {
        flex: 1,
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
    },
    inactiveText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },
});

export default TrainerHomeScreen;
