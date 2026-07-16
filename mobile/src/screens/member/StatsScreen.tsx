import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, Share, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Svg, Rect, G, Text as SvgText } from 'react-native-svg';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import api, { aiAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import { MaterialIcons } from '@expo/vector-icons';
import { useNutrition } from '../../context/NutritionContext';
import AnatomyHeatmap, { getMuscleColors } from '../../components/AnatomyHeatmap';

const SCREEN_WIDTH = Dimensions.get('window').width;

const SUB_MUSCLES: Record<string, string[]> = {
    chest: ['pectorals'],
    back: ['lats', 'traps', 'upper back', 'lower back', 'rear delts'],
    shoulders: ['delts'],
    arms: ['biceps', 'triceps', 'forearms'],
    legs: ['quads', 'hamstrings', 'glutes', 'calves'],
    core: ['abs', 'obliques'],
};

const StatsScreen = () => {
    const [activeTab, setActiveTab] = useState<'training' | 'nutrition'>('training');
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [weeklyRecap, setWeeklyRecap] = useState<any | null>(null);
    const [recapLoading, setRecapLoading] = useState(true);
    const [volumeData, setVolumeData] = useState<Record<string, number>>({
        chest: 0,
        back: 0,
        shoulders: 0,
        arms: 0,
        legs: 0,
        core: 0,
    });
    const [detailedData, setDetailedData] = useState<Record<string, number>>({});
    const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null);
    
    const toast = useToast();
    const { calorieGoal } = useNutrition();
    const TARGET_CALS = calorieGoal || 2500;

    const loadData = async () => {
        setRecapLoading(true);
        try {
            const [nutritionRes, recapRes, volumeRes] = await Promise.all([
                api.get('/nutrition/weekly'),
                aiAPI.getWeeklyRecap().catch(() => ({ success: false, recap: null })),
                api.get('/progress/volume?weeks=1').catch(() => ({ data: { weeks: [], detailed: [] } }))
            ]);

            // 1. Process Nutrition History
            const filled = fillMissingDays(nutritionRes.data.history || []);
            setHistory(filled);

            // 2. Process AI Weekly Recap
            if (recapRes.success && recapRes.recap) {
                setWeeklyRecap(recapRes.recap);
            } else {
                setWeeklyRecap(null);
            }

            // 3. Process Muscle Volume
            const counts: Record<string, number> = {
                chest: 0,
                back: 0,
                shoulders: 0,
                arms: 0,
                legs: 0,
                core: 0,
            };

            const weeksArray = volumeRes.data?.weeks || [];
            const detailedArray = volumeRes.data?.detailed || [];

            // Backend returns specific muscles (biceps, quads, lats…) when the
            // exercise matched the catalog — fold them into the six buckets.
            const BUCKET: Record<string, string> = {
                chest: 'chest', pectorals: 'chest',
                back: 'back', lats: 'back', traps: 'back', 'upper back': 'back', 'lower back': 'back', 'rear delts': 'back', rear_delts: 'back',
                shoulders: 'shoulders', delts: 'shoulders',
                arms: 'arms', biceps: 'arms', triceps: 'arms', forearms: 'arms',
                legs: 'legs', quads: 'legs', hamstrings: 'legs', glutes: 'legs', calves: 'legs',
                core: 'core', abs: 'core', obliques: 'core',
            };

            const detailedCounts: Record<string, number> = {};
            if (weeksArray.length > 0 && detailedArray.length > 0) {
                const latestWeekStart = weeksArray[weeksArray.length - 1]?.week_start;
                detailedArray.forEach((row: any) => {
                    if (row.week_start === latestWeekStart) {
                        const muscle = String(row.muscle_group).toLowerCase().replace(/_/g, ' ');
                        detailedCounts[muscle] = (detailedCounts[muscle] || 0) + (parseInt(row.total_sets) || 0);
                        
                        const bucket = BUCKET[muscle];
                        if (bucket && bucket in counts) {
                            counts[bucket] += parseInt(row.total_sets) || 0;
                        }
                    }
                });
            }
            setDetailedData(detailedCounts);
            setVolumeData(counts);

        } catch (error) {
            toast.error('Error', 'Could not load stats');
        } finally {
            setLoading(false);
            setRefreshing(false);
            setRecapLoading(false);
        }
    };

    const handleShareRecap = async () => {
        if (!weeklyRecap) return;
        try {
            await Share.share({
                title: 'My Fitzo Weekly AI Recap',
                message: `🔥 Fitzo Weekly AI Recap:\n\n"${weeklyRecap.summary_text}"\n\n💪 Workouts: ${weeklyRecap.recap_data.workouts_count} | 🎯 Streak: ${weeklyRecap.recap_data.streak_days} days!`,
            });
        } catch (error) {
            toast.error('Error', 'Could not share recap');
        }
    };

    const fillMissingDays = (data: any[]) => {
        const result = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const found = data.find((item: any) =>
                item.date === dateStr || item.date?.split('T')[0] === dateStr
            );

            result.push({
                date: dateStr,
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                calories: parseInt(found?.calories || '0'),
                protein: parseInt(found?.protein || '0'),
                carbs: parseInt(found?.carbs || '0'),
                fat: parseInt(found?.fat || '0'),
            });
        }
        return result;
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const renderAnatomySection = () => {
        const bodyHeight = 220;
        const bodyWidth = 120;

        return (
            <View style={styles.anatomyContainer}>
                <View style={styles.recapHeader}>
                    <Text style={styles.chartTitle}>Muscle Volume Status</Text>
                    <Text style={styles.targetLabel}>Target: 6 sets/week</Text>
                </View>

                <AnatomyHeatmap volume={{ ...volumeData, ...detailedData }} bodyWidth={bodyWidth} bodyHeight={bodyHeight} />

                {/* Muscle Breakdown List */}
                <View style={styles.breakdownList}>
                    {Object.entries(volumeData).map(([name, sets]) => {
                        const status = getMuscleColors(sets);
                        let statusText = 'Untrained';
                        let badgeColor = 'rgba(255, 255, 255, 0.4)';
                        if (sets >= 6) {
                            statusText = 'Growth Zone';
                            badgeColor = '#34D159';
                        } else if (sets > 0) {
                            statusText = 'Under Target';
                            badgeColor = '#FDC90D';
                        }

                        const isExpanded = expandedMuscle === name;

                        return (
                            <View key={name} style={{ marginBottom: spacing.xs }}>
                                <TouchableOpacity 
                                    style={styles.breakdownItem} 
                                    onPress={() => setExpandedMuscle(isExpanded ? null : name)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.breakdownLeft}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.muscleName}>{name.toUpperCase()}</Text>
                                            <MaterialIcons 
                                                name={isExpanded ? 'expand-less' : 'expand-more'} 
                                                size={18} 
                                                color={colors.text.muted} 
                                            />
                                        </View>
                                        <Text style={styles.muscleSets}>{sets} sets completed</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { borderColor: status.stroke }]}>
                                        <View style={[styles.badgeDot, { backgroundColor: badgeColor }]} />
                                        <Text style={[styles.statusText, { color: badgeColor }]}>{statusText}</Text>
                                    </View>
                                </TouchableOpacity>

                                {isExpanded && (
                                    <View style={styles.subMuscleContainer}>
                                        {SUB_MUSCLES[name]?.map(sub => {
                                            const subSets = detailedData[sub] || 0;
                                            let subBadgeColor = 'rgba(255, 255, 255, 0.3)';
                                            if (subSets >= 6) subBadgeColor = '#34D159';
                                            else if (subSets > 0) subBadgeColor = '#FDC90D';

                                            return (
                                                <View key={sub} style={styles.subMuscleRow}>
                                                    <Text style={styles.subMuscleName}>
                                                        {sub.toUpperCase()}
                                                    </Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                        <Text style={styles.subMuscleSets}>{subSets} sets</Text>
                                                        <View style={[styles.subBadgeDot, { backgroundColor: subBadgeColor }]} />
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderWeeklyChart = () => {
        const barWidth = 28;
        const barSpacing = 18;
        const chartHeight = 180;
        const maxCals = Math.max(TARGET_CALS, ...history.map(d => d.calories)) * 1.1;

        return (
            <View style={styles.chartContainer}>
                <View style={styles.recapHeader}>
                    <Text style={styles.chartTitle}>Weekly Calories</Text>
                    <Text style={styles.targetLabel}>Target: {TARGET_CALS} kcal</Text>
                </View>

                <View style={styles.chartSvgWrapper}>
                    <Svg width={SCREEN_WIDTH - 80} height={chartHeight + 40}>
                        {/* Target Line */}
                        <G y={(1 - TARGET_CALS / maxCals) * chartHeight}>
                            <Rect x="0" y="0" width="100%" height="1.5" fill={colors.success} opacity={0.6} />
                        </G>

                        {history.map((day, index) => {
                            const height = (day.calories / maxCals) * chartHeight;
                            const x = index * (barWidth + barSpacing) + 20;
                            const y = chartHeight - height;

                            return (
                                <G key={day.date}>
                                    <Rect
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={height}
                                        fill={day.calories > TARGET_CALS * 1.15 ? colors.error : colors.primary}
                                        rx={4}
                                        opacity={day.calories > 0 ? 0.9 : 0.05}
                                    />
                                    <SvgText
                                        x={x + barWidth / 2}
                                        y={chartHeight + 22}
                                        fill={colors.text.muted}
                                        fontSize="11"
                                        textAnchor="middle"
                                    >
                                        {day.day[0]}
                                    </SvgText>
                                </G>
                            );
                        })}
                    </Svg>
                </View>

                {/* Macro Distribution - Simple visual */}
                <View style={styles.macroBalanceCard}>
                    <Text style={styles.macroCardTitle}>Average Balance</Text>
                    <View style={styles.macroRow}>
                        <View style={styles.macroStat}>
                            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                            <Text style={styles.macroLabel}>Protein</Text>
                            <Text style={styles.macroVal}>30%</Text>
                        </View>
                        <View style={styles.macroStat}>
                            <View style={[styles.dot, { backgroundColor: 'rgba(255, 255, 255, 0.4)' }]} />
                            <Text style={styles.macroLabel}>Carbs</Text>
                            <Text style={styles.macroVal}>40%</Text>
                        </View>
                        <View style={styles.macroStat}>
                            <View style={[styles.dot, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]} />
                            <Text style={styles.macroLabel}>Fat</Text>
                            <Text style={styles.macroVal}>30%</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header Tabs */}
            <View style={styles.header}>
                <View style={styles.tabsWrapper}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'training' && styles.tabActive]}
                        onPress={() => setActiveTab('training')}
                    >
                        <Text style={[styles.tabText, activeTab === 'training' && styles.tabTextActive]}>Training</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'nutrition' && styles.tabActive]}
                        onPress={() => setActiveTab('nutrition')}
                    >
                        <Text style={[styles.tabText, activeTab === 'nutrition' && styles.tabTextActive]}>Nutrition</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
                }
            >
                {/* Score Card / Metric Top Banner */}
                <View style={styles.scoreCard}>
                    <View>
                        <Text style={styles.scoreLabel}>{activeTab === 'training' ? 'Weekly Workouts' : 'Daily Average'}</Text>
                        <Text style={styles.scoreValue}>
                            {activeTab === 'training' 
                                ? `${weeklyRecap?.recap_data?.workouts_count || 0} sessions` 
                                : `${weeklyRecap?.recap_data?.avg_calories || 0} kcal`
                            }
                        </Text>
                    </View>
                    <View style={styles.scoreIcon}>
                        <MaterialIcons 
                            name={activeTab === 'training' ? 'fitness-center' : 'restaurant-menu'} 
                            size={28} 
                            color={colors.primary} 
                        />
                    </View>
                </View>

                {/* Weekly AI Recap */}
                {recapLoading ? (
                    <View style={styles.section}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.recapMessage, { textAlign: 'center', marginTop: 8 }]}>Parsing progress history...</Text>
                    </View>
                ) : weeklyRecap ? (
                    <View style={styles.section}>
                        <View style={styles.recapHeader}>
                            <View style={styles.recapHeaderLeft}>
                                <MaterialIcons name="auto-awesome" size={16} color={colors.primary} />
                                <Text style={styles.recapTitle}>WEEKLY REPORT</Text>
                            </View>
                            <TouchableOpacity onPress={handleShareRecap} style={styles.shareBtn} accessibilityLabel="Share recap">
                                <MaterialIcons name="share" size={18} color={colors.text.muted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.recapMessage}>{weeklyRecap.summary_text}</Text>
                        <View style={styles.recapMetrics}>
                            <View style={styles.metricItem}>
                                <Text style={styles.metricLabel}>Workout Load</Text>
                                <Text style={styles.metricValue}>{weeklyRecap.recap_data.workouts_count} workouts</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <Text style={styles.metricLabel}>Gym Attendance</Text>
                                <Text style={styles.metricValue}>{weeklyRecap.recap_data.checkin_count} days</Text>
                            </View>
                            <View style={styles.metricItem}>
                                <Text style={styles.metricLabel}>Streak Size</Text>
                                <Text style={styles.metricValue}>{weeklyRecap.recap_data.streak_days} days</Text>
                            </View>
                        </View>
                    </View>
                ) : null}

                {/* Render Selected View */}
                {activeTab === 'training' ? renderAnatomySection() : renderWeeklyChart()}

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
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
        alignItems: 'center',
    },
    tabsWrapper: {
        flexDirection: 'row',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.md,
        padding: 4,
        width: '100%',
        maxWidth: 320,
    },
    tabButton: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: borderRadius.sm,
    },
    tabActive: {
        backgroundColor: colors.glass.surfaceLight,
        ...shadows.glowCard,
    },
    tabText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: typography.letterSpacing.tight,
    },
    tabTextActive: {
        color: colors.text.primary,
    },
    content: {
        padding: spacing.xl,
        gap: spacing.xl,
        paddingBottom: 120, // Tab bar padding
    },
    scoreCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        ...shadows.glow,
    },
    scoreLabel: {
        color: colors.text.muted,
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    scoreValue: {
        color: colors.primary,
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.medium,
        letterSpacing: typography.letterSpacing.tight,
    },
    scoreIcon: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.glass.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    anatomyContainer: {
        padding: spacing.xl,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    chartContainer: {
        padding: spacing.xl,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    chartSvgWrapper: {
        alignItems: 'center',
        marginVertical: spacing.lg,
    },
    chartTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        letterSpacing: typography.letterSpacing.tight,
    },
    targetLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    bodiesRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginTop: spacing.xl,
        marginBottom: spacing.xl,
    },
    bodyColumn: {
        alignItems: 'center',
        gap: spacing.md,
    },
    bodyLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    breakdownList: {
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        paddingTop: spacing.lg,
        gap: spacing.md,
    },
    breakdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    breakdownLeft: {
        gap: 2,
    },
    muscleName: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: 1,
    },
    muscleSets: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    badgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    macroBalanceCard: {
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        paddingTop: spacing.xl,
        marginTop: spacing.sm,
    },
    macroCardTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        marginBottom: spacing.md,
    },
    macroRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    macroStat: {
        alignItems: 'center',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginBottom: 6,
    },
    macroLabel: {
        color: colors.text.muted,
        fontSize: typography.sizes.xs,
    },
    macroVal: {
        color: colors.text.primary,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        marginTop: 2,
    },
    section: {
        padding: spacing.xl,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    recapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    recapHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    recapTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        letterSpacing: 1.5,
    },
    shareBtn: {
        padding: spacing.xs,
    },
    recapMessage: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        lineHeight: 20,
        marginBottom: spacing.lg,
    },
    recapMetrics: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        paddingTop: spacing.lg,
        gap: spacing.md,
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    metricLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    metricValue: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    subMuscleContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginTop: 2,
        marginLeft: spacing.lg,
        gap: spacing.xs,
    },
    subMuscleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    subMuscleName: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        letterSpacing: 0.5,
    },
    subMuscleSets: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
    },
    subBadgeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});

export default StatsScreen;
