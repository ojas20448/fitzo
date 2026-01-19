import React from 'react';
import { View, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import { colors, borderRadius, commonStyles } from '../styles/theme';

interface GlassCardProps extends ViewProps {
    variant?: 'default' | 'light' | 'inactive';
    style?: ViewStyle;
    children: React.ReactNode;
}

const GlassCard: React.FC<GlassCardProps> = ({
    children,
    style,
    variant = 'default',
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

    return (
        <View style={[getVariantStyle(), styles.card, style]} {...props}>
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
