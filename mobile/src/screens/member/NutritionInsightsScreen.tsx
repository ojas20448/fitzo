import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Svg, Path, Circle } from 'react-native-svg';
import WeeklyCharts from '../../components/WeeklyCharts';
import { nutritionAPI, workoutsAPI } from '../../services/api';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calFromMacro(macro: 'protein' | 'carbs' | 'fat', grams: number) {
    const kcalPerG = { protein: 4, carbs: 4, fat: 9 };
    return grams * kcalPerG[macro];
}

function pct(value: number, total: number) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
}

// Rough calorie burn estimate: ~5 kcal/min for weight training
function estimateBurntCalories(durationMinutes: number) {
    return Math.round(durationMinutes * 5);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
    return <Text style={styles.sectionLabel}>{label}</Text>;
}

function StatRow({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
    return (
        <View style={styles.statRow}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, color ? { color } : {}]}>
                {value}{unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
            </Text>
        </View>
    );
}

// Pie chart slice path generator
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function MacroPieChart({ slices }: {
    slices: { label: string; grams: number; percentage: number; color: string }[]
}) {
    const SIZE = 160;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const r = SIZE / 2 - 8;

    let currentAngle = 0;
    const paths = slices.map((s) => {
        const sweep = (s.percentage / 100) * 360;
        const path = slicePath(cx, cy, r, currentAngle, currentAngle + sweep);
        currentAngle += sweep;
        return { ...s, path };
    });

    return (
        <View style={styles.pieWrapper}>
            <Svg width={SIZE} height={SIZE}>
                {paths.map((p, i) => (
                    <Path key={i} d={p.path} fill={p.color} stroke="#000" strokeWidth={1.5} />
                ))}
                <Circle cx={cx} cy={cy} r={r * 0.42} fill={colors.background} />
            </Svg>
            <View style={styles.pieLegend}>
                {slices.map((s, i) => (
                    <View key={i} style={styles.pieLegendRow}>
                        <View style={[styles.macroDot, { backgroundColor: s.color }]} />
                        <Text style={styles.pieLegendLabel}>{s.label}</Text>
                        <Text style={styles.pieLegendGrams}>{s.grams}g</Text>
                        <Text style={[styles.pieLegendPct, { color: s.color }]}>{s.percentage}%</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NutritionInsightsScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [targets, setTargets] = useState({ calories: 2000, protein: 150, carbs: 200, fat: 67 });
    const [logged, setLogged] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [caloriesBurnt, setCaloriesBurnt] = useState(0);
    const [bodyWeightKg, setBodyWeightKg] = useState(70);

    const loadData = useCallback(async () => {
        try {
            const [todayRes, profileRes, historyRes] = await Promise.all([
                nutritionAPI.getToday().catch(() => null),
                nutritionAPI.getProfile().catch(() => null),
                workoutsAPI.getHistory(10).catch(() => null),
            ]);

            if (todayRes) {
                setTargets(todayRes.targets);
                setLogged(todayRes.logged);
            }

            if (profileRes?.profile?.weight_kg) {
                setBodyWeightKg(profileRes.profile.weight_kg);
            }

            // Estimate burnt calories from today's completed workouts
            if (historyRes?.workouts) {
                const today = new Date().toISOString().split('T')[0];
                const todayWorkouts = historyRes.workouts.filter((w: any) => {
                    const wDate = new Date(w.completed_at || w.date || w.created_at).toISOString().split('T')[0];
                    return wDate === today && w.duration_minutes;
                });
                const totalMins = todayWorkouts.reduce((sum: number, w: any) => sum + (w.duration_minutes || 0), 0);
                setCaloriesBurnt(estimateBurntCalories(totalMins));
            }
        } catch (err) {
            // Silent — screen shows zeros
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Derived values
    const proteinCals = calFromMacro('protein', logged.protein);
    const carbsCals = calFromMacro('carbs', logged.carbs);
    const fatCals = calFromMacro('fat', logged.fat);
    const totalMacroCals = proteinCals + carbsCals + fatCals;

    const netCalories = logged.calories - caloriesBurnt;
    const maintenanceCalories = targets.calories;
    const calBalance = netCalories - maintenanceCalories;
    const isDeficit = calBalance <= 0;
    const balanceColor = isDeficit ? colors.crowd.low : colors.crowd.high;
    const balanceLabel = isDeficit ? 'Deficit' : 'Surplus';

    const calorieProgress = pct(logged.calories, targets.calories);
    const progressColor =
        calorieProgress > 100 ? colors.crowd.high :
        calorieProgress > 85 ? colors.crowd.medium :
        colors.crowd.low;

    const proteinPerKg = bodyWeightKg > 0 ? (logged.protein / bodyWeightKg).toFixed(1) : '0';
    const proteinPerKgNum = parseFloat(proteinPerKg);
    const proteinAdequacy =
        proteinPerKgNum >= 1.6 ? { label: 'Optimal', color: colors.crowd.low } :
        proteinPerKgNum >= 1.2 ? { label: 'Adequate', color: colors.crowd.medium } :
        { label: 'Low', color: colors.crowd.high };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.header}>
                <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/' as any)} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nutrition Insights</Text>
                <TouchableOpacity onPress={() => router.push('/log/calories' as any)} style={styles.logBtn}>
                    <MaterialIcons name="add" size={22} color={colors.text.primary} />
                </TouchableOpacity>
            </Animated.View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text.muted} />}
            >

                {/* Weekly Chart */}
                <Animated.View entering={FadeInDown.delay(100).duration(600).springify()}>
                    <WeeklyCharts />
                </Animated.View>

                {/* Calorie Balance Card */}
                <Animated.View entering={FadeInDown.delay(150).duration(600).springify()} style={styles.card}>
                    <SectionLabel label="CALORIE OVERVIEW" />

                    {/* Progress bar */}
                    <View style={styles.progressRow}>
                        <Text style={styles.progressText}>{logged.calories} / {targets.calories} kcal</Text>
                        <Text style={[styles.progressPct, { color: progressColor }]}>{calorieProgress}%</Text>
                    </View>
                    <View style={styles.barBg}>
                        <View style={[styles.barFill, {
                            width: `${Math.min(calorieProgress, 100)}%`,
                            backgroundColor: progressColor,
                        }]} />
                    </View>

                    <View style={styles.divider} />

                    <StatRow label="Consumed" value={logged.calories} unit="kcal" />
                    <StatRow label="Burnt (workouts)" value={caloriesBurnt} unit="kcal" color={colors.crowd.low} />
                    <StatRow label="Net Calories" value={netCalories} unit="kcal" />
                    <StatRow label="Maintenance" value={maintenanceCalories} unit="kcal" />

                    <View style={styles.divider} />

                    <View style={styles.balanceBadge}>
                        <Text style={styles.balanceBadgeLabel}>{balanceLabel}</Text>
                        <Text style={[styles.balanceBadgeValue, { color: balanceColor }]}>
                            {Math.abs(calBalance)} kcal {isDeficit ? 'below' : 'above'} maintenance
                        </Text>
                    </View>
                </Animated.View>

                {/* Macro % Breakdown Card */}
                <Animated.View entering={FadeInDown.delay(200).duration(600).springify()} style={styles.card}>
                    <SectionLabel label="MACRO BREAKDOWN" />
                    <Text style={styles.macroSubtitle}>% of total calories from each macronutrient</Text>

                    <MacroPieChart slices={[
                        { label: 'Protein', grams: logged.protein, percentage: pct(proteinCals, totalMacroCals), color: '#60A5FA' },
                        { label: 'Carbs',   grams: logged.carbs,   percentage: pct(carbsCals,   totalMacroCals), color: '#FBBF24' },
                        { label: 'Fat',     grams: logged.fat,     percentage: pct(fatCals,     totalMacroCals), color: '#F87171' },
                    ]} />

                    <View style={styles.divider} />

                    <StatRow label="Total tracked" value={totalMacroCals} unit="kcal" />
                    <StatRow label="Untracked" value={Math.max(logged.calories - totalMacroCals, 0)} unit="kcal" color={colors.text.muted} />
                </Animated.View>

                {/* Protein Adequacy Card */}
                <Animated.View entering={FadeInDown.delay(250).duration(600).springify()} style={styles.card}>
                    <SectionLabel label="PROTEIN ADEQUACY" />
                    <Text style={styles.macroSubtitle}>Recommended: 1.6-2.2g per kg bodyweight for muscle gain</Text>

                    <View style={styles.proteinRow}>
                        <View>
                            <Text style={styles.proteinBig}>{proteinPerKg}</Text>
                            <Text style={styles.proteinUnit}>g / kg bodyweight</Text>
                        </View>
                        <View style={[styles.adequacyBadge, { borderColor: proteinAdequacy.color }]}>
                            <Text style={[styles.adequacyLabel, { color: proteinAdequacy.color }]}>
                                {proteinAdequacy.label}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <StatRow label="Protein consumed" value={logged.protein} unit="g" />
                    <StatRow label="Body weight" value={bodyWeightKg} unit="kg" />
                    <StatRow
                        label="Target (1.6g/kg)"
                        value={Math.round(bodyWeightKg * 1.6)}
                        unit="g"
                        color={colors.text.muted}
                    />
                </Animated.View>

                {/* Net Calorie Impact Card */}
                <Animated.View entering={FadeInDown.delay(300).duration(600).springify()} style={styles.card}>
                    <SectionLabel label="ENERGY BALANCE" />
                    <Text style={styles.macroSubtitle}>
                        {isDeficit
                            ? `You're in a ${Math.abs(calBalance)} kcal deficit — good for fat loss`
                            : `You're in a ${calBalance} kcal surplus — good for muscle gain`
                        }
                    </Text>

                    <View style={styles.energyRow}>
                        <View style={styles.energyItem}>
                            <MaterialIcons name="restaurant" size={18} color={colors.text.secondary} />
                            <Text style={styles.energyValue}>{logged.calories}</Text>
                            <Text style={styles.energyLabel}>Eaten</Text>
                        </View>
                        <Text style={styles.energyMinus}>-</Text>
                        <View style={styles.energyItem}>
                            <MaterialIcons name="local-fire-department" size={18} color={colors.crowd.low} />
                            <Text style={styles.energyValue}>{caloriesBurnt}</Text>
                            <Text style={styles.energyLabel}>Burnt</Text>
                        </View>
                        <Text style={styles.energyMinus}>=</Text>
                        <View style={styles.energyItem}>
                            <MaterialIcons name="bolt" size={18} color={balanceColor} />
                            <Text style={[styles.energyValue, { color: balanceColor }]}>{netCalories}</Text>
                            <Text style={styles.energyLabel}>Net</Text>
                        </View>
                    </View>
                </Animated.View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.xl, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary,
    },
    logBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
    },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.lg },

    // Card
    card: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1, borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        gap: spacing.sm,
    },

    sectionLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: spacing.xs,
    },

    divider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginVertical: spacing.sm,
    },

    // Progress bar
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressText: { fontSize: typography.sizes.md, fontFamily: typography.fontFamily.medium, color: colors.text.primary },
    progressPct: { fontSize: typography.sizes.md, fontFamily: typography.fontFamily.bold },

    barBg: {
        height: 6, backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.sm, overflow: 'hidden', marginTop: spacing.xs,
    },
    barFill: { height: '100%', borderRadius: borderRadius.sm },

    // Stat row
    statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
    statLabel: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.regular, color: colors.text.secondary },
    statValue: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary },
    statUnit: { fontSize: typography.sizes.xs, color: colors.text.muted, fontFamily: typography.fontFamily.regular },

    // Balance badge
    balanceBadge: { gap: 2 },
    balanceBadgeLabel: {
        fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1,
    },
    balanceBadgeValue: { fontSize: typography.sizes.lg, fontFamily: typography.fontFamily.bold },

    // Macro pie
    macroSubtitle: {
        fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.regular,
        color: colors.text.muted, marginBottom: spacing.sm,
    },
    pieWrapper: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.sm,
    },
    pieLegend: { flex: 1, gap: spacing.md },
    pieLegendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    pieLegendLabel: { flex: 1, fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.medium, color: colors.text.primary },
    pieLegendGrams: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.regular, color: colors.text.secondary },
    pieLegendPct: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.bold, width: 36, textAlign: 'right' },
    macroDot: { width: 8, height: 8, borderRadius: 4 },

    // Protein
    proteinRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    proteinBig: { fontSize: typography.sizes['4xl'], fontFamily: typography.fontFamily.bold, color: colors.text.primary },
    proteinUnit: { fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.regular, color: colors.text.muted },
    adequacyBadge: {
        borderWidth: 1, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    adequacyLabel: { fontSize: typography.sizes.md, fontFamily: typography.fontFamily.bold },

    // Energy balance
    energyRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
        paddingVertical: spacing.md,
    },
    energyItem: { alignItems: 'center', gap: 4 },
    energyValue: { fontSize: typography.sizes.xl, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
    energyLabel: { fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.regular, color: colors.text.muted },
    energyMinus: { fontSize: typography.sizes['2xl'], color: colors.text.muted, fontFamily: typography.fontFamily.light },
});
