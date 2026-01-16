import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface BadgeProps {
    label: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'muted';
    size?: 'sm' | 'md';
    icon?: React.ReactNode;
    style?: ViewStyle;
}

const Badge: React.FC<BadgeProps> = ({
    label,
    variant = 'default',
    size = 'md',
    icon,
    style,
}) => {
    const getVariantStyles = () => {
        switch (variant) {
            case 'primary':
                return {
                    backgroundColor: colors.primary,
                    textColor: colors.text.dark,
                    borderColor: colors.primary,
                };
            case 'success':
                return {
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    textColor: colors.crowd.low,
                    borderColor: 'rgba(34, 197, 94, 0.25)',
                };
            case 'warning':
                return {
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    textColor: colors.crowd.medium,
                    borderColor: 'rgba(245, 158, 11, 0.25)',
                };
            case 'error':
                return {
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    textColor: colors.error,
                    borderColor: 'rgba(239, 68, 68, 0.25)',
                };
            case 'info':
                return {
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    textColor: '#3B82F6',
                    borderColor: 'rgba(59, 130, 246, 0.25)',
                };
            case 'muted':
                return {
                    backgroundColor: colors.glass.surface,
                    textColor: colors.text.muted,
                    borderColor: colors.glass.border,
                };
            default:
                return {
                    backgroundColor: colors.glass.surface,
                    textColor: colors.text.primary,
                    borderColor: colors.glass.border,
                };
        }
    };

    const variantStyles = getVariantStyles();
    const isSmall = size === 'sm';

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: variantStyles.backgroundColor,
                    borderColor: variantStyles.borderColor,
                },
                isSmall && styles.containerSmall,
                style,
            ]}
        >
            {icon}
            <Text
                style={[
                    styles.text,
                    { color: variantStyles.textColor },
                    isSmall && styles.textSmall,
                ]}
            >
                {label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    containerSmall: {
        paddingVertical: 2,
        paddingHorizontal: spacing.sm,
    },
    text: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    textSmall: {
        fontSize: 10,
    },
});

export default Badge;
