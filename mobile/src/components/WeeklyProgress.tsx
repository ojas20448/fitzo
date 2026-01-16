import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import GlassCard from './GlassCard';
import { MaterialIcons } from '@expo/vector-icons';

interface WeeklyProgressProps {
    history: string[]; // ['YYYY-MM-DD', ...]
}

// Animated day dot component
const AnimatedDayDot: React.FC<{
    visited: boolean;
    active: boolean;
    index: number;
}> = ({ visited, active, index }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const checkAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Staggered entrance animation
        Animated.sequence([
            Animated.delay(index * 50),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 100,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();

        // Check mark pop animation
        if (visited) {
            Animated.sequence([
                Animated.delay(index * 50 + 200),
                Animated.spring(checkAnim, {
                    toValue: 1,
                    tension: 150,
                    friction: 6,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visited]);

    return (
        <Animated.View
            style={[
                styles.dayDot,
                visited && styles.dayDotVisited,
                active && !visited && styles.dayDotActive,
                { transform: [{ scale: scaleAnim }] },
            ]}
        >
            {visited && (
                <Animated.View style={{ transform: [{ scale: checkAnim }] }}>
                    <MaterialIcons name="check" size={12} color={colors.background} />
                </Animated.View>
            )}
        </Animated.View>
    );
};

const WeeklyProgress: React.FC<WeeklyProgressProps> = ({ history }) => {
    // Get current week dates (Sun-Sat or Mon-Sun)
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sun, 1 = Mon...
    const weekStart = new Date(today);
    // Adjust to Monday start if preferred, defaulting to Sunday start for now or standard getDay()
    // Let's do Monday start for fitness usually
    const dist = currentDay === 0 ? 6 : currentDay - 1;
    weekStart.setDate(today.getDate() - dist);

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    const isToday = (date: Date) => {
        return date.toISOString().split('T')[0] === today.toISOString().split('T')[0];
    };

    const hasWorkout = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return history.includes(dateStr);
    };

    const workoutsThisWeek = weekDates.filter(d => hasWorkout(d)).length;
    const weeklyTarget = 4; // This could be dynamic later

    return (
        <GlassCard padding="lg">
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Weekly Progress</Text>
                    <Text style={styles.subtitle}>{workoutsThisWeek} / {weeklyTarget} workouts completed</Text>
                </View>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{Math.round((workoutsThisWeek / weeklyTarget) * 100)}%</Text>
                </View>
            </View>

            <View style={styles.weekRow}>
                {weekDates.map((date, index) => {
                    const visited = hasWorkout(date);
                    const active = isToday(date);
                    const dayLabel = date.toLocaleDateString('en-US', { weekday: 'narrow' });

                    return (
                        <View key={index} style={styles.dayContainer}>
                            <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>
                                {dayLabel}
                            </Text>
                            <AnimatedDayDot
                                visited={visited}
                                active={active}
                                index={index}
                            />
                        </View>
                    );
                })}
            </View>
        </GlassCard>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
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
        backgroundColor: colors.glass.surface,
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    badgeText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayContainer: {
        alignItems: 'center',
        gap: 8,
    },
    dayLabel: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        textTransform: 'uppercase',
    },
    dayLabelActive: {
        color: colors.primary,
        fontFamily: typography.fontFamily.bold,
    },
    dayDot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    dayDotVisited: {
        backgroundColor: colors.crowd.low, // Green
    },
    dayDotActive: {
        borderColor: colors.primary,
        backgroundColor: 'transparent',
    },
});

export default WeeklyProgress;
