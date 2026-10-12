import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Svg, Path, Circle } from 'react-native-svg';
import WeeklyCharts from '../../components/WeeklyCharts';
import { nutritionAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenBackdrop from '../../components/ScreenBackdrop';
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
    const { user } = useAuth();
    return <AccountFoodDetails key={user?.id ?? 'signed-out'} />;
}
function AccountFoodDetails() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [targets, setTargets] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
    const [loadError, setLoadError] = useState('');
    const [logged, setLogged] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    const [bodyWeightKg, setBodyWeightKg] = useState(0);

    const loadData = useCallback(async () => {
        setLoadError('');
        try {
            const [todayRes, profileRes] = await Promise.all([
                nutritionAPI.getToday(),
                nutritionAPI.getProfile(),
            ]);

            if (todayRes) {
                setTargets(todayRes.targets);
                setLogged(todayRes.logged);
            }

            if (profileRes?.profile?.weight_kg) {
                setBodyWeightKg(profileRes.profile.weight_kg);
            }

        } catch {
            setLoadError('Could not load your food details. Try again.');
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

    if (!loading && (!targets || loadError)) return <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenBackdrop />
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
            <TouchableOpacity style={{ minHeight: 48, justifyContent: 'center' }} accessibilityRole="button" onPress={() => router.back()}><Text style={styles.statLabel}>Back</Text></TouchableOpacity>
            <Text style={styles.statValue}>Food details</Text>
            <Text style={styles.statLabel}>{loadError || 'Food targets are optional. Set them up when you want to compare your logs with a daily goal.'}</Text>
            {!loadError && <Text style={styles.statLabel}>Logged today: {logged.calories} kcal · {logged.protein} g protein · {logged.carbs} g carbs · {logged.fat} g fat</Text>}
            <TouchableOpacity style={{ minHeight: 48, padding: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary }} accessibilityRole="button" onPress={() => loadError ? void loadData() : router.push('/member/fitness-profile')}><Text style={{ fontFamily: typography.fontFamily.semiBold, fontSize: 15, color: colors.text.dark }}>{loadError ? 'Retry' : 'Set up food targets'}</Text></TouchableOpacity>
            {!loadError && <TouchableOpacity style={{ minHeight: 48, justifyContent: 'center' }} accessibilityRole="button" onPress={() => router.push('/log/calories')}><Text style={styles.statLabel}>Log food without targets</Text></TouchableOpacity>}
        </ScrollView>
    </SafeAreaView>;
    // The loading screen below must return before target-dependent calculations.
    if (!targets) return <SafeAreaView style={styles.container}><ActivityIndicator color={colors.primary} /></SafeAreaView>;

    // Derived values
    const proteinCals = calFromMacro('protein', logged.protein);
    const carbsCals = calFromMacro('carbs', logged.carbs);
    const fatCals = calFromMacro('fat', logged.fat);
    const totalMacroCals = proteinCals + carbsCals + fatCals;

    const caloriesLeft = targets.calories - logged.calories;
    const balanceLabel = caloriesLeft >= 0 ? 'Remaining' : 'Over target';

    const calorieProgress = pct(logged.calories, targets.calories);
    const progressColor =
        calorieProgress > 100 ? colors.crowd.high :
        calorieProgress > 85 ? colors.crowd.medium :
        colors.crowd.low;

    const proteinPerKg = bodyWeightKg > 0 ? (logged.protein / bodyWeightKg).toFixed(1) : '0';
    const proteinAdequacy = targets.protein <= 0 ? { label: 'No protein goal', color: colors.text.secondary }
        : logged.protein >= targets.protein ? { label: 'Target met', color: colors.crowd.low }
        : { label: 'Logged so far', color: colors.text.secondary };

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
                    <StatRow label="Daily target" value={targets.calories} unit="kcal" />

                    <View style={styles.divider} />

                    <View style={styles.balanceBadge}>
                        <Text style={styles.balanceBadgeLabel}>{balanceLabel}</Text>
                        <Text style={styles.balanceBadgeValue}>
                            {Math.abs(caloriesLeft)} kcal
                        </Text>
                    </View>
                    <Text style={styles.macroSubtitle}>Based on food logged so far. Unlogged meals are not included. Regular activity is already included in your starting target; workout estimates do not change it automatically.</Text>
                </Animated.View>

                {/* Macro % Breakdown Card */}
                <Animated.View entering={FadeInDown.delay(200).duration(600).springify()} style={styles.card}>
                    <SectionLabel label="MACRO BREAKDOWN" />
                    <Text style={styles.macroSubtitle}>% of total calories from each macronutrient</Text>

                    <MacroPieChart slices={[
                        { label: 'Protein', grams: logged.protein, percentage: pct(proteinCals, totalMacroCals), color: colors.macro.protein },
                        { label: 'Carbs',   grams: logged.carbs,   percentage: pct(carbsCals,   totalMacroCals), color: colors.macro.carbs },
                        { label: 'Fat',     grams: logged.fat,     percentage: pct(fatCals,     totalMacroCals), color: colors.macro.fat },
                    ]} />

                    <View style={styles.divider} />

                    <StatRow label="Total tracked" value={totalMacroCals} unit="kcal" />
                    <StatRow label="Untracked" value={Math.max(logged.calories - totalMacroCals, 0)} unit="kcal" color={colors.text.muted} />
                </Animated.View>

                {/* Protein Adequacy Card */}
                <Animated.View entering={FadeInDown.delay(250).duration(600).springify()} style={styles.card}>
                    <SectionLabel label="PROTEIN LOGGED" />
                    <Text style={styles.macroSubtitle}>Daily protein target: {targets.protein}g{bodyWeightKg > 0 ? ` (${(targets.protein / bodyWeightKg).toFixed(1)} g/kg body weight)` : ''}.</Text>

                    <View style={styles.proteinRow}>
                        <View>
                            <Text style={styles.proteinBig}>{bodyWeightKg > 0 ? proteinPerKg : logged.protein}</Text>
                            <Text style={styles.proteinUnit}>{bodyWeightKg > 0 ? 'g / kg bodyweight' : 'g logged'}</Text>
                        </View>
                        <View style={[styles.adequacyBadge, { borderColor: proteinAdequacy.color }]}>
                            <Text style={[styles.adequacyLabel, { color: proteinAdequacy.color }]}>
                                {proteinAdequacy.label}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <StatRow label="Protein consumed" value={logged.protein} unit="g" />
                    <StatRow label="Body weight" value={bodyWeightKg > 0 ? bodyWeightKg : '—'} unit={bodyWeightKg > 0 ? 'kg' : undefined} />
                    <StatRow
                        label="Target protein"
                        value={targets.protein}
                        unit="g"
                        color={colors.text.muted}
                    />
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
