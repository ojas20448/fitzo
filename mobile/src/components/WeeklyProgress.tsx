
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useNutrition } from '../context/NutritionContext';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import GlassCard from './GlassCard';
import { MaterialIcons } from '@expo/vector-icons';

interface WeeklyProgressProps {
    history: string[]; // ['YYYY-MM-DD', ...]
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Pick a short motivational line based on how the week is going. */
function getMotivation(done: number, goal: number, isRestDay: boolean, dayOfWeek: number): string {
    if (done >= goal) return '🎯 Weekly goal crushed!';
    if (done === 0 && dayOfWeek <= 2) return 'Fresh week — let\'s set the tone.';
    if (done === 0 && dayOfWeek > 2) return 'Still time to start strong.';
    if (isRestDay) return 'Rest day. Recovery is growth.';
    const remaining = goal - done;
    if (remaining === 1) return 'One more session to hit your goal!';
    if (done >= goal - 1) return 'Almost there — finish strong 💪';
    return `${remaining} sessions to go this week.`;
}

/** Pulsing ring for "today" circle */
const PulseRing: React.FC<{ size: number }> = ({ size }) => {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
            ])
        ).start();
    }, []);
    const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
    const opacity = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 0.2, 0] });
    return (
        <Animated.View
            pointerEvents="none"
            style={{
                position: 'absolute',
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: 1.5,
                borderColor: colors.primary,
                transform: [{ scale }],
                opacity,
            }}
        />
    );
};

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
        <GlassCard style={{ padding: spacing.lg }}>
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
                        <MaterialIcons name="emoji-events" size={12} color="#4ECDC4" />
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
                            backgroundColor: goalHit ? '#4ECDC4' : colors.primary,
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
                        <View key={index} style={styles.dayCol}>
                            <View style={styles.circleContainer}>
                                {isToday && !active && <PulseRing size={36} />}
                                <View
                                    style={[
                                        styles.dayCircle,
                                        active && styles.dayCircleActive,
                                        isToday && !active && styles.dayCircleToday,
                                        future && styles.dayCircleFuture,
                                    ]}
                                >
                                    {active ? (
                                        <MaterialIcons name="check" size={14} color={colors.text.dark} />
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
                <MaterialIcons
                    name={goalHit ? 'celebration' : workoutsThisWeek > 0 ? 'trending-up' : 'flag'}
                    size={14}
                    color={goalHit ? '#4ECDC4' : colors.text.muted}
                />
                <Text style={[styles.motivationText, goalHit && { color: '#4ECDC4' }]}>
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
        marginBottom: spacing.sm,
    },
    headerLeft: {
        flex: 1,
    },
    title: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    subtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginTop: 2,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(78, 205, 196, 0.15)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: 'rgba(78, 205, 196, 0.4)',
    },
    badgeText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: '#4ECDC4',
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
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 2,
        marginBottom: spacing.lg,
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
        alignItems: 'center',
        gap: 4,
    },
    circleContainer: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
        fontSize: 10,
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
        fontSize: 9,
        fontFamily: typography.fontFamily.regular,
        color: 'rgba(255, 255, 255, 0.25)',
    },
    dateNumToday: {
        color: colors.text.secondary,
        fontFamily: typography.fontFamily.medium,
    },
    motivationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    motivationText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});

export default WeeklyProgress;

