import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Pressable,
    Platform,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../../context/AuthContext';
import { useNutrition } from '../../context/NutritionContext';
import { useOfflineStore } from '../../stores/offlineStore';
import { memberAPI, workoutsAPI, caloriesAPI, friendsAPI, intentAPI, aiAPI, healthAPI, checkinAPI } from '../../services/api';
import { isHealthAvailable, getTodaysSummary } from '../../services/healthService';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import { useToast } from '../../components/Toast';
import CrowdIndicator from '../../components/CrowdIndicator';
import AnimatedFire from '../../components/AnimatedFire';
import WeeklyProgress from '../../components/WeeklyProgress';
import NutritionAnalytics from '../../components/NutritionAnalytics';
import { SkeletonHomeScreen } from '../../components/Skeleton';
import EmptyState, { EmptyStateInline } from '../../components/EmptyState';
import MacroPieChart from '../../components/MacroPieChart';
import ProgressRing from '../../components/ProgressRing';
import CustomRefreshHeader from '../../components/CustomRefreshHeader';
import BusyTimesStrip from '../../components/BusyTimesStrip';
import { gymAPI, BusyTimes } from '../../services/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

interface HomeData {
    user: {
        name: string;
        avatar_url: string | null;
        xp_points: number;
    };
    gym: {
        name: string;
        capacity?: number;
    } | null;
    crowd: {
        level: 'low' | 'medium' | 'high';
        count: number;
        percentage: number;
        capacity: number;
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
    learn?: {
        id: string;
        title: string;
        lesson: string;
        topic: string;
        progress: number;
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
    const { todayMacros, calorieGoal, macroTargets, refreshToday } = useNutrition();
    const toast = useToast();
    const [data, setData] = useState<HomeData | null>(null);
    const [todayWorkouts, setTodayWorkouts] = useState<TodayWorkout[]>([]);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeCount, setActiveCount] = useState(0);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [suggestion, setSuggestion] = useState<{
        day_name: string;
        day_index: number;
        split_name: string;
        split_id: string;
        split_days: string[];
        days_per_week: number;
    } | null>(null);
    const [suggestionReason, setSuggestionReason] = useState<string | null>(null);
    const [settingIntent, setSettingIntent] = useState(false);
    const [dailyInsight, setDailyInsight] = useState<string | null>(null);
    // The catch below used to swallow every failure and fall back to cache
    // silently. With no cache that rendered a fully-populated-looking screen of
    // zeros, which the user believes. Track the failure explicitly instead.
    const [error, setError] = useState<'offline' | 'error' | null>(null);
    const [isStale, setIsStale] = useState(false);
    const [busyTimes, setBusyTimes] = useState<BusyTimes | null>(null);
    const [checkingOut, setCheckingOut] = useState(false);

    useEffect(() => {
        // Show progressive loading messages for cold start
        const timer1 = setTimeout(() => {
            if (loading) setLoadingMessage('Connecting to server...');
        }, 2000);
        const timer2 = setTimeout(() => {
            if (loading) setLoadingMessage('Server is waking up, hang tight...');
        }, 6000);
        const timer3 = setTimeout(() => {
            if (loading) setLoadingMessage('Almost there...');
        }, 15000);
        loadHomeData();
        return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
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
            } catch {
                // Non-critical - silently fail
            }
        };
        fetchActive();
    }, []);

    useEffect(() => {
        if (!user?.gym_id) return;
        gymAPI.getBusyTimes(user.gym_id)
            .then((r) => setBusyTimes(r.busy_times))
            .catch(() => setBusyTimes(null));
    }, [user?.gym_id]);

    useFocusEffect(
        React.useCallback(() => {
            const store = useOfflineStore.getState();
            if (store.isHomeStale()) {
                loadHomeData();
            } else {
                const cached = store.getHomeData();
                if (cached) {
                    // Use cached data to set state
                    setData(cached as any);
                } else {
                    loadHomeData();
                }
            }
            refreshToday();
        }, [refreshToday])
    );

    const syncWearableData = async () => {
        if (!isHealthAvailable()) return;
        try {
            const summary = await getTodaysSummary();
            if (summary.steps > 0 || summary.activeCalories > 0) {
                await healthAPI.sync({
                    steps: summary.steps,
                    active_calories: summary.activeCalories,
                    resting_heart_rate: summary.restingHeartRate,
                    sleep_hours: summary.sleepHours,
                    source: Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'
                });
                console.log('🔄 Wearable data background auto-sync completed');
            }
        } catch (err: any) {
            console.log('Wearable background auto-sync skipped:', err.message);
        }
    };

    const loadHomeData = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        try {
            // Updated Promise.all to exclude caloriesAPI fetch since it's now handled by context
            const [homeRes, workoutsRes, friendsRes, suggestRes, dailyRes] = await Promise.all([
                memberAPI.getHome(),
                workoutsAPI.getToday().catch(() => ({ workouts: [], summary: { count: 0, types: [] } })),
                friendsAPI.getFriends().catch(() => ({ friends: [] })),
                intentAPI.getSuggestion().catch(() => ({ suggestion: null, reason: null })),
                aiAPI.getDailyInsight().catch(() => ({ success: false, insight: null }))
            ]);
            setData(homeRes);
            setTodayWorkouts(workoutsRes.workouts || []);
            // todayCalories is now derived from context

            // Set smart suggestion
            setSuggestion(suggestRes?.suggestion || null);
            setSuggestionReason(suggestRes?.reason || null);

            const fetchedFriends = friendsRes?.friends || [];
            setFriends(fetchedFriends);

            if (dailyRes?.success && dailyRes?.insight) {
                setDailyInsight(dailyRes.insight);
            }

            // Cache home data in offline store for staleness checking
            useOfflineStore.getState().cacheHomeData(homeRes);
            setIsStale(false);
            setError(null);
            syncWearableData().catch(() => {});
        } catch (e: any) {
            const offline = e?.code === 'NETWORK_ERROR' || e?.code === 'TIMEOUT' || e?.status === 0;
            const cached = useOfflineStore.getState().getHomeData();
            if (cached) {
                // Serve the cached screen, but mark it so stale numbers are never
                // mistaken for live ones.
                setData(cached as any);
                setIsStale(true);
                setError(null);
            } else {
                setError(offline ? 'offline' : 'error');
            }
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    const retry = () => {
        setLoading(true);
        setError(null);
        loadHomeData();
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadHomeData(false); // Don't show skeleton during pull-to-refresh
        setRefreshing(false);
    };

    const handleIntentPress = () => {
        if (suggestion && !currentIntent) {
            // Has a suggestion but no intent set — go to intent screen with suggestion pre-loaded
            router.push({
                pathname: '/workout-intent' as any,
                params: { suggestedIndex: suggestion.day_index.toString() },
            });
        } else {
            router.push('/workout-intent' as any);
        }
    };

    const handleQuickConfirm = async () => {
        if (!suggestion || settingIntent) return;
        setSettingIntent(true);
        try {
            await intentAPI.setIntent({
                training_pattern: suggestion.split_id || 'custom',
                emphasis: [suggestion.day_name],
                session_label: suggestion.day_name,
                visibility: 'friends',
            });
            // Refresh home data to show the confirmed intent
            await loadHomeData(false);
        } catch {
            // Fall back to full intent screen
            router.push('/workout-intent' as any);
        } finally {
            setSettingIntent(false);
        }
    };

    const handleCheckout = async () => {
        if (checkingOut) return;
        setCheckingOut(true);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await checkinAPI.checkout();
            toast.success('Checked out', 'See you next time.');
            loadHomeData(false);
        } catch (error: any) {
            toast.error('Error', error.message || 'Could not check out');
        } finally {
            setCheckingOut(false);
        }
    };

    // Time-based greeting
    const greeting = 'Consistency matters.';

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <SkeletonHomeScreen />
                {loadingMessage ? (
                    <View style={styles.loadingBanner}>
                        <Text style={styles.loadingBannerText}>{loadingMessage}</Text>
                    </View>
                ) : null}
            </SafeAreaView>
        );
    }

    // Nothing loaded and nothing cached — there is no honest screen to draw, so
    // say so and offer a way out instead of rendering a shell of zeros.
    if (error && !data) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <EmptyState variant={error} onAction={retry} />
            </SafeAreaView>
        );
    }

    const firstName = data?.user?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'there';
    const hasLoggedWorkoutToday = todayWorkouts.length > 0;
    const currentIntent = data?.intent;
    const activeFriendsCount = activeCount;

    // `learn.progress` is a 0-100 integer from the API (Math.round(done/total*100)),
    // but arrives as null when a unit has no lessons — division by zero there
    // serialises NaN to null. It used to be interpolated straight into a width
    // string. Clamp and default; build the meta line with filter(Boolean) so an
    // empty lesson or topic cannot leave a dangling bullet.
    const rawLearnProgress = data?.learn?.progress;
    const learnPct = Number.isFinite(rawLearnProgress)
        ? Math.max(0, Math.min(100, Math.round(rawLearnProgress as number)))
        : 0;
    const learnStarted = learnPct > 0;
    const learnMeta = [data?.learn?.lesson, data?.learn?.topic].filter(Boolean).join(' • ');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {isStale && (
                <View style={styles.staleBanner}>
                    <MaterialIcons name="cloud-off" size={14} color={colors.text.muted} />
                    <Text style={styles.staleBannerText}>Offline — showing saved data</Text>
                    <Pressable onPress={retry} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retry loading">
                        <Text style={styles.staleBannerAction}>RETRY</Text>
                    </Pressable>
                </View>
            )}
            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="transparent"
                        colors={['transparent']}
                        progressBackgroundColor="transparent"
                    />
                }
            >
                <CustomRefreshHeader refreshing={refreshing} />

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

                    {/* Right side: Coach + Check-in + Streak */}
                    <View style={styles.headerRight}>
                        {/* AI Coach Button */}
                        <TouchableOpacity
                            style={styles.checkinBadge}
                            onPress={() => router.push('/ai-coach' as any)}
                            accessibilityLabel="AI Coach"
                        >
                            <MaterialIcons name="auto-awesome" size={20} color={colors.text.primary} />
                        </TouchableOpacity>

                        {/* QR Check-in / Check-out */}
                        {data?.checkin.status === 'checked_in' ? (
                            <TouchableOpacity
                                style={styles.checkinBadge}
                                onPress={handleCheckout}
                                disabled={checkingOut}
                                accessibilityLabel="Check out of gym"
                                accessibilityRole="button"
                            >
                                <MaterialIcons
                                    name="logout"
                                    size={20}
                                    color={checkingOut ? colors.text.muted : colors.text.primary}
                                />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.checkinBadge}
                                onPress={() => router.push('/qr-checkin' as any)}
                                accessibilityLabel="QR Check-in"
                                accessibilityRole="button"
                            >
                                <MaterialIcons name="qr-code-2" size={20} color={colors.text.primary} />
                            </TouchableOpacity>
                        )}

                        {/* Streak Badge */}
                        <View style={styles.streakBadge}>
                            <AnimatedFire size={24} color="#FF6B35" />
                            <Text style={styles.streakText}>{data?.streak.current || 0}</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Daily AI Note — taps through to the coach chat */}
                {dailyInsight && (
                    <Animated.View entering={FadeInDown.delay(50).duration(600).springify()}>
                        <Pressable
                            onPress={() => router.push('/ai-coach' as any)}
                            accessibilityLabel="Open AI Coach chat"
                            accessibilityRole="button"
                        >
                            <GlassCard style={styles.insightCard}>
                                <View style={styles.insightHeader}>
                                    <MaterialIcons name="insights" size={18} color={colors.primary} />
                                    <Text style={styles.insightTitle}>COACH'S DAILY INSIGHT</Text>
                                    <View style={{ flex: 1 }} />
                                    <MaterialIcons name="chevron-right" size={18} color={colors.text.muted} />
                                </View>
                                <Text style={styles.insightMessage}>{dailyInsight}</Text>
                                <Text style={styles.insightAskHint}>Ask your coach anything →</Text>
                            </GlassCard>
                        </Pressable>
                    </Animated.View>
                )}

                {/* Today's Training - Smart Suggestion */}
                <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
                    {currentIntent ? (
                        /* Intent already set — compact confirmed card */
                        <Pressable
                            style={styles.intentCard}
                            onPress={handleIntentPress}
                            accessibilityLabel="View or change workout intent"
                            accessibilityRole="button"
                        >
                            <View style={styles.intentCardLeft}>
                                <View style={styles.intentDayBadge}>
                                    <Text style={styles.intentDayText}>
                                        {(currentIntent.emphasis?.[0] || 'Training').toUpperCase()}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={styles.intentCardLabel}>Today's Training</Text>
                                    {suggestion && currentIntent.training_pattern && (
                                        <Text style={styles.intentCardSplit}>{suggestion.split_name}</Text>
                                    )}
                                </View>
                            </View>
                            <MaterialIcons name="edit" size={16} color={colors.text.muted} />
                        </Pressable>
                    ) : suggestion ? (
                        /* No intent yet, but we have a smart suggestion — compact card */
                        <View style={styles.intentCard}>
                            <View style={styles.intentCardLeft}>
                                <View style={styles.intentDayBadge}>
                                    <Text style={styles.intentDayText}>
                                        {suggestion.day_name.toUpperCase()}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={styles.intentCardLabel}>
                                        {suggestionReason === 'next_in_cycle' ? 'Next up' :
                                         suggestionReason === 'long_break' ? 'Welcome back' :
                                         'Today\'s Training'}
                                    </Text>
                                    <Text style={styles.intentCardSplit}>{suggestion.split_name}</Text>
                                </View>
                            </View>
                            <View style={styles.intentCardActions}>
                                <TouchableOpacity
                                    style={styles.intentConfirmBtn}
                                    onPress={handleQuickConfirm}
                                    disabled={settingIntent}
                                >
                                    <Text style={styles.intentConfirmText}>
                                        {settingIntent ? '...' : "Let's Go"}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleIntentPress} style={styles.intentChangeBtn}>
                                    <MaterialIcons name="swap-horiz" size={18} color={colors.text.muted} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        /* No split set up at all — compact prompt */
                        <Pressable
                            style={styles.intentCard}
                            onPress={handleIntentPress}
                            accessibilityLabel="Set up your workout split"
                            accessibilityRole="button"
                        >
                            <View style={styles.intentCardLeft}>
                                <View style={[styles.intentDayBadge, styles.intentDayBadgeMuted]}>
                                    <MaterialIcons name="fitness-center" size={18} color={colors.text.muted} />
                                </View>
                                <View>
                                    <Text style={styles.intentCardLabel}>Today's Training</Text>
                                    <Text style={styles.intentCardSplit}>Set up your split</Text>
                                </View>
                            </View>
                            <View style={styles.tapHintPill}>
                                <Text style={styles.tapHintText}>SET UP</Text>
                            </View>
                        </Pressable>
                    )}
                </Animated.View>

                {/* Gym Crowd - live green/yellow/red occupancy light */}
                <Animated.View entering={FadeInDown.delay(150).duration(600).springify()}>
                    {data?.gym && data?.crowd ? (
                        <GlassCard style={styles.gymStatusCard}>
                            <View style={styles.gymStatusTop}>
                                <View style={styles.gymStatusLeft}>
                                    <CrowdIndicator level={data.crowd.level} size="sm" showLabel={false} />
                                    <View>
                                        <Text style={styles.gymStatusName}>{data.gym.name}</Text>
                                        <Text style={styles.gymStatusSub}>
                                            {data.crowd.count} of {data.crowd.capacity} training now
                                        </Text>
                                    </View>
                                </View>
                                <Text
                                    style={[
                                        styles.gymStatusPct,
                                        { color: colors.crowd[data.crowd.level] },
                                    ]}
                                >
                                    {data.crowd.percentage}%
                                </Text>
                            </View>
                            <View style={styles.gymStatusBar}>
                                <View
                                    style={[
                                        styles.gymStatusBarFill,
                                        {
                                            width: `${Math.max(data.crowd.percentage, 3)}%`,
                                            backgroundColor: colors.crowd[data.crowd.level],
                                        },
                                    ]}
                                />
                            </View>
                        </GlassCard>
                    ) : null}
                </Animated.View>

                {busyTimes && (
                    <View style={{ marginTop: spacing.md }}>
                        <BusyTimesStrip
                            grid={busyTimes.grid}
                            quietest={busyTimes.quietest}
                            confidence={busyTimes.confidence}
                        />
                    </View>
                )}

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

                {/* Quick Action Buttons
                    One primary only. Two identical white CTAs (plus the tab-bar FAB
                    and the "Let's Go" pill) meant nothing was actually primary, and
                    users resolved the tie by thumb proximity rather than intent.

                    The primary is context-aware: before an intent is set the useful
                    next step is declaring the session; once it is set, it is logging
                    the work. Previously the label said LOG WORKOUT but routed to the
                    planning screen, disagreeing with the FAB of the same name. */}
                <Animated.View entering={FadeInDown.delay(200).duration(600).springify()} style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.primaryActionBtn}
                        onPress={() => router.push((currentIntent ? '/log/workout' : '/workout-intent') as any)}
                        accessibilityLabel={currentIntent ? 'Log workout' : 'Start training'}
                        accessibilityRole="button"
                    >
                        <MaterialIcons
                            name={currentIntent ? 'add' : 'bolt'}
                            size={20}
                            color={colors.text.dark}
                        />
                        <Text style={styles.primaryActionText}>
                            {currentIntent ? 'LOG WORKOUT' : 'START TRAINING'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryActionBtn}
                        onPress={() => router.push('/log/calories' as any)}
                        accessibilityLabel="Log calories"
                        accessibilityRole="button"
                    >
                        <MaterialIcons name="add" size={20} color={colors.text.primary} />
                        <Text style={styles.secondaryActionText}>LOG CALORIES</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Today — nutrition + weekly activity in one block (simplified) */}
                <Animated.View entering={FadeInDown.delay(300).duration(600).springify()} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Today</Text>
                        <TouchableOpacity onPress={() => router.push('/log/calories' as any)}>
                            <Text style={styles.viewAllLink}>LOG FOOD</Text>
                        </TouchableOpacity>
                    </View>
                    <MacroPieChart
                        calories={todayMacros.calories || 0}
                        calorieTarget={calorieGoal}
                        protein={todayMacros.protein || 0}
                        proteinTarget={macroTargets.protein}
                        carbs={todayMacros.carbs || 0}
                        carbsTarget={macroTargets.carbs}
                        fat={todayMacros.fat || 0}
                        fatTarget={macroTargets.fat}
                    />
                    <View style={{ marginTop: spacing.md }}>
                        <WeeklyProgress history={data?.streak.history || []} />
                    </View>
                    <TouchableOpacity
                        style={styles.insightsButton}
                        onPress={() => router.push('/member/nutrition-insights' as any)}
                    >
                        <MaterialIcons name="insights" size={16} color={colors.primary} />
                        <Text style={styles.insightsButtonText}>View Detailed Insights</Text>
                        <MaterialIcons name="chevron-right" size={18} color={colors.text.muted} />
                    </TouchableOpacity>
                </Animated.View>

                {/* Continue Learning
                    Was buried dead-last above a 120px spacer, roughly two screens
                    down. Also gated on `progress > 0`, which hid it from exactly
                    the new users who needed to discover that Fitzo teaches. Now it
                    sits above Gym Buddies and handles both states. */}
                {data?.learn && (
                    <Animated.View
                        entering={FadeInDown.delay(350).duration(600).springify()}
                        style={styles.section}
                    >
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>
                                {learnStarted ? 'Continue Learning' : 'Start Learning'}
                            </Text>
                            <TouchableOpacity
                                onPress={() => router.push('/(tabs)/learn' as any)}
                                hitSlop={12}
                                accessibilityRole="button"
                                accessibilityLabel="View all lessons"
                            >
                                <Text style={styles.viewAllLink}>VIEW ALL</Text>
                            </TouchableOpacity>
                        </View>

                        <Pressable
                            style={({ pressed }) => [styles.learningCard, pressed && styles.learningCardPressed]}
                            onPress={() => data?.learn?.id && router.push(`/lesson/${data.learn.id}` as any)}
                            accessibilityRole="button"
                            accessibilityLabel={
                                learnStarted
                                    ? `Resume ${data.learn.title}, ${learnPct}% complete`
                                    : `Start ${data.learn.title}`
                            }
                        >
                            <ProgressRing progress={learnPct} size={72} showLabel={learnStarted} />

                            <View style={styles.learningContent}>
                                <Text style={styles.learningTitle} numberOfLines={2}>
                                    {data.learn.title}
                                </Text>
                                {learnMeta ? (
                                    <Text style={styles.learningMeta} numberOfLines={1}>
                                        {learnMeta}
                                    </Text>
                                ) : null}
                                <Text style={styles.learningProgressLabel}>
                                    {learnStarted ? `${learnPct}% complete` : 'Not started yet'}
                                </Text>
                            </View>

                            <View style={styles.learningCta}>
                                <Text style={styles.learningCtaText}>
                                    {learnStarted ? 'RESUME' : 'START'}
                                </Text>
                            </View>
                        </Pressable>
                    </Animated.View>
                )}

                {/* Gym Buddies - Friend Avatars */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>Gym Buddies</Text>
                            <Text style={styles.sectionSub}>{activeFriendsCount} of your gym squads worked out today</Text>
                        </View>
                        <TouchableOpacity onPress={() => router.push('/member/squad-feed' as any)}>
                            <Text style={styles.viewAllLink}>VIEW FEED</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.squadList}
                    >
                        {friends.length > 0 ? (
                            friends.map((friend) => (
                                <TouchableOpacity
                                    key={friend.id}
                                    style={styles.squadMember}
                                    onPress={() => router.push({
                                        pathname: '/member/user-profile' as any,
                                        params: {
                                            userId: friend.id,
                                            userName: friend.name,
                                            userAvatar: friend.avatar_url || ''
                                        }
                                    })}
                                >
                                    <View style={styles.squadAvatar}>
                                        <Avatar size="lg" uri={friend.avatar_url} name={friend.name} />
                                    </View>
                                    <Text style={styles.squadName} numberOfLines={1}>
                                        {(friend.name || 'Friend').split(' ')[0]}
                                    </Text>
                                </TouchableOpacity>
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

    // Today's Training — compact card
    intentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.lg,
        marginBottom: spacing['2xl'],
    },
    intentCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
    },
    intentDayBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        minWidth: 56,
        alignItems: 'center',
    },
    intentDayBadgeMuted: {
        backgroundColor: colors.glass.surfaceLight,
    },
    intentDayText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 0.5,
    },
    intentCardLabel: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    intentCardSplit: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: 2,
    },
    intentCardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    intentConfirmBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
    },
    intentConfirmText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 0.5,
    },
    intentChangeBtn: {
        padding: spacing.xs,
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
    // Nutrition insights button
    insightsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        marginTop: spacing.md,
        gap: spacing.sm,
    },
    insightsButtonText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.primary,
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
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
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
    insightsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    insightsLinkLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    insightsLinkText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },

    // Learning Card
    learningCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        // Was spacing.sm (8) while every neighbouring card uses 16, which made
        // this card read visibly tighter and cheaper than its siblings.
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    learningCardPressed: {
        backgroundColor: colors.glass.surfaceHover,
        borderColor: colors.glass.borderHover,
    },
    learningContent: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    learningProgressLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginTop: spacing.xs,
    },
    learningCta: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        backgroundColor: colors.glass.surfaceLight,
    },
    learningCtaText: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: 1,
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
    gymStatusCard: {
        marginBottom: spacing.lg,
    },
    gymStatusTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    gymStatusLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
    },
    gymStatusName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    gymStatusSub: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },
    gymStatusPct: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        letterSpacing: typography.letterSpacing.tighter,
    },
    gymStatusBar: {
        height: 6,
        backgroundColor: colors.glass.surface,
        borderRadius: 3,
        marginTop: spacing.md,
        overflow: 'hidden',
    },
    gymStatusBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    joinGymCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
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

    // Loading banner
    staleBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.glass.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    staleBannerText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    staleBannerAction: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: 1,
    },
    loadingBanner: {
        position: 'absolute',
        bottom: 100,
        left: spacing.xl,
        right: spacing.xl,
        backgroundColor: colors.glass.surfaceHover,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        alignItems: 'center',
    },
    loadingBannerText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        letterSpacing: 0.5,
    },
    insightCard: {
        marginBottom: spacing.lg,
        padding: spacing.md,
        borderColor: colors.primary + '25',
        borderWidth: 1,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    insightTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        letterSpacing: 1,
    },
    insightMessage: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        lineHeight: 18,
    },
    insightAskHint: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        marginTop: spacing.sm,
        letterSpacing: 0.5,
    },
});

export default HomeScreen;
