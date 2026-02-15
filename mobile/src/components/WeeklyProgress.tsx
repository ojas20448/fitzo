
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNutrition } from '../context/NutritionContext';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import GlassCard from './GlassCard';
import { MaterialIcons } from '@expo/vector-icons';

interface WeeklyProgressProps {
    history: string[]; // ['YYYY-MM-DD', ...]
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const WeeklyProgress: React.FC<WeeklyProgressProps> = ({ history }) => {
    // Get current सप्ताह dates
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sun
    const weekStart = new Date(today);
    // Start from Monday (or user preference? keeping simple for now)
    const dist = currentDay === 0 ? 6 : currentDay - 1;
    weekStart.setDate(today.getDate() - dist);

    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    const hasWorkout = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        return history.includes(dateStr);
    };

    const { weeklyWorkoutGoal } = useNutrition();
    const workoutsThisWeek = weekDates.filter(d => hasWorkout(d)).length;

    return (
        <GlassCard style={{ padding: spacing.lg }}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Weekly Progress</Text>
                    <Text style={styles.subtitle}>{workoutsThisWeek} / {weeklyWorkoutGoal} workouts</Text>
                </View>
                {workoutsThisWeek >= weeklyWorkoutGoal && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>GOAL HIT!</Text>
                    </View>
                )}
            </View>

            <View style={styles.daysRow}>
                {weekDates.map((date, index) => {
                    const active = hasWorkout(date);
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                        <View key={index} style={styles.dayCol}>
                            <View style={[
                                styles.dayCircle,
                                active && styles.dayCircleActive,
                                isToday && !active && styles.dayCircleToday
                            ]}>
                                {active && <Text style={styles.check}>✓</Text>}
                            </View>
                            <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                                {DAYS[date.getDay()]}
                            </Text>
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
        backgroundColor: 'rgba(78, 205, 196, 0.2)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: '#4ECDC4',
    },
    badgeText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: '#4ECDC4',
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayCol: {
        alignItems: 'center',
        gap: 8,
    },
    dayCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    dayCircleActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dayCircleToday: {
        borderColor: colors.text.muted,
        borderWidth: 1,
    },
    check: {
        color: colors.text.dark,
        fontSize: 12,
        fontWeight: 'bold',
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
});

export default WeeklyProgress;
