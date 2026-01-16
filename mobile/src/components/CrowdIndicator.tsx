import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface CrowdIndicatorProps {
    level: 'low' | 'medium' | 'high';
    count?: number;
    showLabel?: boolean;
    size?: 'sm' | 'md';
}

const CrowdIndicator: React.FC<CrowdIndicatorProps> = ({
    level,
    count,
    showLabel = true,
    size = 'md',
}) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        // Pulsing animation for the live dot
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );

        // Glow opacity animation
        const glowLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 0.8,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0.4,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );

        pulseLoop.start();
        glowLoop.start();

        return () => {
            pulseLoop.stop();
            glowLoop.stop();
        };
    }, []);

    const getColor = (): string => {
        switch (level) {
            case 'low':
                return colors.crowd.low;
            case 'medium':
                return colors.crowd.medium;
            case 'high':
                return colors.crowd.high;
            default:
                return colors.crowd.low;
        }
    };

    const getLabel = (): string => {
        switch (level) {
            case 'low':
                return 'Not Crowded';
            case 'medium':
                return 'Moderate';
            case 'high':
                return 'Very Busy';
            default:
                return 'Not Crowded';
        }
    };

    const color = getColor();
    const isSmall = size === 'sm';

    return (
        <View style={styles.container}>
            <View style={styles.indicatorRow}>
                <View style={styles.dotContainer}>
                    {/* Glow ring */}
                    <Animated.View
                        style={[
                            styles.dotGlow,
                            {
                                backgroundColor: color,
                                opacity: glowAnim,
                                transform: [{ scale: pulseAnim }],
                            },
                            isSmall && styles.dotGlowSmall,
                        ]}
                    />
                    {/* Core dot */}
                    <View
                        style={[
                            styles.dot,
                            { backgroundColor: color },
                            isSmall && styles.dotSmall,
                        ]}
                    />
                </View>
                {!isSmall && (
                    <Text style={[styles.liveText, { color }]}>LIVE</Text>
                )}
            </View>

            {showLabel && (
                <View style={styles.labelContainer}>
                    <Text style={[styles.label, isSmall && styles.labelSmall]}>
                        {isSmall ? 'Crowd' : 'Gym Crowd'}
                    </Text>
                    <Text style={[styles.status, isSmall && styles.statusSmall]}>
                        {getLabel()}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    indicatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    dotContainer: {
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dotGlow: {
        position: 'absolute',
        width: 18,
        height: 18,
        borderRadius: 9,
    },
    dotGlowSmall: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    dotSmall: {
        width: 8,
        height: 8,
    },
    liveText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: typography.letterSpacing.wider,
    },
    labelContainer: {
        marginTop: spacing.sm,
    },
    label: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginBottom: 2,
    },
    labelSmall: {
        fontSize: 10,
    },
    status: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    statusSmall: {
        fontSize: typography.sizes.sm,
    },
});

export default CrowdIndicator;
