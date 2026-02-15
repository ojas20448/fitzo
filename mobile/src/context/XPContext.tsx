import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Easing, Platform, TouchableOpacity } from 'react-native';
import { useSharedValue, useAnimatedStyle, withTiming, withRepeat } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, shadows, borderRadius, spacing } from '../styles/theme';
import { useAuth } from './AuthContext';

interface XPContextType {
    awardXP: (amount: number, startX?: number, startY?: number) => void;
    triggerLevelUp: (newLevel: number) => void;
}

const XPContext = createContext<XPContextType | undefined>(undefined);

export const useXP = () => {
    const context = useContext(XPContext);
    if (!context) throw new Error('useXP must be used within an XPProvider');
    return context;
};

export const XPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [xpAward, setXpAward] = useState<{ amount: number, x: number, y: number, id: number }[]>([]);
    const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);

    const triggerLevelUp = useCallback((newLevel: number) => {
        setLevelUpData({ level: newLevel });
        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); // Stronger haptic
        }
    }, []);

    const awardXP = useCallback((amount: number, startX?: number, startY?: number) => {
        const x = startX || Dimensions.get('window').width / 2;
        const y = startY || Dimensions.get('window').height / 2;
        const id = Date.now();

        setXpAward(prev => [...prev, { amount, x, y, id }]);

        if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        setTimeout(() => {
            setXpAward(prev => prev.filter(item => item.id !== id));
        }, 2000);

        // Level-Up Logic
        if (user) {
            const currentXP = user.xp_points || 0;
            const newTotalXP = currentXP + amount;

            const oldLevel = Math.floor(currentXP / 100) + 1;
            const newLevel = Math.floor(newTotalXP / 100) + 1;

            if (newLevel > oldLevel) {
                // Delay level-up moment slightly to let flying XP finish
                setTimeout(() => {
                    triggerLevelUp(newLevel);
                }, 1200);
            }
        }
    }, [user, triggerLevelUp]);

    return (
        <XPContext.Provider value={{ awardXP, triggerLevelUp }}>
            {children}
            {xpAward.map(item => (
                <FlyingXP key={item.id} amount={item.amount} startX={item.x} startY={item.y} />
            ))}
            {levelUpData && (
                <LevelUpCelebration
                    level={levelUpData.level}
                    onClose={() => setLevelUpData(null)}
                />
            )}
        </XPContext.Provider>
    );
};

const LevelUpCelebration = ({ level, onClose }: { level: number, onClose: () => void }) => {
    const scale = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scale, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <View style={styles.celebrationOverlay}>
            <ConfettiSystem />
            <Animated.View style={[styles.levelUpCard, { transform: [{ scale }], opacity }]}>
                <View style={styles.glowContainer}>
                    <View style={styles.glowCircle} />
                </View>
                <MaterialIcons name="stars" size={80} color={colors.primary} />
                <Text style={styles.levelUpTitle}>LEVEL UP!</Text>
                <View style={styles.levelCircleBig}>
                    <Text style={styles.levelNumberBig}>{level}</Text>
                </View>
                <Text style={styles.levelUpDesc}>You've reached a new peak.</Text>

                <TouchableOpacity style={styles.continueBtn} onPress={onClose}>
                    <Text style={styles.continueText}>CONTINUE</Text>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

// Sub-component for individual flying XP
const FlyingXP = ({ amount, startX, startY }: { amount: number, startX: number, startY: number }) => {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            // Pop out
            Animated.spring(anim, {
                toValue: 1,
                useNativeDriver: true,
                friction: 5,
                tension: 100
            }),
            // Fly to top left (Profile Area)
            Animated.timing(anim, {
                toValue: 2,
                duration: 800,
                easing: Easing.in(Easing.exp),
                useNativeDriver: true
            })
        ]).start();
    }, []);

    const translateX = anim.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [0, 0, -startX + 40]
    });

    const translateY = anim.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [0, -50, -startY + 60]
    });

    const scale = anim.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [0, 1.5, 0.5]
    });

    const opacity = anim.interpolate({
        inputRange: [0, 1, 1.8, 2],
        outputRange: [0, 1, 1, 0]
    });

    return (
        <Animated.View
            style={[
                styles.flyingContainer,
                {
                    left: startX,
                    top: startY,
                    transform: [
                        { translateX },
                        { translateY },
                        { scale }
                    ],
                    opacity
                }
            ]}
            pointerEvents="none"
        >
            <View style={styles.xpPill}>
                <MaterialIcons name="bolt" size={20} color={colors.text.dark} />
                <Text style={styles.xpText}>+{amount} XP</Text>
            </View>
        </Animated.View>
    );
};

const ConfettiSystem = () => {
    // Generate 50 particles
    const particles = Array.from({ length: 50 }).map((_, i) => i);

    return (
        <View style={styles.confettiContainer} pointerEvents="none">
            {particles.map((i) => (
                <ConfettiParticle key={i} index={i} />
            ))}
        </View>
    );
};

const ConfettiParticle = ({ index }: { index: number }) => {
    // Random starting positions and trajectories
    const randomX = Math.random() * Dimensions.get('window').width;
    const randomDelay = Math.random() * 500;
    const randomColor = [colors.primary, '#FFD700', '#FF6B35', '#4CD964', '#5AC8FA'][Math.floor(Math.random() * 5)];

    const translateY = useSharedValue(0);
    const opacity = useSharedValue(1);
    const rotate = useSharedValue(0);

    useEffect(() => {
        translateY.value = withTiming(Dimensions.get('window').height, {
            duration: 2000 + Math.random() * 1000,
            easing: Easing.out(Easing.quad),
        });

        rotate.value = withRepeat(withTiming(360, { duration: 1000 }), -1);

        opacity.value = withTiming(0, {
            duration: 2500,
            easing: Easing.in(Easing.quad)
        });
    }, []);

    const style = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: translateY.value },
                { rotate: `${rotate.value}deg` }
            ],
            opacity: opacity.value
        };
    });

    return (
        <Animated.View
            style={[
                styles.confettiPiece,
                style,
                { left: randomX, backgroundColor: randomColor }
            ]}
        />
    );
};

const styles = StyleSheet.create({
    celebrationOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
    },
    confettiContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    confettiPiece: {
        position: 'absolute',
        top: -20,
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    levelUpCard: {
        width: Dimensions.get('window').width * 0.8,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.primary,
        ...shadows.glowLg,
        zIndex: 10001,
    },
    glowContainer: {
        position: 'absolute',
        top: -50,
        zIndex: -1,
    },
    glowCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: colors.primary,
        opacity: 0.15,
        filter: 'blur(40px)',
    },
    levelUpTitle: {
        fontSize: typography.sizes['3xl'],
        fontFamily: typography.fontFamily.extraBold,
        color: colors.primary,
        marginTop: spacing.md,
        letterSpacing: 2,
    },
    levelCircleBig: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: spacing.xl,
        ...shadows.glow,
    },
    levelNumberBig: {
        fontSize: 48,
        fontFamily: typography.fontFamily.extraBold,
        color: colors.text.dark,
    },
    levelUpDesc: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    continueBtn: {
        backgroundColor: colors.primary,
        width: '100%',
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        ...shadows.glow,
    },
    continueText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 1,
    },
    flyingContainer: {
        position: 'absolute',
        zIndex: 9999,
    },
    xpPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFD700',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 4,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
    xpText: {
        color: colors.text.dark,
        fontFamily: typography.fontFamily.extraBold,
        fontSize: 16,
    }
});

export default XPProvider;

