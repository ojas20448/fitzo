import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image, PixelRatio } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import AnimatedFire from './AnimatedFire';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = 9 / 16;
const CARD_WIDTH = width;
const CARD_HEIGHT = width / ASPECT_RATIO; // Ensure 9:16 roughly, or just fill screen

interface WorkoutShareCardProps {
    recap: {
        duration: number;
        volume: number;
        sets: number;
        prs?: any[];
        achievements?: any[];
    };
    user?: {
        name: string;
        streak?: number;
    };
    intent?: {
        emphasis?: string[];
        training_pattern?: string;
    } | null;
    date: Date;
}

const WorkoutShareCard = React.forwardRef<View, WorkoutShareCardProps>(({ recap, user, intent, date }, ref) => {

    // Format duration
    const hours = Math.floor(recap.duration / 60);
    const mins = recap.duration % 60;
    const durationText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    // Workout Title
    const title = intent?.emphasis?.[0]?.toUpperCase() || 'WORKOUT';
    const subtitle = intent?.training_pattern?.toUpperCase() || 'SESSION';

    return (
        <View ref={ref} style={styles.container} collapsable={false}>
            {/* Background elements (Gradient simulation or subtle patterns could go here) */}
            <View style={styles.decorativeCircle} />
            <View style={styles.decorativeLine} />

            {/* Header / Logo */}
            <View style={styles.header}>
                <Text style={styles.logoText}>FITZO</Text>
                <Text style={styles.dateText}>{date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</Text>
            </View>

            {/* Main Content */}
            <View style={styles.content}>

                {/* Badge/Streak */}
                <View style={styles.streakContainer}>
                    <MaterialIcons name="local-fire-department" size={24} color={colors.primary} />
                    <Text style={styles.streakText}>{user?.streak || 0} DAY STREAK</Text>
                </View>

                {/* Big Title */}
                <View style={styles.titleContainer}>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                    <Text style={styles.title}>{title}</Text>
                </View>

                {/* Main Stat: Volume */}
                <View style={styles.mainStat}>
                    <Text style={styles.mainStatValue}>{(recap.volume / 1000).toFixed(1)}k</Text>
                    <Text style={styles.mainStatLabel}>KG MOVED</Text>
                </View>

                {/* Secondary Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <MaterialIcons name="timer" size={20} color={colors.text.muted} />
                        <Text style={styles.statValue}>{durationText}</Text>
                        <Text style={styles.statLabel}>TIME</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <MaterialIcons name="repeat" size={20} color={colors.text.muted} />
                        <Text style={styles.statValue}>{recap.sets}</Text>
                        <Text style={styles.statLabel}>SETS</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <MaterialIcons name="emoji-events" size={20} color={colors.text.muted} />
                        <Text style={styles.statValue}>{recap.prs?.length || 0}</Text>
                        <Text style={styles.statLabel}>PRS</Text>
                    </View>
                </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.footerLine} />
                <Text style={styles.footerText}>EVERY DAY COUNTS</Text>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        width: width,
        height: height, // Full screen capture
        backgroundColor: colors.background, // Pure black
        padding: spacing.xl,
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    decorativeCircle: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: colors.glass.surface,
        opacity: 0.5,
    },
    decorativeLine: {
        position: 'absolute',
        bottom: 100,
        left: 0,
        width: width,
        height: 1,
        backgroundColor: colors.glass.border,
        opacity: 0.3,
    },
    header: {
        width: '100%',
        alignItems: 'center',
        paddingTop: spacing['5xl'], // Safe area ish
    },
    logoText: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.extraBold,
        letterSpacing: 8,
        color: colors.primary,
    },
    dateText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        letterSpacing: 2,
        color: colors.text.muted,
        marginTop: spacing.sm,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        gap: spacing['4xl'],
    },
    streakContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    streakText: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.sm,
        letterSpacing: 1,
    },
    titleContainer: {
        alignItems: 'center',
    },
    subtitle: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.sm,
        letterSpacing: 4,
        marginBottom: spacing.xs,
    },
    title: {
        color: colors.primary,
        fontFamily: typography.fontFamily.extraBold,
        fontSize: 48, // Big
        textAlign: 'center',
        textTransform: 'uppercase',
    },
    mainStat: {
        alignItems: 'center',
    },
    mainStatValue: {
        color: colors.primary, // Could be gold or accent
        fontFamily: typography.fontFamily.extraBold,
        fontSize: 80,
        lineHeight: 80,
    },
    mainStatLabel: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.sm,
        letterSpacing: 2,
        marginTop: spacing.sm,
    },
    statsGrid: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    statItem: {
        alignItems: 'center',
        gap: 4,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: colors.glass.border,
    },
    statValue: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.xl,
    },
    statLabel: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes['2xs'],
        letterSpacing: 1,
    },
    footer: {
        width: '100%',
        paddingBottom: spacing['4xl'],
        alignItems: 'center',
    },
    footerLine: {
        width: 40,
        height: 2,
        backgroundColor: colors.primary,
        marginBottom: spacing.md,
    },
    footerText: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.sizes.xs,
        letterSpacing: 4,
    },
});

export default WorkoutShareCard;
