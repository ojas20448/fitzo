import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import GlassCard from './GlassCard';
import { WeekSummary } from '../services/api';
import { colors, typography, spacing } from '../styles/theme';

interface WeeklyNutritionCardProps {
    summary: WeekSummary | null;
    onPress: () => void;
}

/**
 * "How was my week" — averages and adherence, not a per-day chart. The per-day
 * bars already live in NutritionInsights (components/WeeklyCharts); tapping
 * this card goes there rather than repeating them here.
 */
const WeeklyNutritionCard: React.FC<WeeklyNutritionCardProps> = ({ summary, onPress }) => {
    const logged = summary?.daysLogged ?? 0;

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={
                logged === 0
                    ? 'Weekly nutrition, nothing logged. Tap for detail.'
                    : `Weekly nutrition: ${summary!.avgCalories} average calories, ` +
                      `${summary!.avgProtein} grams average protein, ` +
                      `${logged} of 7 days logged. Tap for detail.`
            }
        >
            <GlassCard padding="lg">
                <View style={styles.header}>
                    <Text style={styles.title}>THIS WEEK</Text>
                    <MaterialIcons name="chevron-right" size={18} color={colors.text.muted} />
                </View>

                {logged === 0 ? (
                    <Text style={styles.empty}>No food logged in the last 7 days.</Text>
                ) : (
                    <>
                        <View style={styles.row}>
                            <View style={styles.stat}>
                                <Text style={styles.value}>{summary!.avgCalories}</Text>
                                <Text style={styles.label}>avg kcal</Text>
                                <Text style={styles.sub}>target {summary!.targetCalories}</Text>
                            </View>
                            <View style={styles.stat}>
                                <Text style={styles.value}>{summary!.avgProtein}g</Text>
                                <Text style={styles.label}>avg protein</Text>
                                <Text style={styles.sub}>target {summary!.targetProtein}g</Text>
                            </View>
                        </View>

                        {/* The averages above are over logged days, so days-logged
                            is shown beside them — the pair tells the truth where
                            either alone would mislead. */}
                        <Text style={styles.footer}>
                            {logged} of 7 days logged · {summary!.calorieTargetDays} on calories · {summary!.proteinTargetDays} on protein
                        </Text>
                    </>
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
    title: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
        letterSpacing: 1.2,
    },
    empty: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    row: { flexDirection: 'row' },
    stat: { flex: 1 },
    value: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    label: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginTop: 2,
    },
    sub: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },
    footer: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.md,
    },
});

export default WeeklyNutritionCard;
