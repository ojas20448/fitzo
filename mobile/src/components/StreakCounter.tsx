import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface StreakCounterProps {
    count: number;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

const StreakCounter: React.FC<StreakCounterProps> = ({
    count,
    showLabel = true,
    size = 'md',
}) => {
    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return {
                    number: typography.sizes.lg,
                    icon: 16,
                    unit: typography.sizes.xs,
                };
            case 'lg':
                return {
                    number: typography.sizes['4xl'],
                    icon: 32,
                    unit: typography.sizes.sm,
                };
            default:
                return {
                    number: typography.sizes['2xl'],
                    icon: 24,
                    unit: typography.sizes.sm,
                };
        }
    };

    const sizeStyles = getSizeStyles();

    const scale = useSharedValue(1);

    useEffect(() => {
        scale.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 1000 }),
                withTiming(1, { duration: 1000 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    return (
        <View style={styles.container}>
            {showLabel && (
                <Text style={styles.label}>Current Streak</Text>
            )}
            <View style={styles.countRow}>
                <Text style={[styles.number, { fontSize: sizeStyles.number }]}>
                    {count}
                </Text>
                <Text style={[styles.unit, { fontSize: sizeStyles.unit }]}>Days</Text>
                <Animated.Text style={[styles.fireIcon, { fontSize: sizeStyles.icon }, animatedStyle]}>🔥</Animated.Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    label: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginBottom: 2,
    },
    countRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing.xs,
    },
    number: {
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    unit: {
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    fireIcon: {
        marginLeft: spacing.xs,
    },
});

export default StreakCounter;
