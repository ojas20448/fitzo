import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Svg, Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { colors, typography, spacing, borderRadius, shadows } from '../styles/theme';
import GlassCard from './GlassCard';
import { caloriesAPI, nutritionAPI } from '../services/api';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_HEIGHT = 180;
const CHART_WIDTH = SCREEN_WIDTH - (spacing.xl * 2) - (spacing.lg * 2); // Screen padding - Card padding
const BAR_WIDTH = 24;
const BAR_GAP = (CHART_WIDTH - (BAR_WIDTH * 7)) / 6;

interface DailyLog {
    logged_date: string;
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
}

export default function WeeklyCharts() {
    const [history, setHistory] = useState<DailyLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [targetCalories, setTargetCalories] = useState(2000);
    const [targetMacros, setTargetMacros] = useState({ p: 150, c: 200, f: 70 });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [historyRes, profileRes] = await Promise.all([
                caloriesAPI.getHistory(7),
                nutritionAPI.getProfile()
            ]);

            // Format history to ensure we have past 7 days 
            // The API returns sparse data (only days with logs), so we need to fill gaps
            const filledHistory = fillWeekGap(historyRes.history);
            setHistory(filledHistory);

            if (profileRes.profile) {
                setTargetCalories(profileRes.profile.target_calories || 2000);
                setTargetMacros({
                    p: profileRes.profile.target_protein || 150,
                    c: profileRes.profile.target_carbs || 200,
                    f: profileRes.profile.target_fat || 70
                });
            }
        } catch (error) {

        } finally {
            setLoading(false);
        }
    };

    const fillWeekGap = (data: any[]): DailyLog[] => {
        const result = [];
        const today = new Date();
        const dataMap = new Map(data.map(d => [new Date(d.logged_date).toDateString(), d]));

        // Generate last 7 days (Monday to Sunday order? Or just last 7 days?)
        // Lose It shows M T W Th F Sa Su (Fixed week) or rolling?
        // Let's do a rolling 7 days ending today for simplicity first, 
        // OR better: Start from 6 days ago to Today.

        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const key = d.toDateString();
            const log = dataMap.get(key);

            result.push({
                logged_date: d.toISOString(), // Keep standard date string
                dayLabel: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()],
                isToday: i === 0,
                total_calories: parseInt(log?.total_calories || '0'),
                total_protein: parseInt(log?.total_protein || '0'),
                total_carbs: parseInt(log?.total_carbs || '0'),
                total_fat: parseInt(log?.total_fat || '0'),
            });
        }
        return result;
    };

    if (loading) {
        return (
            <View style={{ height: 400, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    // --- CALORIE CHART CALCULATIONS ---
    const maxCal = Math.max(targetCalories * 1.2, ...history.map(d => d.total_calories));
    const scaleY = (val: number) => (val / maxCal) * CHART_HEIGHT;
    const targetY = CHART_HEIGHT - scaleY(targetCalories);

    // --- MACRO CHART CALCULATIONS ---
    // Stacked bars: Protein (Bottom), Carbs (Middle), Fat (Top)
    // Scale based on max total grams? Or Calories? Grams usually.
    const maxMacro = Math.max(100, ...history.map(d => d.total_protein + d.total_carbs + d.total_fat));
    const scaleMacro = (val: number) => (val / maxMacro) * CHART_HEIGHT;

    return (
        <View style={styles.container}>
            <GlassCard style={styles.card} padding="lg">
                <View style={styles.headerRow}>
                    <Text style={styles.title}>NUTRITION & MACROS</Text>
                    <MaterialIcons name="more-horiz" size={20} color={colors.text.muted} />
                </View>

                <View style={styles.chartContainer}>
                    <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 30}>
                        {/* Target Line */}
                        <Line
                            x1="0"
                            y1={targetY}
                            x2={CHART_WIDTH}
                            y2={targetY}
                            stroke={colors.text.muted}
                            strokeWidth="1"
                            strokeDasharray="4, 4"
                            opacity={0.5}
                        />

                        {history.map((day: any, i) => {
                            const x = i * (BAR_WIDTH + BAR_GAP);

                            // Calculate calories from macros for consistency in stacking
                            const calP = day.total_protein * 4;
                            const calC = day.total_carbs * 4;
                            const calF = day.total_fat * 9;
                            const totalCalcCal = calP + calC + calF; // Use calculated total for stack height consistency

                            // If total is 0, show placeholder
                            if (totalCalcCal === 0) {
                                return (
                                    <G key={i}>
                                        <Rect
                                            x={x}
                                            y={0}
                                            width={BAR_WIDTH}
                                            height={CHART_HEIGHT}
                                            fill={colors.surfaceLight}
                                            rx={4}
                                            opacity={0.3}
                                        />
                                        <SvgText
                                            x={x + BAR_WIDTH / 2}
                                            y={CHART_HEIGHT + 20}
                                            fontSize="10"
                                            fill={day.isToday ? colors.primary : colors.text.muted}
                                            textAnchor="middle"
                                            fontWeight={day.isToday ? "bold" : "normal"}
                                        >
                                            {day.dayLabel}
                                        </SvgText>
                                    </G>
                                );
                            }

                            const hP = scaleY(calP);
                            const hC = scaleY(calC);
                            const hF = scaleY(calF);

                            const yP = CHART_HEIGHT - hP;
                            const yC = yP - hC;
                            const yF = yC - hF;

                            return (
                                <G key={i}>
                                    {/* Placeholder Background */}
                                    <Rect
                                        x={x}
                                        y={0}
                                        width={BAR_WIDTH}
                                        height={CHART_HEIGHT}
                                        fill={colors.surfaceLight}
                                        rx={4}
                                        opacity={0.3}
                                    />

                                    {/* Protein (Bottom) - Purple */}
                                    <Rect
                                        x={x}
                                        y={yP}
                                        width={BAR_WIDTH}
                                        height={Math.max(0, hP)}
                                        fill="#8B5CF6"
                                        rx={2}
                                    />

                                    {/* Carbs (Middle) - Blue */}
                                    <Rect
                                        x={x}
                                        y={yC}
                                        width={BAR_WIDTH}
                                        height={Math.max(0, hC)}
                                        fill="#3B82F6"
                                        rx={2}
                                    />

                                    {/* Fat (Top) - Amber */}
                                    <Rect
                                        x={x}
                                        y={yF}
                                        width={BAR_WIDTH}
                                        height={Math.max(0, hF)}
                                        fill="#F59E0B"
                                        rx={2}
                                    />

                                    {/* Day Label */}
                                    <SvgText
                                        x={x + BAR_WIDTH / 2}
                                        y={CHART_HEIGHT + 20}
                                        fontSize="10"
                                        fill={day.isToday ? colors.primary : colors.text.muted}
                                        textAnchor="middle"
                                        fontWeight={day.isToday ? "bold" : "normal"}
                                    >
                                        {day.dayLabel}
                                    </SvgText>
                                </G>
                            );
                        })}
                    </Svg>

                    {/* Floating Info */}
                    <View style={[styles.targetBadge, { top: -5 }]}>
                        <Text style={styles.targetText}>{targetCalories.toLocaleString()} Target</Text>
                    </View>
                </View>

                {/* Legend */}
                <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                        <Text style={styles.legendText}>Fat</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                        <Text style={styles.legendText}>Carbs</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                        <Text style={styles.legendText}>Protein</Text>
                    </View>
                </View>

                {/* Averages */}
                {history.length > 0 && (
                    <View style={styles.avgRow}>
                        <Text style={styles.avgTitle}>DAILY AVG</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={[styles.avgBadge, { backgroundColor: '#F59E0B20' }]}>
                                <Text style={[styles.avgValue, { color: '#F59E0B' }]}>
                                    {Math.round(history.reduce((a, b) => a + b.total_fat, 0) / 7)}g
                                </Text>
                            </View>
                            <View style={[styles.avgBadge, { backgroundColor: '#3B82F620' }]}>
                                <Text style={[styles.avgValue, { color: '#3B82F6' }]}>
                                    {Math.round(history.reduce((a, b) => a + b.total_carbs, 0) / 7)}g
                                </Text>
                            </View>
                            <View style={[styles.avgBadge, { backgroundColor: '#8B5CF620' }]}>
                                <Text style={[styles.avgValue, { color: '#8B5CF6' }]}>
                                    {Math.round(history.reduce((a, b) => a + b.total_protein, 0) / 7)}g
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
            </GlassCard>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: spacing.lg,
    },
    card: {
        width: '100%',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    chartContainer: {
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    targetBadge: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    targetText: {
        fontSize: 10,
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.xl,
        marginBottom: spacing.lg,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: typography.sizes.xs,
        color: colors.text.secondary,
        fontFamily: typography.fontFamily.medium,
    },
    avgRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    avgTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 1,
    },
    avgBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    avgValue: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
    },
});
