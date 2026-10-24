import ScreenBackdrop from '../../components/ScreenBackdrop';
import RecoveryCheckIn from '../../components/RecoveryCheckIn';
import { isHealthImportEnabled } from '../../utils/healthImportPreference';
import React, { useState, useEffect, useRef } from 'react';
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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from '../../utils/haptics';

import { useAuth } from '../../context/AuthContext';
import { useNutrition } from '../../context/NutritionContext';
import { useOfflineStore } from '../../stores/offlineStore';
import { memberAPI, workoutsAPI, caloriesAPI, friendsAPI, intentAPI, aiAPI, checkinAPI } from '../../services/api';
import { isHealthAvailable } from '../../services/healthService';
import { syncHealthDays } from '../../services/healthSync';
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
import ProgressRing from '../../components/ProgressRing';
import CustomRefreshHeader from '../../components/CustomRefreshHeader';
import BusyTimesStrip from '../../components/BusyTimesStrip';
import { gymAPI, BusyTimes } from '../../services/api';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { firstName as getFirstName, displayName } from '../../utils/displayName';
import AIConsentModal, { getAIConsent } from '../../components/AIConsentModal';
import { loadActiveWorkoutDraft } from '../../utils/activeWorkoutDraft';
import type { ActiveWorkoutDraft } from '../../utils/activeWorkoutDraft';
import { useMemberContentInset } from '../../components/navigation/MemberChromeContext';
import { useMemberTabScroll } from '../../hooks/useMemberTabScroll';
import { useLocalDay } from '../../hooks/useLocalDay';
import { localDiaryDate } from '../../utils/foodDiary';

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

const HomeScreen: React.FC<{ trainingOnly?: boolean }> = ({ trainingOnly = false }) => {
    const localDay = useLocalDay();
    const homeRequest = useRef(0);
    const contentInset = useMemberContentInset();
    const onScroll = useMemberTabScroll();
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
    const [aiConsentModalVisible, setAiConsentModalVisible] = useState(false);
    const [aiConsented, setAiConsented] = useState<boolean>(false);
    // The catch below used to swallow every failure and fall back to cache
    // silently. With no cache that rendered a fully-populated-looking screen of
    // zeros, which the user believes. Track the failure explicitly instead.
    const [error, setError] = useState<'offline' | 'error' | null>(null);
    const [isStale, setIsStale] = useState(false);
    const [busyTimes, setBusyTimes] = useState<BusyTimes | null>(null);
    const [checkingOut, setCheckingOut] = useState(false);
    const [activeWorkout, setActiveWorkout] = useState<{ userId: string; draft: ActiveWorkoutDraft } | null>(null);
    useFocusEffect(React.useCallback(() => {
        let active = true;
        setActiveWorkout(null);
        if (user?.id) void loadActiveWorkoutDraft(user.id).then(draft => {
            if (active && draft?.exercises.length) setActiveWorkout({ userId: user.id, draft });
        }).catch(() => {});
        return () => { active = false; };
    }, [user?.id]));
    /** Readable from inside the mount effect's timers, which `loading` is not. */
    const stillLoading = useRef(true);

    useEffect(() => {
        setData(null);
        setTodayWorkouts([]);
        setFriends([]);
        setActiveCount(0);
        setDailyInsight(null);
        // These used to read `if (loading)`, but `loading` is captured from the first
        // render inside a `[]` effect — a stale closure that is `true` forever, so the
        // guard never did anything. A ref actually tracks it.
        //
        // The copy changed too. The old messages blamed a cold start ("Server is waking
        // up"), which was almost always a lie: the home screen was waiting on a Gemini
        // call, not on Render. With that off the critical path this screen resolves in
        // well under a second, so a slow load now means a slow network — say that, and
        // only once it is genuinely slow.
        const timer1 = setTimeout(() => {
            if (stillLoading.current) setLoadingMessage('Still loading…');
        }, 5000);
        const timer2 = setTimeout(() => {
            if (stillLoading.current) setLoadingMessage('Slow connection — hang tight…');
        }, 12000);
        loadHomeData();
        return () => { homeRequest.current++; clearTimeout(timer1); clearTimeout(timer2); };
    }, [localDay]);

    useEffect(() => {
        if (trainingOnly || !user?.gym_id) return;
        gymAPI.getBusyTimes(user.gym_id)
            .then((r) => setBusyTimes(r.busy_times))
            .catch(() => setBusyTimes(null));
    }, [user?.gym_id, trainingOnly]);

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
        if (!isHealthAvailable() || !await isHealthImportEnabled(user?.id)) return;
        try {
            if (user?.id) await syncHealthDays(user.id);
        } catch (err: any) {
            console.log('Wearable sync skipped:', err.message);
        }
    };

    const loadHomeData = async (showLoader = true) => {
        const revision = ++homeRequest.current;
        const requestDay = localDiaryDate();
        if (showLoader) setLoading(true);
        try {
            // Updated Promise.all to exclude caloriesAPI fetch since it's now handled by context
            const [homeRes, workoutsRes, friendsRes, suggestRes] = await Promise.all([
                memberAPI.getHome(),
                workoutsAPI.getToday().catch(() => ({ workouts: [], summary: { count: 0, types: [] } })),
                trainingOnly ? Promise.resolve({ friends: [] }) : friendsAPI.getFriends().catch(() => ({ friends: [] })),
                intentAPI.getSuggestion().catch(() => ({ suggestion: null, reason: null })),
            ]);
            if (revision !== homeRequest.current || requestDay !== localDiaryDate()) return;

            // Only query Google Gemini for daily insights if user explicitly granted AI consent (Apple 5.1.1(i) / 5.1.2(i))
            const consented = await getAIConsent();
            if (revision !== homeRequest.current || requestDay !== localDiaryDate()) return;
            setAiConsented(consented);
            if (consented && !trainingOnly) {
                aiAPI.getDailyInsight()
                    .then((r) => { if (revision === homeRequest.current && requestDay === localDiaryDate() && r?.success && r?.insight) setDailyInsight(r.insight); })
                    .catch(() => {});
            } else {
                setDailyInsight(null);
            }
            setData(homeRes);
            setTodayWorkouts(workoutsRes.workouts || []);
            // todayCalories is now derived from context

            // Set smart suggestion
            setSuggestion(suggestRes?.suggestion || null);
            setSuggestionReason(suggestRes?.reason || null);

            const fetchedFriends = friendsRes?.friends || [];
            setFriends(fetchedFriends);
            setActiveCount(fetchedFriends.filter((friend: { worked_out_today?: boolean }) => friend.worked_out_today).length);

            // Cache home data in offline store for staleness checking
            useOfflineStore.getState().cacheHomeData(homeRes);
            setIsStale(false);
            setError(null);
            syncWearableData().catch(() => {});
        } catch (e: any) {
            if (revision !== homeRequest.current || requestDay !== localDiaryDate()) return;
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
            if (revision === homeRequest.current) {
                stillLoading.current = false;
                if (showLoader) setLoading(false);
            }
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
            router.push({ pathname: '/log/workout', params: { intent: JSON.stringify({
                training_pattern: suggestion.split_id || 'custom',
                emphasis: [suggestion.day_name], session_label: suggestion.day_name,
            }) } });
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
    const greeting = trainingOnly ? 'Workout' : 'Today';

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenBackdrop />
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
            <ScreenBackdrop />
                <EmptyState variant={error} onAction={retry} />
            </SafeAreaView>
        );
    }

    // Registration takes `name` as free text, so some accounts store an email
    // there. getFirstName() keeps the address off the greeting.
    const greetingName = getFirstName(data?.user || user);
    const hasLoggedWorkoutToday = todayWorkouts.length > 0;
    const currentIntent = data?.intent;
    const hasActiveWorkout = !!activeWorkout && activeWorkout.userId === user?.id;
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
            <ScreenBackdrop />
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
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, trainingOnly && { paddingBottom: contentInset }]}
                onScroll={onScroll}
                scrollEventThrottle={16}
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

                {!trainingOnly && activeWorkout?.userId === user?.id && activeWorkout && <TouchableOpacity
                    accessibilityRole="button" accessibilityLabel="Resume workout"
                    onPress={() => router.push('/log/workout')}
                    style={styles.resumeWorkout}
                >
                    <MaterialIcons name="play-circle-outline" size={28} color={colors.accent.sky} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.resumeTitle}>Resume workout</Text>
                        <Text style={styles.resumeDetail} numberOfLines={1}>{activeWorkout.draft.intent.session_label} · {activeWorkout.draft.exercises.length} exercises saved</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={colors.text.secondary} />
                </TouchableOpacity>}

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
                                name={data?.user.name || user?.name}
                                size="md"
                            />
                            <View style={styles.verifiedBadge}>
                                <MaterialIcons name="verified" size={12} color={colors.primary} />
                            </View>
                        </View>
                        <View style={styles.greetingContainer}>
                            <Text style={styles.welcomeText} numberOfLines={1}>{greeting}</Text>
                            <Text style={styles.userName} numberOfLines={1}>{greetingName}</Text>
                        </View>
                    </Pressable>

                    {/* Right side: Coach + Check-in + Streak */}
                    <View style={styles.headerRight}>
                        {/* AI Coach Button */}
                        <TouchableOpacity
                            style={[styles.checkinBadge, styles.spotterBadge]}
                            onPress={() => router.push({ pathname: '/ai-coach', params: { source: 'workout', prompt: 'Help me review my recent training.' } })}
                            accessibilityLabel="Open Spotter"
                            accessibilityRole="button"
                            accessibilityHint="Open Spotter for help with training, food and recovery"
                        >
                            <Ionicons name="bulb-outline" size={20} color={colors.text.primary} />
                            <Text style={styles.spotterLabel}>Spotter</Text>
                        </TouchableOpacity>

                        {/* QR Check-in / Check-out */}
                        {!trainingOnly && (data?.checkin.status === 'checked_in' ? (
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
                        ))}

                        {/* Streak Badge */}
                        <View style={styles.streakBadge}>
                            <Ionicons name="flame-outline" size={21} color={colors.text.secondary} />
                            <Text style={styles.streakText}>{data?.streak.current || 0}</Text>
                        </View>
                    </View>
                </Animated.View>

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
                                <View style={styles.intentCardText}>
                                    <Text style={styles.intentCardLabel} numberOfLines={1}>Today's Training</Text>
                                    {suggestion && currentIntent.training_pattern && (
                                        <Text style={styles.intentCardSplit} numberOfLines={1}>{suggestion.split_name}</Text>
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
                                <View style={styles.intentCardText}>
                                    <Text style={styles.intentCardLabel} numberOfLines={1}>
                                        {suggestionReason === 'next_in_cycle' ? 'Next up' :
                                         suggestionReason === 'long_break' ? 'Welcome back' :
                                         'Today\'s Training'}
                                    </Text>
                                    <Text style={styles.intentCardSplit} numberOfLines={1}>{suggestion.split_name}</Text>
                                </View>
                            </View>
                            <View style={styles.intentCardActions}>
                                <TouchableOpacity
                                    onPress={handleIntentPress}
                                    style={styles.intentChangeBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel="Change workout split"
                                >
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
                        onPress={() => hasActiveWorkout && trainingOnly ? router.push('/log/workout') : currentIntent ? router.push({ pathname: '/log/workout', params: { intent: JSON.stringify({
                            session_label: currentIntent.session_label || currentIntent.display,
                            training_pattern: currentIntent.training_pattern || undefined,
                            emphasis: currentIntent.emphasis,
                        }) } }) : suggestion ? void handleQuickConfirm() : trainingOnly ? router.push({ pathname: '/log/workout', params: { start: 'empty' } }) : handleIntentPress()}
                        disabled={settingIntent}
                        accessibilityState={{ disabled: settingIntent, busy: settingIntent }}
                        accessibilityLabel={hasActiveWorkout && trainingOnly ? 'Resume workout' : currentIntent ? 'Log workout' : 'Start training'}
                        accessibilityRole="button"
                    >
                        <MaterialIcons
                            name={currentIntent ? 'add' : 'bolt'}
                            size={20}
                            color={colors.text.dark}
                        />
                        <Text style={styles.primaryActionText}>
                            {settingIntent ? 'Starting…' : hasActiveWorkout && trainingOnly ? 'Resume workout' : currentIntent ? 'Log workout' : 'Start workout'}
                        </Text>
                    </TouchableOpacity>

                    {!trainingOnly && <TouchableOpacity
                        style={styles.secondaryActionBtn}
                        onPress={() => router.push('/log/calories' as any)}
                        accessibilityLabel="Log food"
                        accessibilityRole="button"
                    >
                        <MaterialIcons name="add" size={20} color={colors.text.primary} />
                        <Text style={styles.secondaryActionText}>Log food</Text>
                    </TouchableOpacity>}
                </Animated.View>

                {trainingOnly && <>
                    <View style={styles.trainingActions}>
                        <TouchableOpacity style={styles.trainingAction} accessibilityRole="button" accessibilityLabel="My plan" onPress={() => router.push('/workout-intent')}><Ionicons name="calendar-outline" size={21} color={colors.text.secondary} /><Text style={styles.trainingActionText}>My plan</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.trainingAction} accessibilityRole="button" accessibilityLabel="Explore exercises" onPress={() => router.push('/exercise-library')}><Ionicons name="barbell-outline" size={21} color={colors.text.secondary} /><Text style={styles.trainingActionText}>Exercises</Text></TouchableOpacity>
                    </View>
                    <View style={[styles.trainingActions, { marginBottom: spacing['2xl'] }]}>
                        <TouchableOpacity style={styles.trainingAction} accessibilityRole="button" accessibilityLabel="Explore workouts" onPress={() => router.push('/member/curated-workouts')}><Ionicons name="compass-outline" size={21} color={colors.text.secondary} /><Text style={styles.trainingActionText}>Workouts</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.trainingAction} accessibilityRole="button" accessibilityLabel="Workout history" onPress={() => router.push('/member/workout-history')}><Ionicons name="time-outline" size={21} color={colors.text.secondary} /><Text style={styles.trainingActionText}>History</Text></TouchableOpacity>
                    </View>
                    <View style={styles.section}><Text style={[styles.sectionTitle, { marginBottom: spacing.md }]}>This week</Text><WeeklyProgress history={data?.streak.history || []} /></View>
                </>}

                {/* Today — nutrition + weekly activity in one block (simplified) */}
                {!trainingOnly && <Animated.View entering={FadeInDown.delay(300).duration(600).springify()} style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Food logged today</Text>
                        <TouchableOpacity onPress={() => router.push('/log/calories' as any)}>
                            <Text style={styles.viewAllLink}>Add food</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.foodSummary}>
                        <View style={styles.foodTotalRow}>
                            <Text style={styles.foodTotal}>{Math.round(todayMacros.calories || 0).toLocaleString()} kcal</Text>
                            {calorieGoal !== null ? <Text style={styles.foodTarget}>Target {calorieGoal.toLocaleString()}</Text>
                                : <TouchableOpacity style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Set up food targets" onPress={() => router.push('/member/fitness-profile')}><Text style={styles.viewAllLink}>Set up targets</Text></TouchableOpacity>}
                        </View>
                        <Text style={styles.foodHint}>{todayMacros.calories > 0 ? 'Based on your food log. Unlogged meals are not included.' : 'No food logged yet. Add a meal to see your progress.'}</Text>
                        <View style={styles.foodMacros}>
                            {(['protein', 'carbs', 'fat'] as const).map(macro => <View key={macro} style={styles.foodMacro}>
                                <Text style={styles.foodMacroName}>{macro === 'protein' ? 'Protein' : macro === 'carbs' ? 'Carbs' : 'Fat'}</Text>
                                <Text style={[styles.foodMacroValue, { color: colors.macro[macro] }]}>{Math.round(todayMacros[macro] || 0)}{macroTargets ? ` / ${macroTargets[macro]}` : ''} g</Text>
                            </View>)}
                        </View>
                    </View>
                    <View style={{ marginTop: spacing.md }}>
                        <WeeklyProgress history={data?.streak.history || []} />
                    </View>
                    <TouchableOpacity
                        style={styles.insightsButton}
                        onPress={() => router.push('/member/nutrition-insights' as any)}
                    >
                        <MaterialIcons name="insights" size={16} color={colors.primary} />
                        <Text style={styles.insightsButtonText}>Nutrition details</Text>
                        <MaterialIcons name="chevron-right" size={18} color={colors.text.muted} />
                    </TouchableOpacity>
                </Animated.View>}

                <RecoveryCheckIn key={user?.id} userId={user?.id} />

                {!trainingOnly && <>

                {/* Daily AI Note — taps through to the coach chat */}
                {dailyInsight ? (
                    <Animated.View entering={FadeInDown.delay(50).duration(600).springify()}>
                        <Pressable
                            onPress={() => router.push('/ai-coach' as any)}
                            accessibilityLabel="Open AI Coach chat"
                            accessibilityRole="button"
                        >
                            <GlassCard style={styles.insightCard}>
                                <View style={styles.insightHeader}>
                                    <MaterialIcons name="insights" size={18} color={colors.primary} />
                                    <Text style={styles.insightTitle}>From your coach</Text>
                                    <View style={{ flex: 1 }} />
                                    <MaterialIcons name="chevron-right" size={18} color={colors.text.muted} />
                                </View>
                                <Text style={styles.insightMessage}>{dailyInsight}</Text>
                                <Text style={styles.insightAskHint}>Ask your coach anything →</Text>
                            </GlassCard>
                        </Pressable>
                    </Animated.View>
                ) : !aiConsented ? (
                    <Animated.View entering={FadeInDown.delay(50).duration(600).springify()}>
                        <Pressable
                            onPress={() => setAiConsentModalVisible(true)}
                            accessibilityLabel="Try Fitzo AI"
                            accessibilityRole="button"
                        >
                            <GlassCard style={styles.insightCard}>
                                <View style={styles.insightHeader}>
                                    <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
                                    <Text style={styles.insightTitle}>Your coach</Text>
                                    <View style={{ flex: 1 }} />
                                    <Text style={[styles.tapHintText, { color: colors.primary }]}>Try it</Text>
                                    <MaterialIcons name="chevron-right" size={18} color={colors.text.muted} />
                                </View>
                                <Text style={styles.insightMessage}>
                                    Get coaching based on your training, meals and recovery.
                                </Text>
                                <Text style={styles.insightAskHint}>Try Fitzo AI →</Text>
                            </GlassCard>
                        </Pressable>
                    </Animated.View>
                ) : null}

                {/* Gym Crowd - live green/yellow/red occupancy light */}
                <Animated.View entering={FadeInDown.delay(150).duration(600).springify()}>
                    {data?.gym && data?.crowd ? (
                        <GlassCard style={styles.gymStatusCard}>
                            <View style={styles.gymStatusTop}>
                                <View style={styles.gymStatusLeft}>
                                    {/* CrowdIndicator's own root sets flex: 1, which in this row
                                        makes it claim half the width and shove the gym name into
                                        the middle of the card. Wrapping it in a column View turns
                                        that flex into a vertical one, so it collapses to the dot's
                                        natural width. Wrapped rather than changing the component,
                                        because flex: 1 is correct where it is used full-width. */}
                                    <View style={styles.gymStatusDot}>
                                        <CrowdIndicator level={data.crowd.level} size="sm" showLabel={false} />
                                    </View>
                                    <View style={styles.gymStatusText}>
                                        <Text style={styles.gymStatusName} numberOfLines={1}>
                                            {data.gym.name}
                                        </Text>
                                        <Text style={styles.gymStatusSub} numberOfLines={1}>
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
                                            width: `${Math.min(100, Math.max(0, data.crowd.percentage))}%`,
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
                            timezone={busyTimes.timezone}
                        />
                    </View>
                )}

                {/* "Completed today" used to sit here. It restated numbers the
                    Today block already shows and pushed the next action further
                    down the screen, so it now lives on Stats. */}

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
                                onPress={() => router.push('/member/learn' as any)}
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
                            <ProgressRing
                                progress={learnPct}
                                size={72}
                                showLabel={learnStarted}
                                emptyIcon="menu-book"
                            />

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
                                    {/* Names what the percentage measures. The
                                        card headline IS the unit and the figure
                                        is unit progress, but a bare "50%
                                        complete" sitting beside a lesson name
                                        read as if it described the lesson. */}
                                    {learnStarted
                                        ? `${learnPct}% of ${data.learn.title}`
                                        : 'Not started yet'}
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
                                            userName: displayName(friend),
                                            userUsername: (friend as any).username,
                                            userAvatar: friend.avatar_url || ''
                                        }
                                    })}
                                >
                                    <View style={styles.squadAvatar}>
                                        <Avatar size="lg" uri={friend.avatar_url} name={displayName(friend)} />
                                    </View>
                                    <Text style={styles.squadName} numberOfLines={1}>
                                        {getFirstName(friend)}
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
                </>}
            </ScrollView>

            <AIConsentModal
                visible={aiConsentModalVisible}
                onAccept={async () => {
                    setAiConsentModalVisible(false);
                    setAiConsented(true);
                    try {
                        const r = await aiAPI.getDailyInsight();
                        if (r?.success && r?.insight) setDailyInsight(r.insight);
                    } catch {}
                }}
                onDecline={() => setAiConsentModalVisible(false)}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    foodSummary: { padding: spacing.lg, borderRadius: borderRadius.lg, backgroundColor: '#101010', gap: 12 },
    foodTotalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
    foodTotal: { fontFamily: typography.fontFamily.semiBold, fontSize: 24, color: colors.text.primary },
    foodTarget: { fontFamily: typography.fontFamily.regular, fontSize: 13, color: colors.text.secondary },
    foodHint: { fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 19, color: colors.text.secondary },
    foodMacros: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, foodMacro: { flexGrow: 1 },
    foodMacroName: { fontFamily: typography.fontFamily.regular, fontSize: 12, color: colors.text.secondary },
    foodMacroValue: { fontFamily: typography.fontFamily.semiBold, fontSize: 15, marginTop: 6, color: colors.text.primary },
    resumeWorkout: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.xl, marginTop: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.lg },
    resumeTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semiBold, fontSize: 15 },
    resumeDetail: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 12, marginTop: 4 },
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
        gap: spacing.sm,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: 48,
        flex: 1,
        minWidth: 0,
    },
    avatarWrapper: {
        position: 'relative',
        flexShrink: 0,
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
        flex: 1,
        minWidth: 0,
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
        flexShrink: 0,
    },
    spotterBadge: { width: 'auto', minHeight: 44, height: 'auto', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 6 },
    spotterLabel: { fontFamily: typography.fontFamily.medium, color: colors.text.primary, fontSize: 11 },
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
        gap: spacing.sm,
    },
    intentCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
        minWidth: 0,
    },
    intentCardText: { flex: 1, minWidth: 0 },
    intentDayBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        minWidth: 56,
        alignItems: 'center',
        flexShrink: 0,
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
        flexShrink: 0,
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
    trainingActions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    trainingAction: { flex: 1, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border },
    trainingActionText: { flexShrink: 1, fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.sm, color: colors.text.primary },
    actionButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginBottom: spacing['3xl'],
    },
    primaryActionBtn: {
        flexGrow: 1,
        flexBasis: 170,
        minHeight: 56,
        paddingVertical: 16,
        paddingHorizontal: 14,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
    },
    primaryActionText: {
        flexShrink: 1,
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        textAlign: 'center',
    },
    secondaryActionBtn: {
        flexGrow: 1,
        flexBasis: 110,
        minHeight: 56,
        paddingVertical: 16,
        paddingHorizontal: 14,
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
        padding: spacing.lg,
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
        minWidth: 0,
    },
    // The name/sub block must be allowed to shrink. Without flex + minWidth 0 a
    // long gym name sizes the block to its full intrinsic width and slides under
    // the percentage on the right — "Iron Paradise" and "0%" rendered on top of
    // each other. minWidth: 0 is the load-bearing half: flex alone will not let
    // a text child shrink below its content width.
    gymStatusDot: {
        flexShrink: 0,
    },
    gymStatusText: {
        flex: 1,
        minWidth: 0,
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
        // Never give up width to the name on its left, and keep a gap so the
        // two never touch even when the name is truncated.
        flexShrink: 0,
        marginLeft: spacing.md,
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
