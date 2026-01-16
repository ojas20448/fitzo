import React, { useState, useRef } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TextInputProps,
    ViewStyle,
    Animated,
    TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../styles/theme';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: keyof typeof MaterialIcons.glyphMap;
    rightIcon?: keyof typeof MaterialIcons.glyphMap;
    onRightIconPress?: () => void;
    containerStyle?: ViewStyle;
    required?: boolean;
}

const Input: React.FC<InputProps> = ({
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    required,
    ...textInputProps
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const focusAnim = useRef(new Animated.Value(0)).current;

    const handleFocus = (e: any) => {
        setIsFocused(true);
        Animated.timing(focusAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
        }).start();
        textInputProps.onFocus?.(e);
    };

    const handleBlur = (e: any) => {
        setIsFocused(false);
        Animated.timing(focusAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
        textInputProps.onBlur?.(e);
    };

    const borderColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            error ? colors.error : colors.glass.borderLight,
            error ? colors.error : colors.primary,
        ],
    });

    const backgroundColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.glass.surfaceLight, colors.glass.surfaceHover],
    });

    return (
        <View style={[styles.container, containerStyle]}>
            {label && (
                <Text style={styles.label}>
                    {label}
                    {required && <Text style={styles.required}> *</Text>}
                </Text>
            )}

            <Animated.View
                style={[
                    styles.inputContainer,
                    {
                        borderColor,
                        backgroundColor,
                    },
                    isFocused && styles.inputFocused,
                    error && styles.inputError,
                ]}
            >
                {leftIcon && (
                    <MaterialIcons
                        name={leftIcon}
                        size={20}
                        color={isFocused ? colors.primary : colors.text.muted}
                        style={styles.leftIcon}
                    />
                )}

                <TextInput
                    {...textInputProps}
                    style={[
                        styles.input,
                        leftIcon && styles.inputWithLeftIcon,
                        rightIcon && styles.inputWithRightIcon,
                        textInputProps.style,
                    ]}
                    placeholderTextColor={colors.text.muted}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    accessibilityLabel={label || textInputProps.placeholder}
                />

                {rightIcon && (
                    <TouchableOpacity
                        onPress={onRightIconPress}
                        style={styles.rightIconBtn}
                        accessibilityLabel={`Toggle ${label || 'input'}`}
                        disabled={!onRightIconPress}
                    >
                        <MaterialIcons
                            name={rightIcon}
                            size={20}
                            color={colors.text.muted}
                        />
                    </TouchableOpacity>
                )}
            </Animated.View>

            {(error || helperText) && (
                <Text style={[styles.helperText, error && styles.errorText]}>
                    {error || helperText}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
        letterSpacing: typography.letterSpacing.wide,
    },
    required: {
        color: colors.error,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        height: 56,
        paddingHorizontal: spacing.lg,
    },
    inputFocused: {
        ...shadows.glow,
    },
    inputError: {
        borderColor: colors.error,
    },
    leftIcon: {
        marginRight: spacing.md,
    },
    input: {
        flex: 1,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        height: '100%',
    },
    inputWithLeftIcon: {
        paddingLeft: 0,
    },
    inputWithRightIcon: {
        paddingRight: spacing.md,
    },
    rightIconBtn: {
        padding: spacing.sm,
        marginRight: -spacing.sm,
    },
    helperText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    errorText: {
        color: colors.error,
        fontFamily: typography.fontFamily.medium,
    },
});

export default Input;
