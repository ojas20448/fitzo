import React, { useRef } from 'react';
import {
    TouchableOpacity,
    Pressable,
    Text,
    StyleSheet,
    ViewStyle,
    TextStyle,
    ActivityIndicator,
    Animated,
    Platform,
    View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, borderRadius, spacing } from '../styles/theme';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    iconRight?: React.ReactNode;
    fullWidth?: boolean;
    style?: ViewStyle;
    accessibilityLabel?: string;
    accessibilityHint?: string;
}

const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    icon,
    iconRight,
    fullWidth = false,
    style,
    accessibilityLabel,
    accessibilityHint,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
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
        if (!disabled && !loading) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
        }
    };

    const getButtonStyles = (): ViewStyle => {
        const baseStyles: ViewStyle = {
            ...styles.base,
            ...getSizeStyles(),
        };

        switch (variant) {
            case 'primary':
                return {
                    ...baseStyles,
                    backgroundColor: disabled ? colors.glass.surface : colors.primary,
                    borderWidth: 0,
                };
            case 'secondary':
                return {
                    ...baseStyles,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: disabled ? colors.glass.border : colors.glass.border,
                };
            case 'ghost':
                return {
                    ...baseStyles,
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                };
            case 'danger':
                return {
                    ...baseStyles,
                    backgroundColor: disabled ? colors.glass.surface : colors.error,
                    borderWidth: 0,
                };
            case 'outline':
                return {
                    ...baseStyles,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderColor: disabled ? colors.text.muted : colors.primary,
                };
            default:
                return baseStyles;
        }
    };

    const getTextStyles = (): TextStyle => {
        const baseStyles: TextStyle = {
            ...styles.text,
            ...getTextSizeStyles(),
        };

        switch (variant) {
            case 'primary':
            case 'danger':
                return {
                    ...baseStyles,
                    color: disabled ? colors.text.muted : colors.text.dark,
                };
            case 'secondary':
            case 'ghost':
                return {
                    ...baseStyles,
                    color: disabled ? colors.text.muted : colors.text.primary,
                };
            case 'outline':
                return {
                    ...baseStyles,
                    color: disabled ? colors.text.muted : colors.primary,
                };
            default:
                return baseStyles;
        }
    };

    const getSizeStyles = (): ViewStyle => {
        switch (size) {
            case 'sm':
                return { 
                    paddingVertical: spacing.sm, 
                    paddingHorizontal: spacing.lg,
                    minHeight: 36,
                };
            case 'lg':
                return { 
                    paddingVertical: spacing.xl, 
                    paddingHorizontal: spacing['2xl'],
                    minHeight: 56,
                };
            default:
                return { 
                    paddingVertical: spacing.lg, 
                    paddingHorizontal: spacing.xl,
                    minHeight: 48, // Ensure minimum touch target
                };
        }
    };

    const getTextSizeStyles = (): TextStyle => {
        switch (size) {
            case 'sm':
                return { fontSize: typography.sizes.sm };
            case 'lg':
                return { fontSize: typography.sizes.lg };
            default:
                return { fontSize: typography.sizes.base };
        }
    };

    // Use Pressable for Android ripple, TouchableOpacity for iOS
    const ButtonComponent = Platform.OS === 'android' ? Pressable : TouchableOpacity;

    const androidRipple = Platform.OS === 'android' ? {
        color: variant === 'primary' || variant === 'danger' 
            ? 'rgba(0,0,0,0.2)' 
            : 'rgba(255,255,255,0.2)',
        borderless: false,
    } : undefined;

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }], width: fullWidth ? '100%' : undefined }}>
            <ButtonComponent
                style={({ pressed }: { pressed?: boolean }) => [
                    getButtonStyles(),
                    fullWidth && styles.fullWidth,
                    variant === 'primary' && !disabled && styles.primaryShadow,
                    variant === 'danger' && !disabled && styles.dangerShadow,
                    Platform.OS === 'ios' && pressed && styles.pressed,
                    style,
                ]}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                android_ripple={androidRipple}
                accessibilityLabel={accessibilityLabel || title}
                accessibilityHint={accessibilityHint}
                accessibilityRole="button"
                accessibilityState={{ disabled: disabled || loading }}
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator
                            color={variant === 'primary' || variant === 'danger' ? colors.text.dark : colors.text.primary}
                            size="small"
                        />
                    </View>
                ) : (
                    <View style={styles.contentContainer}>
                        {icon && <View style={styles.iconLeft}>{icon}</View>}
                        <Text style={getTextStyles()}>{title}</Text>
                        {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
                    </View>
                )}
            </ButtonComponent>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
        overflow: 'hidden', // Required for Android ripple
    },
    fullWidth: {
        width: '100%',
    },
    text: {
        fontFamily: typography.fontFamily.bold,
        textAlign: 'center',
    },
    primaryShadow: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
    },
    dangerShadow: {
        shadowColor: colors.error,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    pressed: {
        opacity: 0.85,
    },
    loadingContainer: {
        height: 20,
        justifyContent: 'center',
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconLeft: {
        marginRight: spacing.sm,
    },
    iconRight: {
        marginLeft: spacing.sm,
    },
});

export default Button;
