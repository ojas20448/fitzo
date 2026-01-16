import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, ViewStyle, Animated } from 'react-native';
import { colors, borderRadius, typography } from '../styles/theme';

interface AvatarProps {
    uri?: string | null;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showOnline?: boolean;
    grayscale?: boolean;
    style?: ViewStyle;
}

const Avatar: React.FC<AvatarProps> = ({
    uri,
    name,
    size = 'md',
    showOnline = false,
    grayscale = false,
    style,
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    const getSize = (): number => {
        switch (size) {
            case 'sm':
                return 32;
            case 'lg':
                return 56;
            case 'xl':
                return 80;
            default:
                return 48;
        }
    };

    const getInitialsFontSize = (): number => {
        switch (size) {
            case 'sm':
                return 12;
            case 'lg':
                return 20;
            case 'xl':
                return 28;
            default:
                return 16;
        }
    };

    const getInitials = (): string => {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    };

    const dimension = getSize();
    const onlineIndicatorSize = Math.max(dimension / 5, 10);

    const handleLoad = () => {
        setLoading(false);
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
        }).start();
    };

    const handleError = () => {
        setLoading(false);
        setError(true);
    };

    const shouldShowImage = uri && !error;

    return (
        <View 
            style={[
                styles.container, 
                { width: dimension, height: dimension },
                style
            ]}
            accessibilityLabel={name ? `${name}'s avatar` : 'User avatar'}
        >
            {/* Initials fallback / loading background */}
            <View style={[
                styles.initialsContainer,
                { 
                    width: dimension, 
                    height: dimension, 
                    borderRadius: dimension / 2,
                },
                grayscale && styles.grayscale,
            ]}>
                <Text style={[styles.initials, { fontSize: getInitialsFontSize() }]}>
                    {getInitials()}
                </Text>
            </View>

            {/* Image overlay */}
            {shouldShowImage && (
                <Animated.Image
                    source={{ uri }}
                    style={[
                        styles.image,
                        { 
                            width: dimension, 
                            height: dimension, 
                            borderRadius: dimension / 2,
                            opacity: fadeAnim,
                        },
                        grayscale && styles.grayscale,
                    ]}
                    onLoad={handleLoad}
                    onError={handleError}
                />
            )}

            {/* Online indicator */}
            {showOnline && (
                <View
                    style={[
                        styles.onlineIndicator,
                        {
                            width: onlineIndicatorSize,
                            height: onlineIndicatorSize,
                            borderRadius: onlineIndicatorSize / 2,
                            borderWidth: dimension > 40 ? 2 : 1.5,
                        },
                    ]}
                    accessibilityLabel="Online"
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    initialsContainer: {
        position: 'absolute',
        backgroundColor: colors.glass.surface,
        borderWidth: 2,
        borderColor: colors.glass.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    initials: {
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
    },
    image: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: colors.primary,
    },
    grayscale: {
        opacity: 0.7,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: colors.crowd.low,
        borderColor: colors.background,
    },
});

export default Avatar;
