import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { colors, borderRadius } from '../styles/theme';

interface SkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    borderRadius?: number;
    style?: ViewStyle;
    color?: string;
    lightColor?: string;
}

export const Skeleton = ({
    width = '100%',
    height = 20,
    borderRadius: radius = borderRadius.md,
    style,
    color = 'rgba(255, 255, 255, 0.1)',
    lightColor = 'rgba(255, 255, 255, 0.2)',
}: SkeletonProps) => {
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
        };
    });

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width,
                    height,
                    borderRadius: radius,
                    backgroundColor: color,
                },
                animatedStyle,
                style,
            ]}
        />
    );

};

export const SkeletonCard = ({ style }: { style?: ViewStyle }) => {
    return (
        <View style={[styles.card, style]}>
            <Skeleton width="60%" height={24} style={{ marginBottom: 12 }} />
            <Skeleton width="40%" height={16} />
        </View>
    );
};

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: colors.surface,
        overflow: 'hidden',
    },
    card: {
        padding: 16,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    // Home Skeleton Styles
    homeContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    homeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    homeHeaderLeft: {
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
});

// ... styles

export const SkeletonHomeScreen = () => {
    return (
        <View style={styles.homeContainer}>
            {/* Header */}
            <View style={styles.homeHeader}>
                <View style={styles.homeHeaderLeft}>
                    <Skeleton width={48} height={48} borderRadius={24} />
                    <View style={{ gap: 4 }}>
                        <Skeleton width={100} height={12} />
                        <Skeleton width={140} height={24} />
                    </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Skeleton width={40} height={40} borderRadius={20} />
                    <Skeleton width={60} height={40} borderRadius={20} />
                </View>
            </View>

            {/* Today's Training */}
            <Skeleton width="100%" height={24} style={{ marginBottom: 12 }} />
            <Skeleton width="80%" height={40} style={{ marginBottom: 32 }} />

            {/* Actions */}
            <View style={styles.row}>
                <Skeleton width="48%" height={64} borderRadius={16} />
                <Skeleton width="48%" height={64} borderRadius={16} />
            </View>

            {/* Sections */}
            <SkeletonCard style={{ marginBottom: 24 }} />
            <SkeletonCard style={{ marginBottom: 24 }} />
        </View>
    );
};



export const SkeletonList = ({ count = 3 }: { count?: number }) => {
    return (
        <View>
            {Array.from({ length: count }).map((_, index) => (
                <SkeletonCard key={index} style={{ marginBottom: 16 }} />
            ))}
        </View>
    );
};

export const SkeletonLesson = () => {
    return (
        <View style={{ padding: 20 }}>
            {/* Title */}
            <Skeleton width="80%" height={32} style={{ marginBottom: 16 }} />
            {/* Description */}
            <Skeleton width="60%" height={16} style={{ marginBottom: 32 }} />
            {/* Content blocks */}
            <Skeleton width="100%" height={120} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={80} style={{ marginBottom: 16 }} />
            <Skeleton width="90%" height={60} style={{ marginBottom: 32 }} />
            {/* Button */}
            <Skeleton width="100%" height={52} borderRadius={26} />
        </View>
    );
};

export default Skeleton;
