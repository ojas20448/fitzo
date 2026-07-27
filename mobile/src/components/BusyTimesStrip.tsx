import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface BusyTimesStripProps {
    grid: number[][] | null;
    quietest: { dow: number; hour: number; score: number } | null;
    confidence: 'none' | 'low' | 'good';
    /** 0 = Sunday, matching Postgres EXTRACT(DOW) */
    today?: number;
}

// Gyms are dead overnight; showing 12 empty bars wastes the strip.
const START_HOUR = 5;
const END_HOUR = 23;

function formatHour(hour: number): string {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

const BusyTimesStrip: React.FC<BusyTimesStripProps> = ({
    grid,
    quietest,
    confidence,
    today = new Date().getDay(),
}) => {
    if (confidence === 'none' || !grid) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>USUALLY BUSY</Text>
                <Text style={styles.empty}>
                    Not enough check-ins yet. Check in for a few days to unlock your gym's busy hours.
                </Text>
            </View>
        );
    }

    const row = grid[today] ?? [];
    const hours = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) hours.push(h);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>USUALLY BUSY</Text>
                {confidence === 'low' && <Text style={styles.rough}>ROUGH</Text>}
            </View>

            <View style={styles.bars}>
                {hours.map((h) => {
                    const score = row[h] ?? 0;
                    return (
                        <View key={h} style={styles.barSlot}>
                            <View
                                style={[
                                    styles.bar,
                                    { height: Math.max(3, (score / 100) * 40) },
                                    score >= 75 && styles.barHigh,
                                    score >= 40 && score < 75 && styles.barMed,
                                ]}
                            />
                        </View>
                    );
                })}
            </View>

            <View style={styles.axis}>
                {hours.map((h) => (
                    <View key={h} style={styles.axisSlot}>
                        {h % 6 === 0 && <Text style={styles.axisLabel}>{formatHour(h)}</Text>}
                    </View>
                ))}
            </View>

            {quietest && (
                <Text style={styles.caption}>
                    Quietest around {formatHour(quietest.hour)}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        letterSpacing: 1.2,
    },
    rough: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 1,
    },
    bars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: 44,
        marginTop: spacing.sm,
        gap: 2,
    },
    barSlot: { flex: 1, justifyContent: 'flex-end' },
    bar: {
        width: '100%',
        borderRadius: 2,
        backgroundColor: colors.glass.borderLight,
    },
    barMed: { backgroundColor: colors.warning },
    barHigh: { backgroundColor: colors.error },
    axis: { flexDirection: 'row', marginTop: spacing.xs, gap: 2 },
    axisSlot: { flex: 1, alignItems: 'center' },
    axisLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    caption: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginTop: spacing.sm,
    },
    empty: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.sm,
    },
});

export default BusyTimesStrip;
