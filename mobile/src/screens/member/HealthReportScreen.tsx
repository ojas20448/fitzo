import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { healthAPI, progressAPI, nutritionAPI, measurementsAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - CARD_GAP) / 2;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface HealthData {
    steps: number;
    active_calories: number;
    resting_heart_rate: number | null;
    sleep_hours: number | null;
}

interface PRData {
    exercise_name: string;
    max_weight: number;
    reps_at_max: number;
}

interface NutritionProfile {
    daily_calories: number;
    daily_protein: number;
    daily_carbs: number;
    daily_fat: number;
}

interface MeasurementData {
    weight: number | null;
    body_fat: number | null;
    chest: number | null;
    waist: number | null;
    hips: number | null;
}

interface HealthHistory {
    daily: Array<{
        date: string;
        steps: number;
        active_calories: number;
        resting_heart_rate: number | null;
        sleep_hours: number | null;
    }>;
    averages: {
        avg_steps: number;
        avg_calories: number;
        avg_heart_rate: number | null;
        avg_sleep: number | null;
    };
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function formatNumber(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Math.round(n).toString();
}

function safeNum(v: any): number {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
}

function getHealthGrade(data: {
    steps: number;
    calories: number;
    sleep: number | null;
    hr: number | null;
}): { grade: string; color: string; label: string } {
    let score = 0;
    let total = 0;

    total += 25;
    if (data.steps >= 10000) score += 25;
    else if (data.steps >= 8000) score += 20;
    else if (data.steps >= 5000) score += 15;
    else if (data.steps >= 3000) score += 10;
    else score += 5;

    total += 25;
    if (data.calories >= 500) score += 25;
    else if (data.calories >= 300) score += 20;
    else if (data.calories >= 150) score += 15;
    else score += 5;

    if (data.sleep !== null) {
        total += 25;
        if (data.sleep >= 7 && data.sleep <= 9) score += 25;
        else if (data.sleep >= 6 && data.sleep <= 10) score += 18;
        else score += 8;
    }

    if (data.hr !== null) {
        total += 25;
        if (data.hr >= 50 && data.hr <= 70) score += 25;
        else if (data.hr >= 45 && data.hr <= 80) score += 18;
        else score += 8;
    }

    const pct = total > 0 ? (score / total) * 100 : 0;

    if (pct >= 85) return { grade: 'A', color: '#22C55E', label: 'Excellent' };
    if (pct >= 70) return { grade: 'B', color: '#4ADE80', label: 'Good' };
    if (pct >= 55) return { grade: 'C', color: '#F59E0B', label: 'Average' };
    if (pct >= 40) return { grade: 'D', color: '#FB923C', label: 'Below Average' };
    return { grade: 'F', color: '#EF4444', label: 'Needs Work' };
}

const today = new Date();
const reportDate = today.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
});

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function HealthReportScreen() {
    const toast = useToast();
    const viewShotRef = useRef<ViewShot>(null);
    const [loading, setLoading] = useState(true);
    const [sharing, setSharing] = useState(false);

    const [healthToday, setHealthToday] = useState<HealthData | null>(null);
    const [healthHistory, setHealthHistory] = useState<HealthHistory | null>(null);
    const [prs, setPrs] = useState<PRData[]>([]);
    const [nutrition, setNutrition] = useState<NutritionProfile | null>(null);
    const [measurements, setMeasurements] = useState<MeasurementData | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [healthRes, historyRes, prsRes, nutritionRes, measureRes] = await Promise.all([
                healthAPI.getToday().catch(() => ({ data: null })),
                healthAPI.getHistory(7).catch(() => ({ data: null })),
                progressAPI.getPRs().catch(() => ({ prs: [] })),
                nutritionAPI.getProfile().catch(() => ({ profile: null })),
                measurementsAPI.getLatest().catch(() => ({ measurement: null })),
            ]);

            setHealthToday(healthRes?.data || null);
            setHealthHistory(historyRes?.data || null);
            setPrs((prsRes?.prs || []).slice(0, 5));
            setNutrition(nutritionRes?.profile || null);
            setMeasurements(measureRes?.measurement || null);
        } catch (e) {
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleShare = async () => {
        if (!viewShotRef.current?.capture) return;
        setSharing(true);
        try {
            const uri = await viewShotRef.current.capture();
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Share Health Report',
                });
            } else {
                toast.show('Sharing not available on this device', 'error');
            }
        } catch (e) {
            toast.show('Failed to share report', 'error');
        } finally {
            setSharing(false);
        }
    };

    const gradeData = healthToday
        ? getHealthGrade({
              steps: healthToday.steps || 0,
              calories: healthToday.active_calories || 0,
              sleep: healthToday.sleep_hours,
              hr: healthToday.resting_heart_rate,
          })
        : { grade: '—', color: colors.text.muted, label: 'Sync health data to get your grade' };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Health Report</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Generating your report...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const hasNutrition = nutrition &&
        !isNaN(nutrition.daily_calories) && nutrition.daily_calories > 0;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Health Report</Text>
                <TouchableOpacity onPress={handleShare} style={styles.shareBtn} disabled={sharing}>
                    {sharing ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <MaterialIcons name="share" size={22} color={colors.text.primary} />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <ViewShot
                    ref={viewShotRef}
                    options={{ format: 'png', quality: 1, result: 'tmpfile' }}
                    style={styles.reportContainer}
                >
                    {/* ── Report Header ── */}
                    <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.reportHeader}>
                        <View style={styles.reportTitleRow}>
                            <View>
                                <Text style={styles.reportBrand}>FITZO</Text>
                                <Text style={styles.reportSubtitle}>HEALTH REPORT</Text>
                            </View>
                            <View style={styles.dateChip}>
                                <MaterialIcons name="calendar-today" size={11} color={colors.text.muted} />
                                <Text style={styles.dateText}>{reportDate}</Text>
                            </View>
                        </View>
                        <View style={styles.reportDivider} />
                    </Animated.View>

                    {/* ── Overall Grade ── */}
                    <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={styles.gradeSection}>
                        <View style={[styles.gradeBadge, { borderColor: gradeData.color }]}>
                            <Text style={[styles.gradeText, { color: gradeData.color }]}>
                                {gradeData.grade}
                            </Text>
                        </View>
                        <View style={styles.gradeInfo}>
                            <Text style={styles.gradeLabel}>{gradeData.label}</Text>
                            <Text style={styles.gradeDescription}>
                                Based on activity, sleep & vitals
                            </Text>
                        </View>
                    </Animated.View>

                    {/* ── Today's Vitals (2x2 Grid) ── */}
                    <Animated.View entering={FadeInDown.delay(200).duration(600).springify()} style={styles.sectionBlock}>
                        <Text style={styles.sectionTitle}>TODAY'S VITALS</Text>
                        <View style={styles.vitalsRow}>
                            <VitalCard
                                icon="directions-walk"
                                label="Steps"
                                value={formatNumber(healthToday?.steps || 0)}
                                target="8,000"
                                color="#60A5FA"
                            />
                            <VitalCard
                                icon="local-fire-department"
                                label="Active Cal"
                                value={`${safeNum(healthToday?.active_calories)}`}
                                target="300"
                                unit="kcal"
                                color="#F97316"
                            />
                        </View>
                        <View style={[styles.vitalsRow, { marginTop: CARD_GAP }]}>
                            <VitalCard
                                icon="bedtime"
                                label="Sleep"
                                value={healthToday?.sleep_hours != null ? healthToday.sleep_hours.toFixed(1) : '—'}
                                target="7-9"
                                unit={healthToday?.sleep_hours != null ? 'hrs' : ''}
                                color="#A78BFA"
                            />
                            <VitalCard
                                icon="favorite"
                                label="Resting HR"
                                value={healthToday?.resting_heart_rate != null ? `${healthToday.resting_heart_rate}` : '—'}
                                target="50-70"
                                unit={healthToday?.resting_heart_rate != null ? 'bpm' : ''}
                                color="#F472B6"
                            />
                        </View>
                    </Animated.View>

                    {/* ── 7-Day Averages ── */}
                    {healthHistory?.averages && (
                        <Animated.View entering={FadeInDown.delay(300).duration(600).springify()} style={styles.sectionBlock}>
                            <Text style={styles.sectionTitle}>7-DAY AVERAGES</Text>
                            <GlassCard style={styles.innerCard}>
                                <View style={styles.avgRow}>
                                    <AvgStat label="Steps" value={formatNumber(safeNum(healthHistory.averages.avg_steps))} icon="directions-walk" />
                                    <View style={styles.avgDivider} />
                                    <AvgStat label="Calories" value={`${Math.round(safeNum(healthHistory.averages.avg_calories))}`} icon="local-fire-department" />
                                </View>
                                <View style={styles.avgRowDivider} />
                                <View style={styles.avgRow}>
                                    <AvgStat label="Sleep" value={healthHistory.averages.avg_sleep ? `${Number(healthHistory.averages.avg_sleep).toFixed(1)}h` : '—'} icon="bedtime" />
                                    <View style={styles.avgDivider} />
                                    <AvgStat label="Heart Rate" value={healthHistory.averages.avg_heart_rate ? `${Math.round(Number(healthHistory.averages.avg_heart_rate))}` : '—'} icon="favorite" />
                                </View>
                            </GlassCard>
                        </Animated.View>
                    )}

                    {/* ── Weekly Steps Chart ── */}
                    {healthHistory?.daily && healthHistory.daily.length > 0 && (
                        <Animated.View entering={FadeInDown.delay(400).duration(600).springify()} style={styles.sectionBlock}>
                            <Text style={styles.sectionTitle}>STEPS THIS WEEK</Text>
                            <GlassCard style={styles.innerCard}>
                                <MiniBarChart
                                    data={healthHistory.daily.map((d) => ({
                                        label: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }).charAt(0),
                                        value: d.steps || 0,
                                    }))}
                                    target={8000}
                                />
                            </GlassCard>
                        </Animated.View>
                    )}

                    {/* ── Body Composition ── */}
                    {measurements && (measurements.weight || measurements.body_fat) && (
                        <Animated.View entering={FadeInDown.delay(500).duration(600).springify()} style={styles.sectionBlock}>
                            <Text style={styles.sectionTitle}>BODY COMPOSITION</Text>
                            <GlassCard style={styles.innerCard}>
                                <View style={styles.bodyRow}>
                                    {measurements.weight != null && <BodyStat label="Weight" value={`${measurements.weight}`} unit="kg" />}
                                    {measurements.body_fat != null && <BodyStat label="Body Fat" value={`${measurements.body_fat}`} unit="%" />}
                                    {measurements.waist != null && <BodyStat label="Waist" value={`${measurements.waist}`} unit="cm" />}
                                    {measurements.chest != null && <BodyStat label="Chest" value={`${measurements.chest}`} unit="cm" />}
                                </View>
                            </GlassCard>
                        </Animated.View>
                    )}

                    {/* ── Nutrition Targets ── */}
                    {hasNutrition && (
                        <Animated.View entering={FadeInDown.delay(600).duration(600).springify()} style={styles.sectionBlock}>
                            <Text style={styles.sectionTitle}>DAILY NUTRITION TARGETS</Text>
                            <GlassCard style={styles.innerCard}>
                                <View style={styles.macroRow}>
                                    <MacroStat label="Calories" value={safeNum(nutrition!.daily_calories)} unit="kcal" color="#F97316" />
                                    <MacroStat label="Protein" value={safeNum(nutrition!.daily_protein)} unit="g" color="#60A5FA" />
                                    <MacroStat label="Carbs" value={safeNum(nutrition!.daily_carbs)} unit="g" color="#4ADE80" />
                                    <MacroStat label="Fat" value={safeNum(nutrition!.daily_fat)} unit="g" color="#F472B6" />
                                </View>
                            </GlassCard>
                        </Animated.View>
                    )}

                    {/* ── Personal Records ── */}
                    {prs.length > 0 && (
                        <Animated.View entering={FadeInDown.delay(700).duration(600).springify()} style={styles.sectionBlock}>
                            <Text style={styles.sectionTitle}>TOP PERSONAL RECORDS</Text>
                            <GlassCard style={styles.innerCard}>
                                {prs.map((pr, i) => (
                                    <View key={i}>
                                        <View style={styles.prRow}>
                                            <View style={styles.prRank}>
                                                <Text style={styles.prRankText}>{i + 1}</Text>
                                            </View>
                                            <View style={styles.prInfo}>
                                                <Text style={styles.prName}>{pr.exercise_name}</Text>
                                                <Text style={styles.prDetail}>
                                                    {pr.max_weight}kg x {pr.reps_at_max} reps
                                                </Text>
                                            </View>
                                            <MaterialIcons name="emoji-events" size={20} color="#F59E0B" />
                                        </View>
                                        {i < prs.length - 1 && <View style={styles.prDivider} />}
                                    </View>
                                ))}
                            </GlassCard>
                        </Animated.View>
                    )}

                    {/* ── Footer ── */}
                    <Animated.View entering={FadeInDown.delay(800).duration(600).springify()} style={styles.reportFooter}>
                        <View style={styles.footerLine} />
                        <Text style={styles.footerText}>Generated by Fitzo</Text>
                        <Text style={styles.footerDate}>{reportDate}</Text>
                    </Animated.View>
                </ViewShot>
            </ScrollView>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function VitalCard({ icon, label, value, target, unit, color }: {
    icon: string; label: string; value: string; target: string; unit?: string; color: string;
}) {
    return (
        <View style={styles.vitalCard}>
            <View style={[styles.vitalIconBg, { backgroundColor: color + '18' }]}>
                <MaterialIcons name={icon as any} size={18} color={color} />
            </View>
            <Text style={styles.vitalValue}>
                {value}
                {unit ? <Text style={styles.vitalUnit}> {unit}</Text> : null}
            </Text>
            <Text style={styles.vitalLabel}>{label}</Text>
            <Text style={styles.vitalTarget}>Target: {target}</Text>
        </View>
    );
}

function AvgStat({ label, value, icon }: { label: string; value: string; icon: string }) {
    return (
        <View style={styles.avgStat}>
            <MaterialIcons name={icon as any} size={16} color={colors.text.muted} />
            <Text style={styles.avgValue}>{value}</Text>
            <Text style={styles.avgLabel}>{label}</Text>
        </View>
    );
}

function BodyStat({ label, value, unit }: { label: string; value: string; unit: string }) {
    return (
        <View style={styles.bodyStat}>
            <Text style={styles.bodyValue}>
                {value}<Text style={styles.bodyUnit}>{unit}</Text>
            </Text>
            <Text style={styles.bodyLabel}>{label}</Text>
        </View>
    );
}

function MacroStat({ label, value, unit, color }: {
    label: string; value: number; unit: string; color: string;
}) {
    return (
        <View style={styles.macroItem}>
            <View style={[styles.macroDot, { backgroundColor: color }]} />
            <Text style={styles.macroValue}>
                {Math.round(value)}<Text style={styles.macroUnit}>{unit}</Text>
            </Text>
            <Text style={styles.macroLabel}>{label}</Text>
        </View>
    );
}

function MiniBarChart({ data, target }: {
    data: Array<{ label: string; value: number }>; target: number;
}) {
    const max = Math.max(...data.map((d) => d.value), target, 1);

    return (
        <View style={styles.chartContainer}>
            <View style={styles.chartBars}>
                {data.map((d, i) => {
                    const pct = (d.value / max) * 100;
                    const hit = d.value >= target;
                    return (
                        <View key={i} style={styles.barColumn}>
                            <View style={styles.barWrapper}>
                                <View
                                    style={[
                                        styles.bar,
                                        {
                                            height: `${Math.max(pct, 5)}%`,
                                            backgroundColor: hit ? '#22C55E' : '#60A5FA',
                                            opacity: hit ? 1 : 0.6,
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.barLabel}>{d.label}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

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
    shareBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
    },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
    loadingText: { fontSize: typography.sizes.md, fontFamily: typography.fontFamily.regular, color: colors.text.muted },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] },

    // Report
    reportContainer: { backgroundColor: colors.background, paddingTop: spacing.md },
    reportHeader: { marginBottom: spacing['2xl'] },
    reportTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    reportBrand: {
        fontSize: typography.sizes['3xl'], fontFamily: typography.fontFamily.extraBold,
        color: colors.text.primary, letterSpacing: 6,
    },
    reportSubtitle: {
        fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.medium,
        color: colors.text.muted, letterSpacing: 4, marginTop: 2,
    },
    dateChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border,
        borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 5,
    },
    dateText: { fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.regular, color: colors.text.muted },
    reportDivider: { height: 1, backgroundColor: colors.glass.borderLight, marginTop: spacing.lg },

    // Grade
    gradeSection: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xl,
        marginBottom: spacing['2xl'], paddingHorizontal: spacing.xs,
    },
    gradeBadge: {
        width: 68, height: 68, borderRadius: 34, borderWidth: 3,
        alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.02)',
    },
    gradeText: { fontSize: 32, fontFamily: typography.fontFamily.extraBold },
    gradeInfo: { flex: 1 },
    gradeLabel: { fontSize: typography.sizes.lg, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary },
    gradeDescription: { fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.regular, color: colors.text.muted, marginTop: 2 },

    // Section
    sectionBlock: { marginBottom: spacing.xl },
    sectionTitle: {
        fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted, letterSpacing: 2, marginBottom: spacing.sm,
    },

    // Vitals — explicit 2-column rows
    vitalsRow: { flexDirection: 'row', gap: CARD_GAP },
    vitalCard: {
        width: CARD_WIDTH,
        backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border,
        borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'flex-start',
    },
    vitalIconBg: {
        width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs,
    },
    vitalValue: { fontSize: typography.sizes['2xl'], fontFamily: typography.fontFamily.bold, color: colors.text.primary },
    vitalUnit: { fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.regular, color: colors.text.muted },
    vitalLabel: { fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.regular, color: colors.text.secondary, marginTop: 1 },
    vitalTarget: { fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.regular, color: colors.text.subtle, marginTop: 3 },

    // Inner cards
    innerCard: { padding: spacing.lg },

    // Averages
    avgRow: { flexDirection: 'row', alignItems: 'center' },
    avgDivider: { width: 1, height: 36, backgroundColor: colors.glass.border },
    avgRowDivider: { height: 1, backgroundColor: colors.glass.border, marginVertical: spacing.md },
    avgStat: { flex: 1, alignItems: 'center', gap: 3 },
    avgValue: { fontSize: typography.sizes.lg, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
    avgLabel: { fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.regular, color: colors.text.muted },

    // Chart
    chartContainer: { height: 120 },
    chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: spacing.xs },
    barColumn: { flex: 1, alignItems: 'center' },
    barWrapper: { width: '100%', height: 80, justifyContent: 'flex-end', alignItems: 'center' },
    bar: { width: '60%', borderRadius: 4, minHeight: 4 },
    barLabel: { fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.regular, color: colors.text.muted, marginTop: 4 },

    // Body
    bodyRow: { flexDirection: 'row', justifyContent: 'space-around' },
    bodyStat: { alignItems: 'center' },
    bodyValue: { fontSize: typography.sizes['2xl'], fontFamily: typography.fontFamily.bold, color: colors.text.primary },
    bodyUnit: { fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.regular, color: colors.text.muted },
    bodyLabel: { fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.regular, color: colors.text.muted, marginTop: 3 },

    // Nutrition
    macroRow: { flexDirection: 'row', justifyContent: 'space-around' },
    macroItem: { alignItems: 'center', gap: 4 },
    macroDot: { width: 8, height: 8, borderRadius: 4 },
    macroValue: { fontSize: typography.sizes.lg, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
    macroUnit: { fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.regular, color: colors.text.muted },
    macroLabel: { fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.regular, color: colors.text.muted },

    // PRs
    prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    prRank: {
        width: 26, height: 26, borderRadius: 13, backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1, borderColor: colors.glass.border, alignItems: 'center', justifyContent: 'center',
    },
    prRankText: { fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.semiBold, color: colors.text.secondary },
    prInfo: { flex: 1 },
    prName: { fontSize: typography.sizes.md, fontFamily: typography.fontFamily.medium, color: colors.text.primary },
    prDetail: { fontSize: typography.sizes.xs, fontFamily: typography.fontFamily.regular, color: colors.text.muted, marginTop: 1 },
    prDivider: { height: 1, backgroundColor: colors.glass.border, marginVertical: spacing.sm },

    // Footer
    reportFooter: { alignItems: 'center', marginTop: spacing.lg, gap: 4 },
    footerLine: { width: 50, height: 1, backgroundColor: colors.glass.borderLight, marginBottom: spacing.xs },
    footerText: { fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.medium, color: colors.text.subtle, letterSpacing: 2 },
    footerDate: { fontSize: typography.sizes['2xs'], fontFamily: typography.fontFamily.regular, color: colors.text.subtle },
});
