import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

interface MacroPieChartProps {
    calories: number;
    calorieTarget: number;
    protein: number;
    proteinTarget: number;
    carbs: number;
    carbsTarget: number;
    fat: number;
    fatTarget: number;
}

const MacroPieChart: React.FC<MacroPieChartProps> = ({
    calories,
    calorieTarget,
    protein,
    proteinTarget,
    carbs,
    carbsTarget,
    fat,
    fatTarget,
}) => {
    const size = 140;
    const strokeWidth = 12;
    const center = size / 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Calculate calorie progress
    const calorieProgress = Math.min(calories / calorieTarget, 1);
    const calorieOffset = circumference * (1 - calorieProgress);
    const remaining = Math.max(0, calorieTarget - calories);

    // Calculate macro percentages
    const totalMacroGrams = protein + carbs + fat;
    const proteinPct = totalMacroGrams > 0 ? (protein / totalMacroGrams) * 100 : 33;
    const carbsPct = totalMacroGrams > 0 ? (carbs / totalMacroGrams) * 100 : 33;
    const fatPct = totalMacroGrams > 0 ? (fat / totalMacroGrams) * 100 : 33;

    // Colors for macros
    const proteinColor = '#4ECDC4'; // Teal
    const carbsColor = '#FFE66D';   // Yellow
    const fatColor = '#FF6B6B';     // Coral

    return (
        <View style={styles.container}>
            {/* Main Calorie Ring */}
            <View style={styles.chartContainer}>
                <Svg width={size} height={size}>
                    {/* Background circle */}
                    <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={colors.glass.border}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />
                    {/* Progress circle */}
                    <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={colors.primary}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={calorieOffset}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${center} ${center})`}
                    />
                </Svg>

                {/* Center Content */}
                <View style={styles.centerContent}>
                    <Text style={styles.remainingValue}>{remaining}</Text>
                    <Text style={styles.remainingLabel}>remaining</Text>
                </View>
            </View>

            {/* Macro Bars */}
            <View style={styles.macrosContainer}>
                {/* Protein */}
                <View style={styles.macroRow}>
                    <View style={styles.macroInfo}>
                        <View style={[styles.macroIndicator, { backgroundColor: proteinColor }]} />
                        <Text style={styles.macroLabel}>Protein</Text>
                    </View>
                    <View style={styles.macroBarContainer}>
                        <View style={styles.macroBarBg}>
                            <View
                                style={[
                                    styles.macroBarFill,
                                    {
                                        width: `${Math.min((protein / proteinTarget) * 100, 100)}%`,
                                        backgroundColor: proteinColor,
                                    }
                                ]}
                            />
                        </View>
                        <Text style={styles.macroValue}>{protein}g / {proteinTarget}g</Text>
                    </View>
                </View>

                {/* Carbs */}
                <View style={styles.macroRow}>
                    <View style={styles.macroInfo}>
                        <View style={[styles.macroIndicator, { backgroundColor: carbsColor }]} />
                        <Text style={styles.macroLabel}>Carbs</Text>
                    </View>
                    <View style={styles.macroBarContainer}>
                        <View style={styles.macroBarBg}>
                            <View
                                style={[
                                    styles.macroBarFill,
                                    {
                                        width: `${Math.min((carbs / carbsTarget) * 100, 100)}%`,
                                        backgroundColor: carbsColor,
                                    }
                                ]}
                            />
                        </View>
                        <Text style={styles.macroValue}>{carbs}g / {carbsTarget}g</Text>
                    </View>
                </View>

                {/* Fat */}
                <View style={styles.macroRow}>
                    <View style={styles.macroInfo}>
                        <View style={[styles.macroIndicator, { backgroundColor: fatColor }]} />
                        <Text style={styles.macroLabel}>Fat</Text>
                    </View>
                    <View style={styles.macroBarContainer}>
                        <View style={styles.macroBarBg}>
                            <View
                                style={[
                                    styles.macroBarFill,
                                    {
                                        width: `${Math.min((fat / fatTarget) * 100, 100)}%`,
                                        backgroundColor: fatColor,
                                    }
                                ]}
                            />
                        </View>
                        <Text style={styles.macroValue}>{fat}g / {fatTarget}g</Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: spacing.lg,
    },
    chartContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerContent: {
        position: 'absolute',
        alignItems: 'center',
    },
    remainingValue: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    remainingLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    macrosContainer: {
        flex: 1,
        justifyContent: 'center',
        gap: spacing.md,
    },
    macroRow: {
        gap: 4,
    },
    macroInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: 2,
    },
    macroIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    macroLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    macroBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    macroBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: colors.surfaceLight,
        borderRadius: 3,
        overflow: 'hidden',
    },
    macroBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    macroValue: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        minWidth: 60,
    },
});

export default MacroPieChart;
