import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing } from '../styles/theme';
import GlassCard from './GlassCard';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface WorkoutCalendarProps {
    history: string[]; // Workout dates 'YYYY-MM-DD'
    foodHistory?: string[]; // Food dates 'YYYY-MM-DD'
}

const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({ history = [], foodHistory = [] }) => {
    const [expanded, setExpanded] = useState(false);
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthName = today.toLocaleString('default', { month: 'long' });

    // Helper to get day of week (0-6, Mon-Sun)
    const getDayOfWeek = (date: Date) => {
        const day = date.getDay();
        return day === 0 ? 6 : day - 1; // Convert Sun=0 to Sun=6, Mon=1 to Mon=0
    };

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    // Generate all days in month
    const allDays = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return {
            day,
            dateStr,
            isToday: day === today.getDate(),
            isWorkoutDone: history.includes(dateStr),
            isFoodDone: (foodHistory || []).includes(dateStr)
        };
    });

    // Get current week days for collapsed view
    // We want the current week Monday-Sunday
    const currentDayOfWeek = getDayOfWeek(today); // 0=Mon, 6=Sun
    const mondayOffset = today.getDate() - currentDayOfWeek;

    // Calculate start and end day of the week, clamping to month boundaries
    const startDay = Math.max(1, mondayOffset);
    const endDay = Math.min(daysInMonth, mondayOffset + 6);

    const weekDays = allDays.filter(d => d.day >= startDay && d.day <= endDay);

    const visibleDays = expanded ? allDays : weekDays;

    return (
        <Pressable onPress={toggleExpand}>
            <GlassCard padding="lg">
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.title}>{expanded ? `${monthName} Progress` : 'This Week'}</Text>
                        <MaterialIcons
                            name={expanded ? "expand-less" : "expand-more"}
                            size={20}
                            color={colors.text.muted}
                        />
                    </View>
                    <Text style={styles.subtitle}>{history.length} Workouts</Text>
                </View>

                <View style={styles.grid}>
                    {visibleDays.map((d) => {
                        const status = d.isWorkoutDone && d.isFoodDone
                            ? 'both'
                            : (d.isWorkoutDone || d.isFoodDone ? 'partial' : 'none');

                        const isPast = new Date(d.dateStr) < new Date(today.toDateString());

                        return (
                            <View key={d.day} style={styles.dayContainer}>
                                <View style={[
                                    styles.dot,
                                    status === 'both' && styles.dotBoth,
                                    status === 'partial' && styles.dotPartial,
                                    status === 'none' && isPast && styles.dotNone,
                                    d.isToday && styles.dotToday
                                ]}>
                                    <Text style={[
                                        styles.dayText,
                                        status !== 'none' && styles.dayTextDone,
                                        d.isToday && status === 'none' && styles.dayTextToday
                                    ]}>
                                        {d.day}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, styles.dotBoth]} />
                        <Text style={styles.legendText}>Full Day</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, styles.dotPartial]} />
                        <Text style={styles.legendText}>Partial</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, styles.dotNone]} />
                        <Text style={styles.legendText}>Missed</Text>
                    </View>
                </View>

                {!expanded && (
                    <Text style={styles.hint}>Tap to see full month</Text>
                )}
            </GlassCard>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    title: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    subtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.primary,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'flex-start',
    },
    dayContainer: {
        width: '13%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.glass.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dotBoth: {
        backgroundColor: colors.crowd.low,
    },
    dotPartial: {
        backgroundColor: colors.crowd.medium,
    },
    dotNone: {
        backgroundColor: colors.crowd.high + '40', // Semi-transparent red
        borderColor: colors.crowd.high,
        borderWidth: 1,
    },
    dotToday: {
        borderColor: colors.primary,
        borderWidth: 2,
    },
    dayText: {
        fontSize: 12,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    dayTextDone: {
        color: colors.background,
        fontFamily: typography.fontFamily.bold,
    },
    dayTextToday: {
        color: colors.primary,
        fontFamily: typography.fontFamily.bold,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.lg,
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 9,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        textTransform: 'uppercase',
    },
    hint: {
        fontSize: 10,
        color: colors.text.subtle,
        textAlign: 'center',
        marginTop: spacing.md,
    }
});

export default WorkoutCalendar;
