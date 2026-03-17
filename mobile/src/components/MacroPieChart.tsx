import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    Easing,
    withDelay,
} from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

let AnimatedCircle: any;
try {
    AnimatedCircle = Animated.createAnimatedComponent(Circle);
} catch {
    AnimatedCircle = Circle; // Fallback to static circle
}

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

    // Animated progress value
    const animatedProgress = useSharedValue(0);
    const [showDetail, setShowDetail] = useState<'calories' | 'protein' | 'carbs' | 'fat'>('calories');

    // Calculate calorie progress (guard against division by zero)
    const calorieProgress = calorieTarget > 0 ? Math.min(calories / calorieTarget, 1) : 0;
    const remaining = Math.max(0, calorieTarget - calories);

    // Animate on mount and when calories change
    useEffect(() => {
        animatedProgress.value = 0;
        animatedProgress.value = withDelay(
            200,
            withTiming(calorieProgress, {
                duration: 1000,
                easing: Easing.out(Easing.cubic),
            })
        );
    }, [calories, calorieTarget]);

    const animatedProps = useAnimatedProps(() => {
        return {
            strokeDashoffset: circumference * (1 - animatedProgress.value),
        };
    });

    // Colors for macros
    const proteinColor = '#4ECDC4'; // Teal
    const carbsColor = '#FFE66D';   // Yellow
    const fatColor = '#FF6B6B';     // Coral

    // Detail view data
    const detailData = {
        calories: { value: calories, target: calorieTarget, unit: 'kcal', color: colors.primary, label: 'Calories' },
        protein: { value: protein, target: proteinTarget, unit: 'g', color: proteinColor, label: 'Protein' },
        carbs: { value: carbs, target: carbsTarget, unit: 'g', color: carbsColor, label: 'Carbs' },
        fat: { value: fat, target: fatTarget, unit: 'g', color: fatColor, label: 'Fat' },
    };

    const currentDetail = detailData[showDetail];

    const cycleMacro = () => {
        const order: Array<'calories' | 'protein' | 'carbs' | 'fat'> = ['calories', 'protein', 'carbs', 'fat'];
        const idx = order.indexOf(showDetail);
        const next = order[(idx + 1) % order.length];
        setShowDetail(next);

        // Animate to new value
        const progress = Math.min(detailData[next].value / detailData[next].target, 1);
        animatedProgress.value = 0;
        animatedProgress.value = withTiming(progress, {
            duration: 600,
            easing: Easing.out(Easing.cubic),
        });
    };

    return (
        <View style={styles.container}>
            {/* Main Ring - Tappable to cycle macros */}
            <TouchableOpacity
                style={styles.chartContainer}
                onPress={cycleMacro}
                activeOpacity={0.8}
                accessibilityLabel={`${currentDetail.label}: ${currentDetail.value} of ${currentDetail.target}${currentDetail.unit}. Tap to cycle.`}
            >
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
                    {/* Animated progress circle */}
                    <AnimatedCircle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={currentDetail.color}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        animatedProps={animatedProps}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${center} ${center})`}
                    />
                </Svg>

                {/* Center Content */}
                <View style={styles.centerContent}>
                    {showDetail === 'calories' ? (
                        <>
                            <Text style={styles.remainingValue}>{remaining}</Text>
                            <Text style={styles.remainingLabel}>remaining</Text>
                        </>
                    ) : (
                        <>
                            <Text style={[styles.remainingValue, { color: currentDetail.color }]}>
                                {currentDetail.value}
                                <Text style={styles.unitText}>{currentDetail.unit}</Text>
                            </Text>
                            <Text style={styles.remainingLabel}>{currentDetail.label}</Text>
                        </>
                    )}
                </View>
            </TouchableOpacity>

            {/* Macro Bars - Tappable */}
            <View style={styles.macrosContainer}>
                {/* Protein */}
                <TouchableOpacity
                    style={[styles.macroRow, showDetail === 'protein' && styles.macroRowActive]}
                    onPress={() => {
                        setShowDetail('protein');
                        const progress = Math.min(protein / proteinTarget, 1);
                        animatedProgress.value = 0;
                        animatedProgress.value = withTiming(progress, { duration: 600, easing: Easing.out(Easing.cubic) });
                    }}
                    activeOpacity={0.7}
                >
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
                </TouchableOpacity>

                {/* Carbs */}
                <TouchableOpacity
                    style={[styles.macroRow, showDetail === 'carbs' && styles.macroRowActive]}
                    onPress={() => {
                        setShowDetail('carbs');
                        const progress = Math.min(carbs / carbsTarget, 1);
                        animatedProgress.value = 0;
                        animatedProgress.value = withTiming(progress, { duration: 600, easing: Easing.out(Easing.cubic) });
                    }}
                    activeOpacity={0.7}
                >
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
                </TouchableOpacity>

                {/* Fat */}
                <TouchableOpacity
                    style={[styles.macroRow, showDetail === 'fat' && styles.macroRowActive]}
                    onPress={() => {
                        setShowDetail('fat');
                        const progress = Math.min(fat / fatTarget, 1);
                        animatedProgress.value = 0;
                        animatedProgress.value = withTiming(progress, { duration: 600, easing: Easing.out(Easing.cubic) });
                    }}
                    activeOpacity={0.7}
                >
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
                </TouchableOpacity>
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
    unitText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
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
        gap: spacing.sm,
    },
    macroRow: {
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: borderRadius.sm,
    },
    macroRowActive: {
        backgroundColor: colors.glass.surfaceLight,
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
