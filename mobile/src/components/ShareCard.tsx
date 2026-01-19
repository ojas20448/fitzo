import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = CARD_WIDTH * 1.5; // Aspect ratio for stories roughly

interface ShareCardProps {
    workoutType: string;
    duration: string;
    streak: number;
    date: string;
}

const ShareCard: React.FC<ShareCardProps> = ({ workoutType, duration, streak, date }) => {
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a1a', '#000000']}
                style={styles.gradient}
            >
                {/* Background Watermark */}
                <Text style={styles.watermark}>FITZO</Text>

                {/* Content */}
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.date}>{date}</Text>
                        <View style={styles.logoContainer}>
                            <Text style={styles.appName}>FITZO</Text>
                        </View>
                    </View>

                    <View style={styles.mainInfo}>
                        <Text style={styles.label}>WORKOUT COMPLETE</Text>
                        <Text style={styles.workoutType}>{workoutType}</Text>
                        <View style={styles.divider} />
                        <Text style={styles.statValue}>{duration}</Text>
                    </View>

                    <View style={styles.footer}>
                        <View style={styles.streakBadge}>
                            <Text style={styles.fireIcon}>🔥</Text>
                            <Text style={styles.streakCount}>{streak}</Text>
                            <Text style={styles.streakLabel}>DAY STREAK</Text>
                        </View>
                        <Text style={styles.tagline}>CONSISTENCY IS KING</Text>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        backgroundColor: colors.background,
    },
    gradient: {
        flex: 1,
        padding: spacing['2xl'],
        justifyContent: 'space-between',
    },
    watermark: {
        position: 'absolute',
        top: '20%',
        left: -20,
        fontSize: 120,
        fontFamily: typography.fontFamily.extraBold,
        color: 'rgba(255, 255, 255, 0.03)',
        transform: [{ rotate: '-45deg' }],
        width: 600,
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    date: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.sm,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    logoContainer: {
        backgroundColor: colors.glass.surfaceLight,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    appName: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.xs,
        letterSpacing: 2,
    },
    mainInfo: {
        alignItems: 'center',
        marginVertical: spacing['4xl'],
    },
    label: {
        color: colors.primary,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.sm,
        letterSpacing: 3,
        marginBottom: spacing.sm,
    },
    workoutType: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes['4xl'],
        textAlign: 'center',
        marginBottom: spacing.md,
        textShadowColor: 'rgba(255,255,255,0.3)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
    },
    divider: {
        width: 40,
        height: 4,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
    },
    statValue: {
        color: colors.text.secondary,
        fontFamily: typography.fontFamily.light,
        fontSize: typography.sizes['3xl'],
    },
    footer: {
        alignItems: 'center',
    },
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
        marginBottom: spacing.xl,
    },
    fireIcon: {
        fontSize: typography.sizes['2xl'],
        marginRight: spacing.sm,
    },
    streakCount: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes['2xl'],
        marginRight: spacing.sm,
    },
    streakLabel: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.xs,
        letterSpacing: 1,
    },
    tagline: {
        color: colors.text.subtle,
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.sizes.xs,
        letterSpacing: 3,
    },
});

export default ShareCard;
