import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Pressable,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

// ... other imports

import { useAuth } from '../../context/AuthContext';
import { memberAPI, workoutsAPI, caloriesAPI, friendsAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import WeeklyProgress from '../../components/WeeklyProgress';
import NutritionAnalytics from '../../components/NutritionAnalytics';
import { SkeletonHomeScreen } from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import MacroPieChart from '../../components/MacroPieChart';
import WeeklyCharts from '../../components/WeeklyCharts';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

interface HomeData {
    user: {
        name: string;
        avatar_url: string | null;
        xp_points: number;
    };
    gym: {
        name: string;
        crowd_level: 'low' | 'medium' | 'high';
    } | null;
    checkin: {
        status: 'checked_in' | 'not_checked_in';
        checked_in_at: string | null;
    };
    intent: {
        id: string;
        training_pattern?: string;
        emphasis?: string[];
        session_label?: string;
        display?: string;
        visibility: string;
        note: string | null;
    } | null;
    streak: {
        current: number;
        best: number;
        history: string[];
    };
    insight?: {
        type: 'warning' | 'success';
        message: string;
    };
}

interface Friend {
    id: string;
    name: string;
    avatar_url: string | null;
}

interface TodayWorkout {
    id: string;
    workout_type: string;
    exercises: string | null;
    completed: boolean;
}

interface TodayCalories {
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
    entry_count: number;
}

const HomeScreen: React.FC = () => {
    const { user } = useAuth();
    const [data, setData] = useState<HomeData | null>(null);
    const [todayWorkouts, setTodayWorkouts] = useState<TodayWorkout[]>([]);
    const [todayCalories, setTodayCalories] = useState<TodayCalories>({
        total_calories: 0,
        total_protein: 0,
        total_carbs: 0,
        total_fat: 0,
        entry_count: 0
    });
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const DUMMY_FRIENDS: Friend[] = [
        { id: '1', name: 'Sarah Jones', avatar_url: 'https://i.pravatar.cc/150?u=sarah' },
        { id: '2', name: 'Mike Chen', avatar_url: 'https://i.pravatar.cc/150?u=mike' },
        { id: '3', name: 'Jessica Day', avatar_url: 'https://i.pravatar.cc/150?u=jess' },
        { id: '4', name: 'Tom Hardy', avatar_url: 'https://i.pravatar.cc/150?u=tom' },
    ];

    useEffect(() => {
        loadHomeData();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            loadHomeData();
        }, [])
    );

    const loadHomeData = async () => {
        try {
            const [homeRes, workoutsRes, caloriesRes, friendsRes] = await Promise.all([
                memberAPI.getHome(),
                workoutsAPI.getToday().catch(() => ({ workouts: [], summary: { count: 0, types: [] } })),
                caloriesAPI.getToday().catch(() => ({ entries: [], totals: { calories: 0, entry_count: 0 } })),
                friendsAPI.getFriends().catch(() => ({ friends: [] })),
            ]);
            setData(homeRes);
            setTodayWorkouts(workoutsRes.workouts || []);
            setTodayCalories({
                total_calories: caloriesRes.totals?.calories || 0,
                total_protein: caloriesRes.totals?.protein || 0,
                total_carbs: caloriesRes.totals?.carbs || 0,
                total_fat: caloriesRes.totals?.fat || 0,
                entry_count: caloriesRes.totals?.entry_count || 0,
            });
            const fetchedFriends = friendsRes?.friends || [];
            setFriends(fetchedFriends.length > 0 ? fetchedFriends : DUMMY_FRIENDS);
        } catch (error) {
            console.error('Failed to load home data:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadHomeData();
        setRefreshing(false);
    };

    const handleIntentPress = () => {
        router.push('/workout-intent' as any);
    };

    // Time-based greeting
    const greeting = 'Every day counts.';

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <SkeletonHomeScreen />
            </SafeAreaView>
        );
    }

    const firstName = data?.user.name.split(' ')[0] || user?.name.split(' ')[0] || 'there';
    const hasLoggedWorkoutToday = todayWorkouts.length > 0;
    const currentIntent = data?.intent;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                {/* Header - Refined with blur effect */}
                <View style={styles.header}>
                    <Pressable
                        style={styles.userInfo}
                        onPress={() => router.push('/(tabs)/profile' as any)}
                        accessibilityLabel="View profile"
                        accessibilityRole="button"
                    >
                        <View style={styles.avatarWrapper}>
                            <Avatar
                                uri={data?.user.avatar_url}
                                size="md"
                            />
                            <View style={styles.verifiedBadge}>
                                <MaterialIcons name="verified" size={12} color={colors.primary} />
                            </View>
                        </View>
                        <View style={styles.greetingContainer}>
                            <Text style={styles.welcomeText}>{greeting}</Text>
                            <Text style={styles.userName}>{firstName}</Text>
                        </View>
                    </Pressable>

                    {/* Right side: Gym + Streak */}
                    <View style={styles.headerRight}>
                        {/* Gym Badge */}
                        <Pressable
                            style={styles.gymBadge}
                            onPress={() => router.push('/qr-checkin' as any)}
                        >
                            <MaterialIcons name="location-on" size={14} color={colors.text.muted} />
                            <Text style={styles.gymBadgeText}>{data?.gym?.name || 'Your Gym'}</Text>
                            <MaterialIcons name="qr-code-2" size={14} color={colors.text.muted} />
                        </Pressable>

                        {/* Streak Badge */}
                        <View style={styles.streakBadge}>
                            <MaterialIcons name="local-fire-department" size={16} color="#FF6B35" />
                            <Text style={styles.streakText}>{data?.streak.current || 0}</Text>
                        </View>
                    </View>
                </View>

                {/* Smart Insight */}
                {data?.insight && (
                    <GlassCard style={{ marginBottom: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderColor: data.insight.type === 'warning' ? colors.crowd.medium : colors.success }}>
                        <MaterialIcons
                            name={data.insight.type === 'warning' ? 'warning' : 'emoji-events'}
                            size={24}
                            color={data.insight.type === 'warning' ? colors.crowd.medium : colors.success}
                        />
                        <Text style={{ flex: 1, color: colors.text.primary, fontSize: typography.sizes.sm }}>
                            {data.insight.message}
                        </Text>
                    </GlassCard>
                )}

                {/* Today's Training - Large Typography */}
                <Pressable
                    style={styles.todaySection}
                    onPress={handleIntentPress}
                    accessibilityLabel={currentIntent ? "View or change workout intent" : "Set today's workout focus"}
                    accessibilityRole="button"
                >
                    <View style={styles.todayLabelRow}>
                        <Text style={styles.todayLabel}>Today's Training</Text>
                        {!currentIntent && (
                            <View style={styles.tapHintPill}>
                                <Text style={styles.tapHintText}>TAP TO SET</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[styles.todayTitle, !currentIntent && styles.todayTitleMuted]}>
                        {currentIntent ? (
                            `${currentIntent.emphasis?.[0] || 'Training'} • ${currentIntent.training_pattern || 'Session'}`
                        ) : (
                            'Set Your Focus'
                        )}
                    </Text>
                    {currentIntent && (
                        <View style={styles.editIntentRow}>
                            <MaterialIcons name="edit" size={12} color={colors.text.muted} />
                            <Text style={styles.editIntentText}>Tap to change</Text>
                        </View>
                    )}
                </Pressable>

                {/* Active Session Card - Glass Effect */}
                {currentIntent && hasLoggedWorkoutToday && (
                    <View style={styles.activeSessionCard}>
                        <View style={styles.inProgressPill}>
                            <View style={styles.pulseDot}>
                                <View style={styles.pulseDotInner} />
                            </View>
                            <Text style={styles.inProgressText}>IN PROGRESS</Text>
                        </View>

                        <View style={styles.statsGrid}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>ACTIVE TIME</Text>
                                <Text style={styles.statValue}>45<Text style={styles.statUnit}>min</Text></Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>CALORIES</Text>
                                <Text style={styles.statValue}>{todayCalories.total_calories}<Text style={styles.statUnit}>kcal</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Quick Action Buttons - Refined */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={() => router.push('/log/workout' as any)}
                        accessibilityLabel="Log workout"
                    >
                        <MaterialIcons name="add" size={20} color={colors.text.dark} />
                        <Text style={styles.primaryActionText}>LOG WORKOUT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryActionBtn}
                        onPress={() => router.push('/log/calories' as any)}
                        accessibilityLabel="Log calories"
                    >
                        <MaterialIcons name="restaurant" size={20} color={colors.primary} />
                        <Text style={styles.secondaryActionText}>LOG CALORIES</Text>
                    </TouchableOpacity>
                </View>

                {/* Nutrition Summary with Macros */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today's Nutrition</Text>
                        <TouchableOpacity onPress={() => router.push('/log/calories' as any)}>
                            <Text style={styles.viewAllLink}>LOG FOOD</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/log/calories' as any)} activeOpacity={0.8}>
                        <MacroPieChart
                            calories={todayCalories.total_calories || 0}
                            calorieTarget={2000}
                            protein={todayCalories.total_protein || 0}
                            proteinTarget={150}
                            carbs={todayCalories.total_carbs || 0}
                            carbsTarget={200}
                            fat={todayCalories.total_fat || 0}
                            fatTarget={65}
                        />
                    </TouchableOpacity>
                </View>

                {/* Weekly Analytics - Lose It Style */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Weekly Progress</Text>
                    </View>
                    <WeeklyCharts />
                </View>

                {/* Continuing Learning Card */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Continuing Learning</Text>
                        <TouchableOpacity onPress={() => router.push('/(tabs)/learn' as any)}>
                            <Text style={styles.viewAllLink}>VIEW ALL</Text>
                        </TouchableOpacity>
                    </View>

                    <Pressable
                        style={styles.learningCard}
                        onPress={() => router.push('/(tabs)/learn' as any)}
                    >
                        <View style={styles.learningThumbnail}>
                            <View style={styles.playButton}>
                                <MaterialIcons name="play-arrow" size={16} color={colors.primary} />
                            </View>
                        </View>
                        <View style={styles.learningContent}>
                            <Text style={styles.learningTitle}>Nutrition 101</Text>
                            <Text style={styles.learningMeta}>Lesson 3 • Macros</Text>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: '60%' }]} />
                            </View>
                        </View>
                    </Pressable>
                </View>

                {/* Gym Buddies - Friend Avatars */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Gym Buddies</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.squadList}
                    >
                        {friends.length > 0 ? (
                            friends.map((friend) => (
                                <View key={friend.id} style={styles.squadMember}>
                                    <View style={styles.squadAvatar}>
                                        <Avatar size="lg" uri={friend.avatar_url} name={friend.name} />
                                    </View>
                                    <Text style={styles.squadName} numberOfLines={1}>
                                        {friend.name.split(' ')[0]}
                                    </Text>
                                </View>
                            ))
                        ) : (
                            <Text style={{ color: colors.text.muted, fontSize: typography.sizes.sm, paddingLeft: spacing.sm }}>
                                No buddies added yet.
                            </Text>
                        )}
                    </ScrollView>
                </View>

                {/* Add Buddy Button */}
                <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing['3xl'] }}>
                    <TouchableOpacity
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: spacing.md,
                            borderWidth: 1,
                            borderColor: colors.glass.border,
                            borderRadius: borderRadius.lg,
                            backgroundColor: colors.glass.surface,
                            gap: spacing.sm
                        }}
                        onPress={() => router.push('/member/add-buddy' as any)}
                    >
                        <MaterialIcons name="person-add" size={20} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontFamily: typography.fontFamily.semiBold }}>
                            Add Gym Buddy
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing['2xl'],
        paddingTop: spacing.md,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        minHeight: 48,
    },
    avatarWrapper: {
        position: 'relative',
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: colors.background,
        borderRadius: 10,
        padding: 2,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    greetingContainer: {
        gap: 2,
    },
    welcomeText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    userName: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    gymBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.glass.surface,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    gymBadgeText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        maxWidth: 80,
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.glass.surface,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    streakText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },

    // Today's Training
    todaySection: {
        marginBottom: spacing['2xl'],
    },
    todayLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    todayLabel: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    tapHintPill: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    tapHintText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 1,
    },
    todayTitle: {
        fontSize: typography.sizes['4xl'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: -1,
        lineHeight: typography.sizes['4xl'] * 1.1,
    },
    todayTitleMuted: {
        color: colors.text.muted,
    },
    editIntentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: spacing.sm,
    },
    editIntentText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },

    // Active Session Card
    activeSessionCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        marginBottom: spacing['2xl'],
    },
    inProgressPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.glass.surfaceLight,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
        marginBottom: spacing.xl,
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
        position: 'relative',
    },
    pulseDotInner: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    inProgressText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        letterSpacing: 2,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: spacing['2xl'],
    },
    statItem: {
        flex: 1,
    },
    statLabel: {
        fontSize: 10,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted,
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    statValue: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    statUnit: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
        marginLeft: 4,
    },

    // Action Buttons
    actionButtons: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing['3xl'],
    },
    primaryActionBtn: {
        flex: 1,
        height: 64,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.xl,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        ...shadows.glow,
    },
    primaryActionText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 1,
    },
    secondaryActionBtn: {
        flex: 1,
        height: 64,
        backgroundColor: 'transparent',
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
    },
    secondaryActionText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        letterSpacing: 1,
    },

    // Section
    section: {
        marginBottom: spacing['3xl'],
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: -0.3,
    },
    viewAllLink: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 1.5,
    },

    // Learning Card
    learningCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: 4,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    learningThumbnail: {
        width: 96,
        height: 80,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.glass.surfaceHover,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
    },
    learningContent: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    learningTitle: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: 4,
    },
    learningMeta: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginBottom: spacing.md,
    },
    progressBar: {
        height: 4,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 2,
    },

    // Squad
    squadList: {
        gap: spacing.xl,
    },
    squadMember: {
        alignItems: 'center',
        gap: spacing.sm,
    },
    squadMemberInactive: {
        opacity: 0.4,
    },
    squadAvatar: {
        width: 56,
        height: 56,
    },
    squadName: {
        fontSize: 10,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
        letterSpacing: 0.5,
    },

    // Gym Card
    gymCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    gymCardPressed: {
        backgroundColor: colors.glass.surfaceHover,
    },
    gymLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    gymName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    crowdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    crowdDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    crowdText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});

export default HomeScreen;
