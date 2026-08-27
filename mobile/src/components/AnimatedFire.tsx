import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    Easing,
    useReducedMotion,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../styles/theme';

interface AnimatedFireProps {
    size?: number;
    color?: string;
}

const AnimatedFire: React.FC<AnimatedFireProps> = ({
    size = 24,
    color = colors.accent.orange
}) => {
    // Animation shared values
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.8);
    const innerScale = useSharedValue(1);
    // Honor the OS reduce-motion setting with a still flame — the streak
    // stays legible, nothing loops.
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (reduceMotion) return;

        // Breathing scale effect
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1, // Infinite
            true // Reverse
        );

        // Flickering opacity effect
        opacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 200 }),
                withTiming(0.7, { duration: 300 }),
                withTiming(0.9, { duration: 150 }),
                withTiming(0.8, { duration: 400 })
            ),
            -1,
            true
        );

        // Inner fire varied pulsing
        innerScale.value = withDelay(
            150,
            withRepeat(
                withSequence(
                    withTiming(0.8, { duration: 800 }),
                    withTiming(1, { duration: 800 })
                ),
                -1,
                true
            )
        );
    }, [reduceMotion]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            opacity: opacity.value,
        };
    });

    const innerAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: innerScale.value }],
            opacity: 0.8, // Slightly transparent overlay
        };
    });

    return (
        <View
            style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}
            accessible
            accessibilityLabel="Streak flame"
        >
            {/* Main Fire */}
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                <MaterialIcons name="local-fire-department" size={size} color={color} />
            </Animated.View>

            {/* Inner Core (Hotter/Yellow) */}
            <Animated.View style={[StyleSheet.absoluteFill, innerAnimatedStyle, { justifyContent: 'center', alignItems: 'center', marginTop: size * 0.1 }]}>
                <MaterialIcons name="local-fire-department" size={size * 0.7} color={colors.accent.gold} />
            </Animated.View>
        </View>
    );
};

export default AnimatedFire;
