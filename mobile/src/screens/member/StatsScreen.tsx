import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Svg, Rect, Text as SvgText, Circle, G } from 'react-native-svg';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { MaterialIcons } from '@expo/vector-icons';
import { useNutrition } from '../../context/NutritionContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

const StatsScreen = () => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const toast = useToast();

    const { calorieGoal } = useNutrition();
    const TARGET_CALS = calorieGoal || 2500;

    const loadData = async () => {
        try {
            const response = await api.get('/nutrition/weekly');
            // Fill in missing days
            const filled = fillMissingDays(response.data.history || []);
            setHistory(filled);
        } catch (error) {
            toast.error('Error', 'Could not load stats');
        } finally {
            setLoading(false);
            setRefreshing(false);
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

    const renderWeeklyChart = () => {
        const barWidth = 32;
        const spacing = 16;
        const chartHeight = 200;
        const maxCals = Math.max(TARGET_CALS, ...history.map(d => d.calories)) * 1.1;

        return (
            <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>Weekly Calories</Text>
                <Svg width={SCREEN_WIDTH - 40} height={chartHeight + 40}>
                    {/* Target Line */}
                    <G y={(1 - TARGET_CALS / maxCals) * chartHeight}>
                        <Rect x="0" y="0" width="100%" height="1" fill={colors.success} opacity={0.5} strokeDasharray="5,5" />
                        <SvgText x="0" y="-5" fill={colors.success} fontSize="10">Target</SvgText>
                    </G>

                    {history.map((day, index) => {
                        const height = (day.calories / maxCals) * chartHeight;
                        const x = index * (barWidth + spacing) + 10;
                        const y = chartHeight - height;

                        return (
                            <G key={day.date}>
                                <Rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={height}
                                    fill={day.calories > TARGET_CALS * 1.1 ? colors.error : colors.primary}
                                    rx={4}
                                />
                                <SvgText
                                    x={x + barWidth / 2}
                                    y={chartHeight + 20}
                                    fill={colors.text.muted}
                                    fontSize="12"
                                    textAnchor="middle"
                                >
                                    {day.day}
                                </SvgText>
                            </G>
                        );
                    })}
                </Svg>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Progress</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
                }
            >
                {/* Score Card */}
                <View style={styles.scoreCard}>
                    <View>
                        <Text style={styles.scoreLabel}>Weekly Score</Text>
                        <Text style={styles.scoreValue}>87%</Text>
                    </View>
                    <View style={styles.scoreIcon}>
                        <MaterialIcons name="insights" size={32} color={colors.primary} />
                    </View>
                </View>

                {/* Charts */}
                {renderWeeklyChart()}

                {/* Macro Distribution - Simple visual */}
                <View style={styles.section}>
                    <Text style={styles.chartTitle}>Macro Balance (Avg)</Text>
                    <View style={styles.macroRow}>
                        <View style={styles.macroStat}>
                            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                            <Text style={styles.macroLabel}>Protein</Text>
                            <Text style={styles.macroVal}>30%</Text>
                        </View>
                        <View style={styles.macroStat}>
                            <View style={[styles.dot, { backgroundColor: '#4ECDC4' }]} />
                            <Text style={styles.macroLabel}>Carbs</Text>
                            <Text style={styles.macroVal}>40%</Text>
                        </View>
                        <View style={styles.macroStat}>
                            <View style={[styles.dot, { backgroundColor: '#FF6B6B' }]} />
                            <Text style={styles.macroLabel}>Fat</Text>
                            <Text style={styles.macroVal}>30%</Text>
                        </View>
                    </View>
                </View>

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
        padding: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    headerTitle: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    content: {
        padding: spacing.xl,
        gap: spacing.xl,
        paddingBottom: 100, // Tab bar padding
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
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    scoreValue: {
        color: colors.primary,
        fontSize: typography.sizes['4xl'],
        fontFamily: typography.fontFamily.bold,
    },
    scoreIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.glass.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chartContainer: {
        padding: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        alignItems: 'center',
    },
    chartTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.xl,
        alignSelf: 'flex-start',
    },
    section: {
        padding: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    macroRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: spacing.md,
    },
    macroStat: {
        alignItems: 'center',
    },
    dot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginBottom: 8,
    },
    macroLabel: {
        color: colors.text.muted,
        fontSize: typography.sizes.sm,
    },
    macroVal: {
        color: colors.text.primary,
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        marginTop: 4,
    },
});

export default StatsScreen;
