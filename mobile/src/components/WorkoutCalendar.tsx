import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, borderRadius, spacing } from '../styles/theme';
import GlassCard from './GlassCard';

interface WorkoutCalendarProps {
    history: string[]; // Array of date strings 'YYYY-MM-DD'
}

const WorkoutCalendar: React.FC<WorkoutCalendarProps> = ({ history = [] }) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthName = today.toLocaleString('default', { month: 'long' });

    // Generate days
    const days = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return {
            day,
            dateStr,
            isToday: day === today.getDate(),
            isDone: history.includes(dateStr)
        };
    });

    return (
        <GlassCard padding="lg">
            <View style={styles.header}>
                <Text style={styles.title}>{monthName} Progress</Text>
                <Text style={styles.subtitle}>{history.length} Workouts</Text>
            </View>

            <View style={styles.grid}>
                {days.map((d) => (
                    <View key={d.day} style={styles.dayContainer}>
                        <View style={[
                            styles.dot,
                            d.isDone && styles.dotDone,
                            d.isToday && !d.isDone && styles.dotToday
                        ]}>
                            <Text style={[
                                styles.dayText,
                                d.isDone && styles.dayTextDone,
                                d.isToday && !d.isDone && styles.dayTextToday
                            ]}>
                                {d.day}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </GlassCard>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: spacing.md,
    },
    title: {
        fontSize: typography.sizes.md,
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
        gap: 6, // Adjusted gap for fitting 7 columns roughly
        justifyContent: 'flex-start',
    },
    dayContainer: {
        width: '13%', // Approx 7 items per row
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.glass.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dotDone: {
        backgroundColor: colors.primary,
    },
    dotToday: {
        borderWidth: 1,
        borderColor: colors.primary,
        backgroundColor: 'transparent',
    },
    dayText: {
        fontSize: 10,
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
});

export default WorkoutCalendar;
