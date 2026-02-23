import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle, StyleProp } from 'react-native';
import { colors, borderRadius, commonStyles, spacing } from '../styles/theme';

interface GlassCardProps extends ViewProps {
    variant?: 'default' | 'light' | 'inactive';
    style?: StyleProp<ViewStyle>;
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | string;
    children: React.ReactNode;
}

const GlassCard: React.FC<GlassCardProps> = ({
    children,
    style,
    variant = 'default',
    padding,
    ...props
}) => {
    const getVariantStyle = () => {
        switch (variant) {
            case 'light':
                return commonStyles.glassPanelLight;
            case 'inactive':
                return styles.inactive;
            default:
                return commonStyles.glassPanel;
        }
    };

    const getPaddingStyle = (): ViewStyle => {
        if (!padding) return {};
        switch (padding) {
            case 'none':
                return { padding: 0 };
            case 'sm':
                return { padding: spacing.sm };
            case 'md':
                return { padding: spacing.md };
            case 'lg':
                return { padding: spacing.lg };
            case 'xl':
                return { padding: spacing.xl };
            default:
                return {};
        }
    };

    return (
        <View style={[getVariantStyle(), styles.card, getPaddingStyle(), style]} {...props}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        overflow: 'hidden',
    },
    inactive: {
        backgroundColor: 'rgba(20, 20, 20, 0.4)', // Slightly darker/more transparent than default
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: borderRadius.xl,
    }
});

export default GlassCard;
