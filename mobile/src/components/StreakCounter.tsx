import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
                <Text style={[styles.fireIcon, { fontSize: sizeStyles.icon }]}>🔥</Text>
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
