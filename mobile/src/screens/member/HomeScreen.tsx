import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Pressable,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { useAuth } from '../../context/AuthContext';
import { useNutrition } from '../../context/NutritionContext';
import { memberAPI, workoutsAPI, caloriesAPI, friendsAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import AnimatedFire from '../../components/AnimatedFire';
import WeeklyProgress from '../../components/WeeklyProgress';
import NutritionAnalytics from '../../components/NutritionAnalytics';
import { SkeletonHomeScreen } from '../../components/Skeleton';
import EmptyState, { EmptyStateInline } from '../../components/EmptyState';
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

const HomeScreen: React.FC = () => {
    const { user } = useAuth();
    const { todayMacros, refreshToday } = useNutrition(); // Use global nutrition state
    const [data, setData] = useState<HomeData | null>(null);
    const [todayWorkouts, setTodayWorkouts] = useState<TodayWorkout[]>([]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeCount, setActiveCount] = useState(0);

    useEffect(() => {
        loadHomeData();
    }, []);

    useEffect(() => {
        const fetchActive = async () => {
            try {
                const feed = await workoutsAPI.getFeed();
                if (feed?.feed) {
                    const today = new Date().toISOString().split('T')[0];
                    const uniqueActive = new Set(
                        feed.feed
                            .filter((item: any) => item.logged_date.startsWith(today))
                            .map((item: any) => item.user_id)
                    );
                    setActiveCount(uniqueActive.size);
                }
            } catch (e) {
                // ignore
            }
        };
        fetchActive();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            console.log('🔄 HomeScreen focused, refreshing data...');
            const refreshData = async () => {
                try {
                    const [homeRes, workoutsRes, friendsRes] = await Promise.all([
                        memberAPI.getHome(),
                        workoutsAPI.getToday().catch(() => ({ workouts: [], summary: { count: 0, types: [] } })),
                        friendsAPI.getFriends().catch(() => ({ friends: [] })),
                    ]);
                    console.log('📥 Home data received:', { intent: homeRes?.intent });
                    setData(homeRes);
                    setTodayWorkouts(workoutsRes.workouts || []);
                    const fetchedFriends = friendsRes?.friends || [];
                    setFriends(fetchedFriends);
                } catch (error) {
                    console.error('Failed to load home data:', error);
                }
            };
            refreshData();
            refreshToday();
        }, [refreshToday])
    );

    const loadHomeData = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            // Updated Promise.all to exclude caloriesAPI fetch since it's now handled by context
            const [homeRes, workoutsRes, friendsRes] = await Promise.all([
                memberAPI.getHome(),
                workoutsAPI.getToday().catch(() => ({ workouts: [], summary: { count: 0, types: [] } })),
                friendsAPI.getFriends().catch(() => ({ friends: [] })),
            ]);
            setData(homeRes);
            setTodayWorkouts(workoutsRes.workouts || []);
            // todayCalories is now derived from context

            const fetchedFriends = friendsRes?.friends || [];
            setFriends(fetchedFriends);
        } catch (error) {
            console.error('Failed to load home data:', error);
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadHomeData(false); // Don't show skeleton during pull-to-refresh
        setRefreshing(false);
    };

    const handleIntentPress = () => {
        router.push('/workout-intent' as any);
    };

    // Time-based greeting
    const greeting = 'Consistency matters.';

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <SkeletonHomeScreen />
            </SafeAreaView>
        );
    }

    const firstName = data?.user?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'there';
    const hasLoggedWorkoutToday = todayWorkouts.length > 0;
    const currentIntent = data?.intent;
    const activeFriendsCount = activeCount;
    
    console.log('🎯 Current intent state:', currentIntent ? JSON.stringify(currentIntent) : 'NULL');

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
                <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.header}>
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

                    {/* Right side: Check-in + Streak */}
                    <View style={styles.headerRight}>
                        {/* QR Check-in Button */}
                        <TouchableOpacity
                            style={styles.checkinBadge}
                            onPress={() => router.push('/qr-checkin' as any)}
                            accessibilityLabel="QR Check-in"
                        >
                            <MaterialIcons name="qr-code-2" size={20} color={colors.text.primary} />
                        </TouchableOpacity>

                        {/* Streak Badge */}
                        <View style={styles.streakBadge}>
                            <AnimatedFire size={24} color="#FF6B35" />
                            <Text style={styles.streakText}>{data?.streak.current || 0}</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Today's Training - Large Typography */}
                {/* Today's Training - Large Typography */}
                <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
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
                                `${(currentIntent.emphasis?.[0] || 'Training').toUpperCase()} • ${currentIntent.training_pattern || 'Session'}`
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
                </Animated.View>

                {/* Completed Workout Card - Show when workout is logged today */}
                {hasLoggedWorkoutToday && (
                    <View style={styles.activeSessionCard}>
                        <View style={styles.inProgressPill}>
                            <MaterialIcons name="check-circle" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                            <Text style={styles.inProgressText}>COMPLETED TODAY</Text>
                        </View>

                        <View style={styles.statsGrid}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>WORKOUTS</Text>
                                <Text style={styles.statValue}>{todayWorkouts.length}</Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>CALORIES LOGGED</Text>
                                <Text style={styles.statValue}>{todayMacros.calories}<Text style={styles.statUnit}>kcal</Text></Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Quick Action Buttons */}
                <Animated.View entering={FadeInDown.delay(200).duration(600).springify()} style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={() => router.push('/log/workout' as any)}
                        accessibilityLabel="Log workout"
                    >
                        <MaterialIcons name="add" size={20} color={colors.text.dark} />
                        <Text style={styles.primaryActionText}>LOG WORKOUT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={() => router.push('/log/calories' as any)}
                        accessibilityLabel="Log calories"
                    >
                        <MaterialIcons name="add" size={20} color={colors.text.dark} />
                        <Text style={styles.primaryActionText}>LOG CALORIES</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Nutrition Summary with Macros */}
                <Animated.View entering={FadeInDown.delay(300).duration(600).springify()} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today's Nutrition</Text>
                        <TouchableOpacity onPress={() => router.push('/log/calories' as any)}>
                            <Text style={styles.viewAllLink}>LOG FOOD</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/log/calories' as any)} activeOpacity={0.8}>
                        <MacroPieChart
                            calories={todayMacros.calories || 0}
                            calorieTarget={2000}
                            protein={todayMacros.protein || 0}
                            proteinTarget={150}
                            carbs={todayMacros.carbs || 0}
                            carbsTarget={200}
                            fat={todayMacros.fat || 0}
                            fatTarget={65}
                        />
                    </TouchableOpacity>
                </Animated.View>

                {/* Weekly Workout Progress */}
                <View style={styles.section}>
                    <WeeklyProgress history={data?.streak.history || []} />
                </View>

                {/* Weekly Nutrition Analytics - Lose It Style */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Nutrition History</Text>
                    </View>
                    <WeeklyCharts />
                </View>

                {/* Gym Buddies - Friend Avatars */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>Gym Buddies</Text>
                            <Text style={styles.sectionSub}>{activeFriendsCount} of your gym squads worked out today</Text>
                        </View>
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
                            <EmptyStateInline
                                message="No buddies added yet."
                                icon="person-add"
                                style={{ paddingVertical: 10 }}
                            />
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

                {/* Continuing Learning Card */}
                {data?.learn && (
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
                                <Text style={styles.learningTitle}>{data.learn.title}</Text>
                                <Text style={styles.learningMeta}>
                                    {data.learn.lesson} • {data.learn.topic}
                                </Text>
                                <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, { width: `${data.learn.progress}%` }]} />
                                </View>
                            </View>
                        </Pressable>
                    </View>
                )}

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
    checkinBadge: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        justifyContent: 'center',
        alignItems: 'center',
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
    sectionSub: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: 4,
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
    welcomeCard: {
        marginBottom: spacing['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.primary + '30',
        ...shadows.glowMd,
    },
    welcomeInfo: {
        flexDirection: 'row',
        gap: spacing.lg,
        alignItems: 'flex-start',
        marginBottom: spacing.xl,
    },
    welcomeIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    welcomeTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: 4,
    },
    welcomeDesc: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    welcomeActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    welcomeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
    },
    welcomeButtonText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 1,
    },
});

export default HomeScreen;
