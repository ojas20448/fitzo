import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { colors, spacing } from '../styles/theme';

interface CustomRefreshHeaderProps {
    refreshing: boolean;
}

export default function CustomRefreshHeader({ refreshing }: CustomRefreshHeaderProps) {
    const rotation = useSharedValue(0);

    useEffect(() => {
        if (refreshing) {
            rotation.value = withRepeat(
                withTiming(360, {
                    duration: 1000,
                    easing: Easing.linear,
                }),
                -1,
                false
            );
        } else {
            rotation.value = withTiming(0, { duration: 250 });
        }
    }, [refreshing]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            height: withTiming(refreshing ? 60 : 0, { duration: 250 }),
            opacity: withTiming(refreshing ? 1 : 0, { duration: 200 }),
            transform: [
                { scale: withTiming(refreshing ? 1 : 0.8, { duration: 250 }) },
            ],
        };
    });

    const rotateStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotate: `${rotation.value}deg` }],
        };
    });

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <View style={styles.spinnerContainer}>
                <Animated.View style={[styles.spinner, rotateStyle]}>
                    <View style={styles.spinnerGap} />
                </Animated.View>
                <View style={styles.centerDot} />
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    spinnerContainer: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: spacing.sm,
    },
    spinner: {
        position: 'absolute',
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spinnerGap: {
        position: 'absolute',
        top: -2,
        width: 10,
        height: 4,
        backgroundColor: colors.background, // Cutout to style it as a loading ring
    },
    centerDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
});
