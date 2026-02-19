import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { learnAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Skeleton, { SkeletonCard } from '../../components/Skeleton';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

const { width } = Dimensions.get('window');

const LearnScreen: React.FC = () => {
    const [units, setUnits] = useState<any[]>([]);
    const [progress, setProgress] = useState<any>({ total_xp: 0, lessons_completed: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [totalLessons, setTotalLessons] = useState(0);

    // Reload lessons whenever screen comes into focus (e.g. after completing a lesson)
    useFocusEffect(
        useCallback(() => {
            loadLessons();
        }, [])
    );

    const loadLessons = async () => {
        try {
            const response = await learnAPI.getLessons();
            const unitsData = response.units || [];
            setUnits(unitsData);
            setProgress(response.progress || { total_xp: 0, lessons_completed: 0 });
            // Count total lessons across all units
            const total = unitsData.reduce((sum: number, u: any) => sum + (u.lessons?.length || 0), 0);
            setTotalLessons(total);
        } catch (error) {
            console.error('Failed to load lessons:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadLessons();
        setRefreshing(false);
    };

    const handleLessonPress = (lessonId: string, canAccess: boolean) => {
        if (canAccess) {
            router.push(`/lesson/${lessonId}` as any);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>LEARN</Text>
                        <View style={styles.headerDot} />
                        <Text style={styles.headerSubtitle}>PATH</Text>
                    </View>
                    <Skeleton width={80} height={28} borderRadius={14} />
                </View>
                <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                    {[1, 2, 3, 4].map((_, idx) => (
                        <View key={idx} style={styles.timelineItem}>
                            <View style={styles.timelineLeft}>
                                <Skeleton width={32} height={32} borderRadius={16} />
                            </View>
                            <View style={styles.timelineRight}>
                                <SkeletonCard />
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>LEARN</Text>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerSubtitle}>PATH</Text>
                </View>
                <View style={styles.xpBadge}>
                    <MaterialIcons name="diamond" size={14} color={colors.primary} />
                    <Text style={styles.xpText}>{progress.total_xp}</Text>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Overall Progress Card */}
                {totalLessons > 0 && (
                    <View style={styles.overallProgress}>
                        <View style={styles.overallProgressHeader}>
                            <Text style={styles.overallProgressTitle}>
                                {progress.lessons_completed}/{totalLessons} Lessons
                            </Text>
                            <Text style={styles.overallProgressPercent}>
                                {Math.round((progress.lessons_completed / totalLessons) * 100)}%
                            </Text>
                        </View>
                        <View style={styles.overallProgressBar}>
                            <View style={[styles.overallProgressFill, {
                                width: `${Math.round((progress.lessons_completed / totalLessons) * 100)}%`
                            }]} />
                        </View>
                    </View>
                )}

                {units.map((unit, unitIndex) => (
                    <View key={unit.number} style={styles.unitSection}>
                        {/* Unit Title */}
                        <View style={styles.unitHeader}>
                            <View style={styles.unitBadge}>
                                <Text style={styles.unitBadgeText}>UNIT {unit.number}</Text>
                            </View>
                            <Text style={styles.unitTitle}>{unit.title}</Text>
                        </View>

                        {/* Timeline Lessons */}
                        <View style={styles.timeline}>
                            {unit.lessons.map((lesson: any, index: number) => {
                                const isLocked = !lesson.completed && !lesson.is_next;
                                const isActive = lesson.is_next;
                                const isCompleted = lesson.completed;
                                const isLast = index === unit.lessons.length - 1;
                                // Completed and active lessons are accessible
                                const canAccess = isCompleted || isActive;

                                return (
                                    <View key={lesson.id} style={styles.timelineItem}>
                                        {/* Left side - indicator & line */}
                                        <View style={styles.timelineLeft}>
                                            <View style={[
                                                styles.timelineIndicator,
                                                isCompleted && styles.indicatorCompleted,
                                                isActive && styles.indicatorActive,
                                                isLocked && styles.indicatorLocked,
                                            ]}>
                                                {isCompleted ? (
                                                    <MaterialIcons name="check" size={16} color={colors.background} />
                                                ) : isActive ? (
                                                    <MaterialIcons name="play-arrow" size={16} color={colors.background} />
                                                ) : (
                                                    <MaterialIcons name="lock" size={12} color={colors.text.subtle} />
                                                )}
                                            </View>
                                            {!isLast && (
                                                <View style={[
                                                    styles.timelineLine,
                                                    isCompleted && styles.lineCompleted,
                                                    isLocked && styles.lineLocked,
                                                ]} />
                                            )}
                                        </View>

                                        {/* Right side - lesson card */}
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => handleLessonPress(lesson.id, canAccess)}
                                            disabled={!canAccess}
                                            style={styles.timelineRight}
                                        >
                                            <View style={[
                                                styles.lessonCard,
                                                isActive && styles.lessonCardActive,
                                                isCompleted && styles.lessonCardCompleted,
                                                isLocked && styles.lessonCardLocked,
                                            ]}>
                                                <View style={styles.lessonHeader}>
                                                    <Text style={[
                                                        styles.lessonTitle,
                                                        isActive && styles.lessonTitleActive,
                                                        isLocked && styles.lessonTitleLocked,
                                                    ]}>
                                                        {lesson.title}
                                                    </Text>
                                                    {isActive && (
                                                        <View style={styles.currentBadge}>
                                                            <Text style={styles.currentBadgeText}>CURRENT</Text>
                                                        </View>
                                                    )}
                                                </View>

                                                {lesson.description && (
                                                    <Text style={[
                                                        styles.lessonDescription,
                                                        isLocked && styles.lessonDescriptionLocked,
                                                    ]}>
                                                        {lesson.description}
                                                    </Text>
                                                )}

                                                {/* XP indicator + meta */}
                                                <View style={styles.lessonMeta}>
                                                    <View style={styles.xpIndicator}>
                                                        <MaterialIcons
                                                            name="diamond"
                                                            size={12}
                                                            color={isLocked ? colors.text.subtle : colors.primary}
                                                        />
                                                        <Text style={[
                                                            styles.xpAmount,
                                                            isLocked && styles.xpAmountLocked,
                                                        ]}>
                                                            +{lesson.xp_reward || 50} XP
                                                        </Text>
                                                    </View>
                                                    {isCompleted && lesson.last_score != null && (
                                                        <View style={styles.scoreContainer}>
                                                            <MaterialIcons name="check-circle" size={14} color={colors.success} />
                                                            <Text style={styles.scoreText}>{lesson.last_score}%</Text>
                                                        </View>
                                                    )}
                                                    {isCompleted && !lesson.last_score && (
                                                        <Text style={styles.completedText}>Completed</Text>
                                                    )}
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                ))}

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    headerTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        letterSpacing: 2,
    },
    headerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.text.subtle,
    },
    headerSubtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    xpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.glass.surface,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    xpText: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.sm,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.xl,
    },
    unitSection: {
        marginBottom: spacing['3xl'],
    },
    unitHeader: {
        marginBottom: spacing.xl,
    },
    unitBadge: {
        alignSelf: 'flex-start',
        backgroundColor: colors.glass.surface,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
        marginBottom: spacing.sm,
    },
    unitBadgeText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 1.5,
    },
    unitTitle: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    timeline: {
        paddingLeft: spacing.sm,
    },
    timelineItem: {
        flexDirection: 'row',
        minHeight: 100,
    },
    timelineLeft: {
        width: 40,
        alignItems: 'center',
    },
    timelineIndicator: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.glass.border,
        zIndex: 2,
    },
    indicatorCompleted: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    indicatorActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
        ...shadows.glow,
    },
    indicatorLocked: {
        backgroundColor: 'transparent',
        borderStyle: 'dashed',
    },
    timelineLine: {
        flex: 1,
        width: 2,
        backgroundColor: colors.glass.border,
        marginVertical: 4,
    },
    lineCompleted: {
        backgroundColor: colors.primary,
    },
    lineLocked: {
        opacity: 0.5,
    },
    timelineRight: {
        flex: 1,
        paddingLeft: spacing.md,
        paddingBottom: spacing.lg,
    },
    lessonCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    lessonCardActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        borderColor: 'rgba(255, 255, 255, 0.35)',
        borderWidth: 1,
        ...shadows.glowCard,
    },
    lessonCardCompleted: {
        backgroundColor: colors.glass.surface,
        borderColor: colors.glass.border,
    },
    lessonCardLocked: {
        backgroundColor: 'transparent',
        borderStyle: 'dashed',
        opacity: 0.6,
    },
    lessonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.xs,
    },
    lessonTitle: {
        flex: 1,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    lessonTitleActive: {
        color: colors.text.primary,
    },
    lessonTitleLocked: {
        color: colors.text.muted,
    },
    currentBadge: {
        backgroundColor: colors.primary,
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: borderRadius.full,
        marginLeft: spacing.sm,
    },
    currentBadgeText: {
        fontSize: 9,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
        letterSpacing: 1,
    },
    lessonDescription: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginBottom: spacing.md,
        lineHeight: 20,
    },
    lessonDescriptionLocked: {
        color: colors.text.subtle,
    },
    lessonMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    xpIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    xpAmount: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.primary,
        letterSpacing: 0.5,
    },
    xpAmountLocked: {
        color: colors.text.subtle,
    },
    completedText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.success,
        letterSpacing: 0.5,
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    scoreText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.success,
    },
    overallProgress: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing['2xl'],
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    overallProgressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    overallProgressTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    overallProgressPercent: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    overallProgressBar: {
        height: 6,
        backgroundColor: colors.glass.border,
        borderRadius: 3,
        overflow: 'hidden',
    },
    overallProgressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 3,
    },
});

export default LearnScreen;
