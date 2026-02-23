import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Modal, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

const { width, height } = Dimensions.get('window');

interface CelebrationProps {
    visible: boolean;
    type?: 'streak' | 'xp' | 'workout' | 'calories' | 'achievement';
    title: string;
    subtitle?: string;
    value?: string | number;
    onComplete?: () => void;
    duration?: number;
}

const Celebration: React.FC<CelebrationProps> = ({
    visible,
    type = 'xp',
    title,
    subtitle,
    value,
    onComplete,
    duration = 2500,
}) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const confettiAnims = useRef(
        Array.from({ length: 20 }, () => ({
            translateY: new Animated.Value(-50),
            translateX: new Animated.Value(0),
            rotate: new Animated.Value(0),
            opacity: new Animated.Value(1),
        }))
    ).current;

    const getIcon = () => {
        switch (type) {
            case 'streak':
                return { name: 'local-fire-department' as const, color: '#FF6B35' };
            case 'xp':
                return { name: 'diamond' as const, color: colors.crowd.medium };
            case 'workout':
                return { name: 'fitness-center' as const, color: colors.primary };
            case 'calories':
                return { name: 'restaurant' as const, color: colors.crowd.low };
            case 'achievement':
                return { name: 'emoji-events' as const, color: '#FFD700' };
            default:
                return { name: 'check-circle' as const, color: colors.primary };
        }
    };

    useEffect(() => {
        if (visible) {
            // Haptic feedback
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Main element animation
            Animated.sequence([
                Animated.parallel([
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        tension: 50,
                        friction: 3,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.delay(duration - 500),
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 0.8,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacityAnim, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ]),
            ]).start(() => {
                scaleAnim.setValue(0);
                opacityAnim.setValue(0);
                onComplete?.();
            });

            // Confetti animation
            confettiAnims.forEach((anim, index) => {
                const randomX = (Math.random() - 0.5) * width;
                const randomDelay = Math.random() * 200;

                Animated.sequence([
                    Animated.delay(randomDelay),
                    Animated.parallel([
                        Animated.timing(anim.translateY, {
                            toValue: height + 100,
                            duration: 1500 + Math.random() * 500,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim.translateX, {
                            toValue: randomX,
                            duration: 1500 + Math.random() * 500,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim.rotate, {
                            toValue: Math.random() * 10 - 5,
                            duration: 1500,
                            useNativeDriver: true,
                        }),
                        Animated.sequence([
                            Animated.delay(1000),
                            Animated.timing(anim.opacity, {
                                toValue: 0,
                                duration: 500,
                                useNativeDriver: true,
                            }),
                        ]),
                    ]),
                ]).start(() => {
                    anim.translateY.setValue(-50);
                    anim.translateX.setValue(0);
                    anim.rotate.setValue(0);
                    anim.opacity.setValue(1);
                });
            });
        }
    }, [visible]);

    const iconConfig = getIcon();
    const confettiColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', colors.primary];

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none">
            <Pressable style={styles.overlay} onPress={() => {
                onComplete?.();
            }}>
                {/* Confetti */}
                {confettiAnims.map((anim, index) => (
                    <Animated.View
                        key={index}
                        style={[
                            styles.confetti,
                            {
                                left: width * 0.5 + (Math.random() - 0.5) * 100,
                                backgroundColor: confettiColors[index % confettiColors.length],
                                width: 8 + Math.random() * 8,
                                height: 8 + Math.random() * 8,
                                borderRadius: Math.random() > 0.5 ? 50 : 2,
                                transform: [
                                    { translateY: anim.translateY },
                                    { translateX: anim.translateX },
                                    {
                                        rotate: anim.rotate.interpolate({
                                            inputRange: [-5, 5],
                                            outputRange: ['-180deg', '180deg'],
                                        }),
                                    },
                                ],
                                opacity: anim.opacity,
                            },
                        ]}
                    />
                ))}

                {/* Main Content */}
                <Animated.View
                    style={[
                        styles.content,
                        {
                            transform: [{ scale: scaleAnim }],
                            opacity: opacityAnim,
                        },
                    ]}
                >
                    <View style={[styles.iconCircle, { borderColor: iconConfig.color }]}>
                        <MaterialIcons name={iconConfig.name} size={48} color={iconConfig.color} />
                    </View>

                    {value && (
                        <Text style={styles.value}>+{value}</Text>
                    )}

                    <Text style={styles.title}>{title}</Text>
                    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                </Animated.View>
            </Pressable>
        </Modal>
    );
};

// Quick celebration for inline use
export const CelebrationBadge: React.FC<{
    visible: boolean;
    value: string | number;
    label?: string;
}> = ({ visible, value, label }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Animated.sequence([
                Animated.spring(scaleAnim, {
                    toValue: 1.2,
                    tension: 100,
                    friction: 3,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    tension: 100,
                    friction: 5,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.badge,
                { transform: [{ scale: scaleAnim }] },
            ]}
        >
            <Text style={styles.badgeValue}>+{value}</Text>
            {label && <Text style={styles.badgeLabel}>{label}</Text>}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        padding: spacing['2xl'],
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.glass.surface,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    value: {
        fontSize: typography.sizes['4xl'],
        fontFamily: typography.fontFamily.extraBold,
        color: colors.primary,
        marginBottom: spacing.sm,
    },
    title: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    confetti: {
        position: 'absolute',
        top: 0,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.crowd.low,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: borderRadius.full,
        gap: 4,
    },
    badgeValue: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
    },
    badgeLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.background,
    },
});

export default Celebration;
