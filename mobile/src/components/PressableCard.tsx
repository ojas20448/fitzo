import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, ViewStyle, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, borderRadius, spacing } from '../styles/theme';

interface PressableCardProps {
    children: React.ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
    variant?: 'default' | 'active' | 'elevated';
    style?: ViewStyle;
    haptic?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
}

/**
 * A pressable card component with micro-interactions.
 * - Scale animation on press
 * - Haptic feedback
 * - Proper touch targets
 * - Android ripple support
 */
const PressableCard: React.FC<PressableCardProps> = ({
    children,
    onPress,
    onLongPress,
    disabled = false,
    variant = 'default',
    style,
    haptic = true,
    accessibilityLabel,
    accessibilityHint,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.98,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePress = () => {
        if (haptic) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.();
    };

    const handleLongPress = () => {
        if (haptic) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onLongPress?.();
    };

    const getVariantStyles = (): ViewStyle => {
        switch (variant) {
            case 'active':
                return {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                };
            case 'elevated':
                return {
                    backgroundColor: colors.surface,
                    borderColor: colors.glass.border,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                };
            default:
                return {
                    backgroundColor: colors.glass.surface,
                    borderColor: colors.glass.border,
                };
        }
    };

    const androidRipple = Platform.OS === 'android' && onPress ? {
        color: variant === 'active' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)',
        borderless: false,
    } : undefined;

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Pressable
                onPress={onPress ? handlePress : undefined}
                onLongPress={onLongPress ? handleLongPress : undefined}
                onPressIn={onPress ? handlePressIn : undefined}
                onPressOut={onPress ? handlePressOut : undefined}
                disabled={disabled}
                android_ripple={androidRipple}
                style={({ pressed }) => [
                    styles.card,
                    getVariantStyles(),
                    disabled && styles.disabled,
                    Platform.OS === 'ios' && pressed && styles.pressed,
                    style,
                ]}
                accessibilityLabel={accessibilityLabel}
                accessibilityHint={accessibilityHint}
                accessibilityRole={onPress ? 'button' : undefined}
                accessibilityState={{ disabled }}
            >
                {children}
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        padding: spacing.lg,
        minHeight: 48, // Minimum touch target
        overflow: 'hidden',
    },
    disabled: {
        opacity: 0.5,
    },
    pressed: {
        opacity: 0.9,
    },
});

export default PressableCard;
