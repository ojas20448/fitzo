import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { colors, borderRadius, commonStyles, shadows, spacing } from '../styles/theme';

interface GlassCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    variant?: 'default' | 'active' | 'inactive' | 'primary' | 'subtle';
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Glass morphism card component with refined aesthetics
 * Uses subtle transparency and borders for depth
 */
const GlassCard: React.FC<GlassCardProps> = ({
    children,
    style,
    variant = 'default',
    padding = 'md',
}) => {
    const getVariantStyles = (): ViewStyle => {
        switch (variant) {
            case 'active':
            case 'primary':
                return {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    ...shadows.glowMd,
                };
            case 'inactive':
                return {
                    backgroundColor: colors.glass.surface,
                    borderColor: colors.glass.border,
                    opacity: 0.5,
                };
            case 'subtle':
                return {
                    backgroundColor: colors.glass.surface,
                    borderColor: 'transparent',
                };
            default:
                return {
                    backgroundColor: colors.glass.surface,
                    borderColor: colors.glass.border,
                };
        }
    };

    const getPadding = (): number => {
        switch (padding) {
            case 'none':
                return 0;
            case 'sm':
                return spacing.sm;
            case 'lg':
                return spacing.xl;
            case 'xl':
                return spacing['2xl'];
            default:
                return spacing.lg;
        }
    };

    return (
        <View
            style={[
                styles.base,
                getVariantStyles(),
                { padding: getPadding() },
                style,
            ]}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    base: {
        borderRadius: borderRadius['2xl'],
        borderWidth: 1,
        overflow: 'hidden',
    },
});

export default GlassCard;
