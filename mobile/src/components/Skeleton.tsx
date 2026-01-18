import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, DimensionValue } from 'react-native';
import { colors, borderRadius } from '../styles/theme';

interface SkeletonProps {
    width?: DimensionValue;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

/**
 * Shimmer skeleton loading placeholder
 */
const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = 20,
    borderRadius: radius = borderRadius.md,
    style,
}) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [shimmerAnim]);

    const opacity = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <Animated.View
            style={[
                styles.skeleton,
                {
                    width,
                    height,
                    borderRadius: radius,
                    opacity,
                },
                style,
            ]}
        />
    );
};

// Pre-built skeleton patterns
export const SkeletonCard: React.FC<{ style?: ViewStyle }> = ({ style }) => (
    <View style={[styles.card, style]}>
        <View style={styles.cardHeader}>
            <Skeleton width={48} height={48} borderRadius={24} />
            <View style={styles.cardHeaderText}>
                <Skeleton width={120} height={16} />
                <Skeleton width={80} height={12} style={{ marginTop: 8 }} />
            </View>
        </View>
        <Skeleton width="100%" height={60} style={{ marginTop: 16 }} />
    </View>
);

export const SkeletonList: React.FC<{ count?: number; style?: ViewStyle }> = ({
    count = 3,
    style
}) => (
    <View style={style}>
        {Array.from({ length: count }).map((_, index) => (
            <View key={index} style={styles.listItem}>
                <Skeleton width={44} height={44} borderRadius={22} />
                <View style={styles.listItemContent}>
                    <Skeleton width="70%" height={14} />
                    <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
                </View>
            </View>
        ))}
    </View>
);

export const SkeletonStats: React.FC<{ style?: ViewStyle }> = ({ style }) => (
    <View style={[styles.statsRow, style]}>
        <View style={styles.statBox}>
            <Skeleton width={60} height={32} />
            <Skeleton width={40} height={12} style={{ marginTop: 8 }} />
        </View>
        <View style={styles.statBox}>
            <Skeleton width={60} height={32} />
            <Skeleton width={40} height={12} style={{ marginTop: 8 }} />
        </View>
        <View style={styles.statBox}>
            <Skeleton width={60} height={32} />
            <Skeleton width={40} height={12} style={{ marginTop: 8 }} />
        </View>
    </View>
);

export const SkeletonHomeScreen: React.FC = () => (
    <View style={styles.homeContainer}>
        {/* Header */}
        <View style={styles.homeHeader}>
            <View style={styles.cardHeader}>
                <Skeleton width={48} height={48} borderRadius={24} />
                <View style={styles.cardHeaderText}>
                    <Skeleton width={60} height={12} />
                    <Skeleton width={100} height={18} style={{ marginTop: 6 }} />
                </View>
            </View>
            <Skeleton width={100} height={40} borderRadius={borderRadius.lg} />
        </View>

        {/* Today's Focus */}
        <View style={styles.section}>
            <Skeleton width={100} height={14} style={{ marginBottom: 12 }} />
            <View style={styles.card}>
                <View style={styles.cardRow}>
                    <View style={{ flex: 1 }}>
                        <Skeleton width="80%" height={18} />
                        <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
                    </View>
                    <Skeleton width={32} height={32} borderRadius={16} />
                </View>
            </View>
        </View>

        {/* Weekly Progress */}
        <View style={styles.section}>
            <View style={styles.card}>
                <Skeleton width={120} height={14} />
                <View style={styles.weekRow}>
                    {Array.from({ length: 7 }).map((_, i) => (
                        <View key={i} style={styles.dayColumn}>
                            <Skeleton width={16} height={12} />
                            <Skeleton width={24} height={24} borderRadius={12} style={{ marginTop: 8 }} />
                        </View>
                    ))}
                </View>
            </View>
        </View>

        {/* Nutrition */}
        <View style={styles.section}>
            <View style={styles.card}>
                <Skeleton width={80} height={14} />
                <View style={styles.nutritionRow}>
                    <View style={{ flex: 1 }}>
                        <Skeleton width={80} height={28} />
                        <Skeleton width={60} height={10} style={{ marginTop: 6 }} />
                    </View>
                    <Skeleton width={1} height={30} />
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Skeleton width={60} height={20} />
                        <Skeleton width={50} height={10} style={{ marginTop: 6 }} />
                    </View>
                </View>
                <Skeleton width="100%" height={8} borderRadius={4} style={{ marginTop: 16 }} />
            </View>
        </View>

        {/* Quick Log */}
        <View style={styles.section}>
            <Skeleton width={80} height={14} style={{ marginBottom: 12 }} />
            <View style={styles.logRow}>
                <View style={styles.logButton}>
                    <Skeleton width={36} height={36} borderRadius={18} />
                    <View style={{ marginLeft: 12 }}>
                        <Skeleton width={60} height={14} />
                        <Skeleton width={40} height={10} style={{ marginTop: 4 }} />
                    </View>
                </View>
                <View style={styles.logButton}>
                    <Skeleton width={36} height={36} borderRadius={18} />
                    <View style={{ marginLeft: 12 }}>
                        <Skeleton width={60} height={14} />
                        <Skeleton width={40} height={10} style={{ marginTop: 4 }} />
                    </View>
                </View>
            </View>
        </View>
    </View>
);

export const SkeletonLesson: React.FC = () => (
    <View style={styles.homeContainer}>
        <View style={styles.cardHeader}>
            <Skeleton width={180} height={24} />
        </View>
        <Skeleton width="100%" height={250} borderRadius={borderRadius.xl} style={{ marginTop: 20 }} />
        <View style={{ marginTop: 24, gap: 12 }}>
            <Skeleton width="100%" height={14} />
            <Skeleton width="100%" height={14} />
            <Skeleton width="60%" height={14} />
        </View>
        <View style={{ marginTop: 40 }}>
            <Skeleton width="100%" height={56} borderRadius={28} />
        </View>
    </View>
);

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: colors.glass.surface,
    },
    card: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardHeaderText: {
        marginLeft: 12,
        flex: 1,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    listItemContent: {
        marginLeft: 12,
        flex: 1,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statBox: {
        alignItems: 'center',
    },
    homeContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    homeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    section: {
        marginBottom: 24,
    },
    weekRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
    },
    dayColumn: {
        alignItems: 'center',
    },
    nutritionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
    },
    logRow: {
        flexDirection: 'row',
        gap: 12,
    },
    logButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
});

export default Skeleton;
