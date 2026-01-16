import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, typography, borderRadius, spacing } from '../styles/theme';
import GlassCard from './GlassCard';
import { MaterialIcons } from '@expo/vector-icons';

interface NutritionAnalyticsProps {
    calories: {
        total_calories: number;
        entry_count: number;
    };
    target?: number; // Default 2500 if not provided
}

const NutritionAnalytics: React.FC<NutritionAnalyticsProps> = ({ calories, target = 2500 }) => {
    const progressAnim = useRef(new Animated.Value(0)).current;
    
    const current = calories.total_calories || 0;
    const percentage = (current / target) * 100;
    const remaining = Math.max(target - current, 0);

    useEffect(() => {
        // Animate progress bar on mount or value change
        Animated.timing(progressAnim, {
            toValue: Math.min(percentage, 100),
            duration: 800,
            useNativeDriver: false, // Width animation requires non-native
        }).start();
    }, [percentage]);

    // Color State Logic

    // Color State Logic
    let statusColor = colors.crowd.low; // Default Green (on track)
    let statusLabel = 'On Track';

    // If < 50% -> Green (Start)
    // If 50-85% -> Green (Good)
    // If 85-100% -> Orange (Approaching Limit)
    // If > 100% -> Red (Exceeded)

    if (percentage > 100) {
        statusColor = colors.crowd.high; // Red
        statusLabel = 'Exceeded';
    } else if (percentage >= 85) {
        statusColor = colors.crowd.medium; // Orange
        statusLabel = 'Near Limit';
    }

    // Segmented bar calculation (e.g., 4 segments)
    const segments = [1, 2, 3, 4];

    return (
        <GlassCard padding="lg">
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <View style={[styles.iconBox, { backgroundColor: statusColor }]}>
                        <MaterialIcons name="restaurant" size={14} color={colors.background} />
                    </View>
                    <Text style={styles.title}>Nutrition</Text>
                </View>
                <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
            </View>

            <View style={styles.mainContent}>
                <View style={styles.statsColumn}>
                    <Text style={styles.mainValue}>{current}</Text>
                    <Text style={styles.subLabel}>kcal consumed</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statsColumn}>
                    <Text style={styles.targetValue}>{target}</Text>
                    <Text style={styles.subLabel}>daily target</Text>
                </View>
            </View>

            {/* Visual Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={styles.barBackground}>
                    <Animated.View
                        style={[
                            styles.barFill,
                            {
                                width: progressAnim.interpolate({
                                    inputRange: [0, 100],
                                    outputRange: ['0%', '100%'],
                                }),
                                backgroundColor: statusColor
                            }
                        ]}
                    />
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.remainingText}>
                    {percentage > 100
                        ? `${current - target} kcal over`
                        : `${remaining} kcal remaining`
                    }
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
        marginBottom: spacing.lg,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    iconBox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    statusLabel: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    mainContent: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    statsColumn: {
        flex: 1,
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: colors.glass.border,
        marginHorizontal: spacing.md,
    },
    mainValue: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    targetValue: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    subLabel: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: 2,
    },
    progressContainer: {
        height: 8,
        backgroundColor: colors.glass.surface,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    barBackground: {
        flex: 1,
    },
    barFill: {
        height: '100%',
        borderRadius: 4,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    remainingText: {
        fontSize: 10,
        color: colors.text.secondary,
        fontFamily: typography.fontFamily.medium,
    },
});

export default NutritionAnalytics;
