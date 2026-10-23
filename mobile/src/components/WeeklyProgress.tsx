
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useNutrition } from '../context/NutritionContext';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import GlassCard from './GlassCard';
import { Ionicons } from '@expo/vector-icons';

interface WeeklyProgressProps {
    history: string[]; // ['YYYY-MM-DD', ...]
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Pick a short motivational line based on how the week is going. */
function getMotivation(done: number, goal: number, isRestDay: boolean, dayOfWeek: number): string {
    if (done >= goal) return 'Weekly goal reached.';
    if (done === 0 && dayOfWeek <= 2) return 'Fresh week — let\'s set the tone.';
    if (done === 0 && dayOfWeek > 2) return 'Still time to start strong.';
    if (isRestDay) return 'Rest day. Recovery is growth.';
    const remaining = goal - done;
    if (remaining === 1) return 'One more session to hit your goal!';
    if (done >= goal - 1) return 'Almost there. Finish strong.';
    return `${remaining} sessions to go this week.`;
}

const WeeklyProgress: React.FC<WeeklyProgressProps> = ({ history }) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sun
    const weekStart = new Date(today);
    const dist = currentDay === 0 ? 6 : currentDay - 1;
    weekStart.setDate(today.getDate() - dist);

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    /**
     * A local calendar date as YYYY-MM-DD.
     *
     * NOT date.toISOString().split('T')[0], which converts to UTC first. For a
     * user in IST, 01:00 on the 17th is 19:30 UTC on the 16th, so the whole
     * strip silently shifted a day back during the early hours — marking today
     * unworked and yesterday worked.
     */
    const localDay = (date: Date) => {
        const m = `${date.getMonth() + 1}`.padStart(2, '0');
        const d = `${date.getDate()}`.padStart(2, '0');
        return `${date.getFullYear()}-${m}-${d}`;
    };

    // Entries are normalised because the API has served both shapes: a plain
    // "2026-08-17" and a full "2026-08-17T00:00:00.000Z" (node-pg turns a DATE
    // column into a JS Date, which JSON serialises as a UTC timestamp). The
    // strict includes() against the raw array therefore never matched, and
    // this ring read 0 for every user regardless of how much they had trained.
    // Slicing to 10 characters accepts either, so the component keeps working
    // against older app or API builds.
    const trainedDays = React.useMemo(
        () => new Set((history || []).map((d) => String(d).slice(0, 10))),
        [history],
    );

    const hasWorkout = (date: Date) => trainedDays.has(localDay(date));

    const { weeklyWorkoutGoal } = useNutrition();
    const workoutsThisWeek = weekDates.filter(d => hasWorkout(d)).length;
    const progressPct = weeklyWorkoutGoal > 0 ? Math.min((workoutsThisWeek / weeklyWorkoutGoal) * 100, 100) : 0;
    const goalHit = workoutsThisWeek >= weeklyWorkoutGoal;
    const todayHasWorkout = hasWorkout(today);
    const dayIndex = weekDates.findIndex(d => d.toDateString() === today.toDateString());
    const isFutureDay = (date: Date) => date.toDateString() !== today.toDateString() && date > today;

    // Animated progress bar width
    const barAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(barAnim, {
            toValue: progressPct,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [progressPct]);
    const barWidth = barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

    const motivation = getMotivation(workoutsThisWeek, weeklyWorkoutGoal, todayHasWorkout, currentDay);

    return (
        <GlassCard style={{ padding: spacing.xl }}>
            {/* Header row */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.title}>Weekly Progress</Text>
                    <Text style={styles.subtitle}>
                        {workoutsThisWeek} / {weeklyWorkoutGoal} workouts
                    </Text>
                </View>
                {goalHit ? (
                    <View style={styles.badge}>
                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.text.primary} />
                        <Text style={styles.badgeText}>GOAL HIT!</Text>
                    </View>
                ) : workoutsThisWeek > 0 ? (
                    <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{Math.round(progressPct)}%</Text>
                    </View>
                ) : null}
            </View>

            {/* Progress bar */}
            <View style={styles.progressBarTrack}>
                <Animated.View
                    style={[
                        styles.progressBarFill,
                        {
                            width: barWidth,
                            backgroundColor: colors.primary,
                        },
                    ]}
                />
            </View>

            {/* Day circles */}
            <View style={styles.daysRow}>
                {weekDates.map((date, index) => {
                    const active = hasWorkout(date);
                    const isToday = date.toDateString() === today.toDateString();
                    const future = isFutureDay(date);
                    return (
                        <View key={index} style={styles.dayCol} accessible accessibilityLabel={`${date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}${isToday ? ', today' : ''}, ${active ? 'workout logged' : 'no workout logged'}`}>
                            <View style={styles.circleContainer}>
                                <View
                                    style={[
                                        styles.dayCircle,
                                        active && styles.dayCircleActive,
                                        isToday && !active && styles.dayCircleToday,
                                        future && styles.dayCircleFuture,
                                    ]}
                                >
                                    {active ? (
                                        <Ionicons name="checkmark-outline" size={16} color={colors.text.dark} />
                                    ) : isToday ? (
                                        <View style={styles.todayDot} />
                                    ) : null}
                                </View>
                            </View>
                            <Text
                                style={[
                                    styles.dayLabel,
                                    isToday && styles.dayLabelToday,
                                    active && styles.dayLabelActive,
                                ]}
                            >
                                {DAY_LABELS[date.getDay()]}
                            </Text>
                            <Text style={[styles.dateNum, isToday && styles.dateNumToday]}>
                                {date.getDate()}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* Motivational nudge */}
            <View style={styles.motivationRow}>
                <Ionicons
                    name={goalHit ? 'checkmark-circle-outline' : workoutsThisWeek > 0 ? 'trending-up-outline' : 'flag-outline'}
                    size={16}
                    color={colors.text.secondary}
                />
                <Text style={styles.motivationText}>
                    {motivation}
                </Text>
            </View>
        </GlassCard>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
        flexWrap: 'wrap',
        marginBottom: spacing.lg,
    },
    headerLeft: {
        flex: 1,
    },
    title: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginTop: spacing.sm,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.glass.surfaceLight,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
    },
    badgeText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    countBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    countBadgeText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
    },
    progressBarTrack: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 2,
        marginBottom: spacing['2xl'],
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayCol: {
        flex: 1,
        alignItems: 'center',
        gap: spacing.sm,
    },
    circleContainer: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    dayCircleActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dayCircleToday: {
        borderColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    dayCircleFuture: {
        opacity: 0.4,
    },
    todayDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
    dayLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    dayLabelToday: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
    },
    dayLabelActive: {
        color: colors.text.secondary,
    },
    dateNum: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    dateNumToday: {
        color: colors.text.secondary,
        fontFamily: typography.fontFamily.medium,
    },
    motivationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xl,
        paddingTop: spacing.lg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    motivationText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        lineHeight: 20,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});

export default WeeklyProgress;

