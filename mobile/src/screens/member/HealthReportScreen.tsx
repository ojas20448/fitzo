import ScreenBackdrop from '../../components/ScreenBackdrop';
import { useAuth } from '../../context/AuthContext';
import { isHealthImportEnabled, enableHealthImport } from '../../utils/healthImportPreference';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import { healthAPI, progressAPI, nutritionAPI, measurementsAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { isHealthAvailable, requestPermissions } from '../../services/healthService';
import { syncHealthDays } from '../../services/healthSync';
import { healthReportData, healthReportDetails } from '../../utils/healthReportData';
import { useShareCapture } from '../../hooks/useShareCapture';
import HealthSyncStatusDetails from '../../components/HealthSyncStatusDetails';
import { subscribeHealthSyncStatus } from '../../utils/healthSyncStatus';

const CARD_GAP = 10;
const healthSource = Platform.OS === 'ios' ? 'Apple Health' : Platform.OS === 'android' ? 'Health Connect' : 'Device health data';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface HealthData {
    steps: number | null;
    active_calories: number | null;
    resting_heart_rate: number | null;
    sleep_hours: number | null;
}

type ReportDetails = ReturnType<typeof healthReportDetails>;

interface HealthHistory {
    daily: {
        date: string;
        steps: number | null;
        active_calories: number | null;
        resting_heart_rate: number | null;
        sleep_hours: number | null;
    }[];
    averages: {
        avg_steps: number | null;
        avg_calories: number | null;
        avg_heart_rate: number | null;
        avg_sleep: number | null;
    };
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function formatNumber(n: number | null | undefined): string {
    if (n == null) return '—';
    return Math.round(n).toLocaleString('en-IN');
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function HealthReportScreen() {
    const { user } = useAuth();
    const viewShotRef = useRef<ViewShot>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const { captureAndShare, isSharing, shareError } = useShareCapture();
    const reportDate = new Date().toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    const [healthToday, setHealthToday] = useState<HealthData | null>(null);
    const [healthHistory, setHealthHistory] = useState<HealthHistory | null>(null);
    const [prs, setPrs] = useState<ReportDetails['prs']>([]);
    const [nutrition, setNutrition] = useState<ReportDetails['nutrition']>(null);
    const [measurements, setMeasurements] = useState<ReportDetails['measurements']>(null);
    const [healthImportOn, setHealthImportOn] = useState(false);
    const [connectingHealth, setConnectingHealth] = useState(false);
    const [connectionMessage, setConnectionMessage] = useState('');
    const loadRequest = useRef(0);

    const loadData = useCallback(async (syncDevice = true, showLoading = true) => {
        const request = ++loadRequest.current;
        if (showLoading) setLoading(true);
        setLoadError(false);
        try {
            const importEnabled = isHealthAvailable() && await isHealthImportEnabled(user?.id);
            if (request !== loadRequest.current) return;
            setHealthImportOn(importEnabled);
            // Auto-sync from device health services if available
            if (importEnabled && syncDevice) {
                try {
                    if (user?.id) await syncHealthDays(user.id);
                } catch {
                    // Account sync history exposes the failure; saved readings remain readable.
                    if (request === loadRequest.current) setConnectionMessage('Latest readings could not be imported. Saved readings are shown below; you can retry Sync now.');
                }
            }
            if (request !== loadRequest.current) return;

            const [healthRes, historyRes, prsRes, nutritionRes, measureRes] = await Promise.all([
                healthAPI.getToday(),
                healthAPI.getHistory(7),
                progressAPI.getPRs(),
                nutritionAPI.getProfile(),
                measurementsAPI.getLatest(),
            ]);
            if (request !== loadRequest.current) return;

            const report = healthReportData(healthRes, historyRes);
            const details = healthReportDetails(prsRes, nutritionRes, measureRes);
            setHealthToday(report.today);
            setHealthHistory(report.history);
            setPrs(details.prs);
            setNutrition(details.nutrition);
            setMeasurements(details.measurements);
        } catch {
            // A failed request is not an empty report. Keep it out of exports too.
            if (request === loadRequest.current) {
                if (showLoading) setLoadError(true);
                else setConnectionMessage('Latest readings could not be refreshed. Saved readings are still shown; try Sync now again.');
            }
        } finally {
            if (request === loadRequest.current) setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        const generation = loadRequest;
        setConnectionMessage('');
        loadData();
        return () => { generation.current++; };
    }, [loadData]);

    useEffect(() => {
        if (!user?.id) return;
        let lastCheck: string | undefined;
        return subscribeHealthSyncStatus(user.id, status => {
            if (!status.lastCheckedAt || status.lastCheckedAt === lastCheck) return;
            lastCheck = status.lastCheckedAt;
            void loadData(false, false);
        });
    }, [user?.id, loadData]);

    const handleConnectHealth = async () => {
        if (!user?.id || connectingHealth) return;
        setConnectingHealth(true);
        setConnectionMessage('');
        try {
            const granted = await requestPermissions();
            if (granted) {
                await enableHealthImport(user.id);
                setHealthImportOn(true);
                await loadData();
            } else {
                setConnectionMessage(`${healthSource} connection was not completed. You can continue using Fitzo.`);
            }
        } catch (error) {
            setConnectionMessage(error instanceof Error ? error.message : 'Health connection could not finish. Please try again.');
        } finally {
            setConnectingHealth(false);
        }
    };

    const handleSyncHealth = async () => {
        if (!user?.id || connectingHealth) return;
        setConnectingHealth(true);
        setConnectionMessage('');
        try {
            const result = await syncHealthDays(user.id);
            setConnectionMessage(result.unreadableDays
                ? `Some ${healthSource} readings could not be read. Saved ${result.imported} days. Check read access and try again.`
                : result.imported
                    ? `Updated ${result.imported} ${result.imported === 1 ? 'day' : 'days'}. Checked ${result.total} days.`
                    : `No readable ${healthSource} readings were found. Check that readings exist and Fitzo has read access, then try again.`);
        }
        catch { setConnectionMessage('Import did not finish. Saved readings are kept; you can retry.'); }
        finally { await loadData(false); setConnectingHealth(false); }
    };

    const handleShare = () => {
        captureAndShare(viewShotRef, {
            dialogTitle: 'Share Health Report',
            fallbackMessage: `My Fitzo Health Report — ${reportDate}`,
        });
    };

    const readingCount = healthToday ? Object.values(healthToday).filter(value => value != null).length : 0;
    const hasTodayReadings = healthToday != null && Object.values(healthToday).some(value => value != null);
    const hasHistoryReadings = healthHistory != null && Object.values(healthHistory.averages).some(value => value != null);
    const hasReadings = hasTodayReadings || hasHistoryReadings;

    if (loading || loadError) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenBackdrop />
                <View style={styles.header}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Health Report</Text>
                    <View style={{ width: 44 }} />
                </View>
                <View style={styles.loadingContainer}>
                    {loading ? <>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Loading your saved readings…</Text>
                    </> : <>
                        <Text accessibilityRole="alert" style={styles.errorTitle}>Couldn&apos;t load your report</Text>
                        <Text style={styles.loadingText}>Check your connection and try again.</Text>
                        <TouchableOpacity accessibilityRole="button" onPress={() => { void loadData(); }} style={styles.retryButton}>
                            <Text style={styles.retryText}>Try again</Text>
                        </TouchableOpacity>
                    </>}
                </View>
            </SafeAreaView>
        );
    }

    const hasNutrition = nutrition?.target_calories != null && nutrition.target_calories > 0;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenBackdrop />
            <View style={styles.header}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Health Report</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share health report" accessibilityState={{ disabled: isSharing, busy: isSharing }} onPress={handleShare} style={styles.shareBtn} disabled={isSharing}>
                    {isSharing ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <MaterialIcons name="share" size={22} color={colors.text.primary} />
                    )}
                </TouchableOpacity>
            </View>
            {shareError && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.shareError}>{shareError}</Text>}

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.importControls}>
                    <Text style={styles.gradeLabel}>{isHealthAvailable() ? healthSource : 'Health importing'}</Text>
                    <Text style={styles.importDetail}>{!isHealthAvailable()
                        ? 'Saved readings can be viewed here. Import new readings from a supported Fitzo mobile build.'
                        : healthImportOn ? 'Imports are on for this account. Sync now checks today and yesterday.'
                            : `Optional. Import steps, active calories, resting heart rate and sleep from ${healthSource}.`}</Text>
                    {healthImportOn && <HealthSyncStatusDetails key={user?.id} userId={user?.id} />}
                    {!!connectionMessage && <Text accessibilityLiveRegion="polite" style={styles.importDetail}>{connectionMessage}</Text>}
                    {isHealthAvailable() && <TouchableOpacity accessibilityRole="button"
                        accessibilityState={{ disabled: connectingHealth, busy: connectingHealth }} disabled={connectingHealth}
                        style={styles.connectButton} onPress={healthImportOn ? handleSyncHealth : handleConnectHealth}>
                        {connectingHealth ? <ActivityIndicator accessibilityLabel="Checking health data" color={colors.background} />
                            : <Text style={styles.connectButtonText}>{healthImportOn ? 'Sync now' : 'Continue'}</Text>}
                    </TouchableOpacity>}
                </View>
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

                    {/* ── Apple Health / HealthKit Integration Banner ── */}
                    <Animated.View entering={FadeInDown.delay(50).duration(600).springify()} style={styles.healthKitBanner}>
                        <View style={styles.healthKitBannerIcon}>
                            <MaterialIcons name="favorite" size={20} color={colors.accent.rose} />
                        </View>
                        <View style={styles.healthKitBannerContent}>
                            <View style={styles.healthKitBannerTitleRow}>
                                <Text style={styles.healthKitBannerTitle}>
                                    Saved health readings
                                </Text>
                                <View style={styles.healthKitPill}>
                                    <Text style={styles.healthKitPillText}>
                                        {hasReadings ? 'Readings saved' : 'No saved readings'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.healthKitBannerDesc}>
                                {hasReadings
                                    ? 'Saved readings are shown below. A dash means no reading was imported.'
                                    : 'No readings were imported for this period. A dash means unknown, not zero.'}
                            </Text>
                        </View>
                    </Animated.View>

                    {/* Reading coverage describes the data, not the user's health. */}
                    <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={styles.gradeSection}>
                        <View style={styles.gradeInfo}>
                            <Text style={styles.gradeLabel}>{readingCount} of 4 readings available today</Text>
                            <Text style={styles.gradeDescription}>
                                Imported readings only. This report does not assess your health.
                            </Text>
                        </View>
                    </Animated.View>

                    {/* ── Today's Vitals (2x2 Grid) ── */}
                    <Animated.View entering={FadeInDown.delay(200).duration(600).springify()} style={styles.sectionBlock}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>TODAY&apos;S VITALS</Text>
                            <View style={styles.sectionBadge}>
                                <MaterialIcons name="sync" size={11} color={colors.text.muted} />
                                <Text style={styles.sectionBadgeText}>
                                    Imported
                                </Text>
                            </View>
                        </View>
                        <View style={styles.vitalsRow}>
                            <VitalCard
                                icon="directions-walk"
                                label="Steps"
                                value={formatNumber(healthToday?.steps)}
                                color={colors.accent.sky}
                            />
                            <VitalCard
                                icon="local-fire-department"
                                label="Active Cal"
                                value={formatNumber(healthToday?.active_calories)}
                                unit={healthToday?.active_calories != null ? 'kcal' : ''}
                                color={colors.accent.orange}
                            />
                        </View>
                        <View style={[styles.vitalsRow, { marginTop: CARD_GAP }]}>
                            <VitalCard
                                icon="bedtime"
                                label="Sleep"
                                value={healthToday?.sleep_hours != null ? healthToday.sleep_hours.toFixed(1) : '—'}
                                unit={healthToday?.sleep_hours != null ? 'hrs' : ''}
                                color={colors.accent.lilac}
                            />
                            <VitalCard
                                icon="favorite"
                                label="Resting HR"
                                value={healthToday?.resting_heart_rate != null ? `${healthToday.resting_heart_rate}` : '—'}
                                unit={healthToday?.resting_heart_rate != null ? 'bpm' : ''}
                                color={colors.accent.rose}
                            />
                        </View>
                    </Animated.View>

                    {/* ── 7-Day Averages ── */}
                    {hasHistoryReadings && healthHistory && (
                        <Animated.View entering={FadeInDown.delay(300).duration(600).springify()} style={styles.sectionBlock}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>7-DAY AVERAGES</Text>
                                <View style={styles.sectionBadge}>
                                    <MaterialIcons name="sync" size={11} color={colors.text.muted} />
                                    <Text style={styles.sectionBadgeText}>
                                        Imported
                                    </Text>
                                </View>
                            </View>
                            <GlassCard style={styles.innerCard}>
                                <View style={styles.avgRow}>
                                    <AvgStat label="Steps" value={formatNumber(healthHistory.averages.avg_steps)} icon="directions-walk" />
                                    <View style={styles.avgDivider} />
                                    <AvgStat label="Calories" value={healthHistory.averages.avg_calories == null ? '—' : `${Math.round(healthHistory.averages.avg_calories)}`} icon="local-fire-department" />
                                </View>
                                <View style={styles.avgRowDivider} />
                                <View style={styles.avgRow}>
                                    <AvgStat label="Sleep" value={healthHistory.averages.avg_sleep != null ? `${healthHistory.averages.avg_sleep.toFixed(1)}h` : '—'} icon="bedtime" />
                                    <View style={styles.avgDivider} />
                                    <AvgStat label="Heart Rate" value={healthHistory.averages.avg_heart_rate != null ? `${Math.round(healthHistory.averages.avg_heart_rate)}` : '—'} icon="favorite" />
                                </View>
                            </GlassCard>
                        </Animated.View>
                    )}

                    {/* ── Weekly Steps Chart ── */}
                    {healthHistory?.daily.some(day => day.steps != null) && (
                        <Animated.View entering={FadeInDown.delay(400).duration(600).springify()} style={styles.sectionBlock}>
                            <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>STEPS THIS WEEK</Text></View>
                            <GlassCard style={styles.innerCard}>
                                <MiniBarChart
                                    data={healthHistory.daily.filter(d => d.steps != null).map((d) => ({
                                        label: new Date(`${d.date.slice(0, 10)}T12:00:00`).toLocaleDateString('en', { weekday: 'short' }),
                                        value: d.steps ?? 0,
                                    })).reverse()}
                                />
                                <Text style={styles.importDetail}>Only days with imported steps are shown.</Text>
                            </GlassCard>
                        </Animated.View>
                    )}

                    {/* ── Body Composition ── */}
                    {measurements && Object.values(measurements).some(value => value != null) && (
                        <Animated.View entering={FadeInDown.delay(500).duration(600).springify()} style={styles.sectionBlock}>
                            <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>BODY COMPOSITION</Text></View>
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
                            <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>DAILY NUTRITION TARGETS</Text></View>
                            <GlassCard style={styles.innerCard}>
                                <View style={styles.macroRow}>
                                    <MacroStat label="Calories" value={nutrition!.target_calories} unit="kcal" color={colors.accent.orange} />
                                    <MacroStat label="Protein" value={nutrition!.target_protein} unit="g" color={colors.macro.protein} />
                                    <MacroStat label="Carbs" value={nutrition!.target_carbs} unit="g" color={colors.macro.carbs} />
                                    <MacroStat label="Fat" value={nutrition!.target_fat} unit="g" color={colors.macro.fat} />
                                </View>
                            </GlassCard>
                        </Animated.View>
                    )}

                    {/* ── Personal Records ── */}
                    {prs.length > 0 && (
                        <Animated.View entering={FadeInDown.delay(700).duration(600).springify()} style={styles.sectionBlock}>
                            <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>TOP PERSONAL RECORDS</Text></View>
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
                                                    {pr.max_weight_kg == null ? '—' : pr.max_weight_kg === 0 ? 'Bodyweight' : `${pr.max_weight_kg} kg`} x {pr.reps_at_max ?? '—'} reps
                                                </Text>
                                            </View>
                                            <MaterialIcons name="emoji-events" size={20} color={colors.accent.gold} />
                                        </View>
                                        {i < prs.length - 1 && <View style={styles.prDivider} />}
                                    </View>
                                ))}
                            </GlassCard>
                        </Animated.View>
                    )}

                    {/* ── HealthKit Transparency & Privacy Disclosure ── */}
                    <Animated.View entering={FadeInDown.delay(750).duration(600).springify()} style={styles.healthKitDisclaimer}>
                        <MaterialIcons name="health-and-safety" size={18} color={colors.text.muted} />
                        <Text style={styles.healthKitDisclaimerText}>
                            {Platform.OS === 'ios'
                                ? 'Fitzo integrates with Apple Health (HealthKit) to read your daily steps, active calories burned, resting heart rate, and sleep analysis. When connected, available readings are imported into your Fitzo account for your report and AI coach.'
                                : Platform.OS === 'android'
                                    ? 'Fitzo integrates with Health Connect to read your daily steps, active calories burned, resting heart rate, and sleep analysis. When connected, available readings are imported into your Fitzo account for your report and AI coach.'
                                    : 'The Fitzo mobile app can import available readings from Apple Health or Health Connect into your account for your report and AI coach.'}
                        </Text>
                    </Animated.View>

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

function VitalCard({ icon, label, value, unit, color }: {
    icon: string; label: string; value: string; unit?: string; color: string;
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
    label: string; value: number | null; unit: string; color: string;
}) {
    return (
        <View style={styles.macroItem}>
            <View style={[styles.macroDot, { backgroundColor: color }]} />
            <Text style={[styles.macroValue, { color: value == null ? colors.text.muted : color }]}>
                {value == null ? '—' : Math.round(value)}{value != null && <Text style={styles.macroUnit}> {unit}</Text>}
            </Text>
            <Text style={styles.macroLabel}>{label}</Text>
        </View>
    );
}

function MiniBarChart({ data }: {
    data: { label: string; value: number }[];
}) {
    const max = Math.max(...data.map((d) => d.value), 1);

    return (
        <View style={styles.chartContainer}>
            <View style={styles.chartBars}>
                {data.map((d, i) => {
                    const pct = (d.value / max) * 100;
                    return (
                        <View key={i} style={styles.barColumn}>
                            <View style={styles.barWrapper}>
                                <View
                                    style={[
                                        styles.bar,
                                        {
                                            height: `${pct}%`,
                                            backgroundColor: colors.accent.sky,
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
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.xl, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary,
    },
    shareBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
    },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
    loadingText: { fontSize: typography.sizes.md, fontFamily: typography.fontFamily.regular, color: colors.text.muted, textAlign: 'center' },
    errorTitle: { fontSize: typography.sizes.lg, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary, textAlign: 'center' },
    retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xl, backgroundColor: colors.primary, borderRadius: borderRadius.full },
    retryText: { fontSize: typography.sizes.md, fontFamily: typography.fontFamily.semiBold, color: colors.background },
    shareError: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, color: colors.error, fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.sm },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['5xl'] },
    importControls: { padding: spacing.md, gap: 10, marginBottom: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.lg },
    importDetail: { color: colors.text.secondary, fontSize: 13, lineHeight: 20, fontFamily: typography.fontFamily.regular },

    // Report
    reportContainer: { backgroundColor: colors.background, paddingTop: spacing.md },
    reportHeader: { marginBottom: spacing['2xl'] },
    reportTitleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between', alignItems: 'flex-start' },
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

    // HealthKit Banner
    healthKitBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.xl,
    },
    healthKitBannerIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(244, 63, 94, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    healthKitBannerContent: { flex: 1 },
    healthKitBannerTitleRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    healthKitBannerTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    healthKitPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: colors.glass.surface,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
    },
    healthKitPillText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    healthKitBannerDesc: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        lineHeight: 14,
    },
    connectButton: {
        minHeight: 48,
        marginTop: spacing.sm,
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: borderRadius.md,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    connectButtonText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.semiBold,
        color: '#000000',
    },

    // Section
    sectionBlock: { marginBottom: spacing.xl },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    sectionTitle: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    sectionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    sectionBadgeText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },

    // HealthKit Disclaimer
    healthKitDisclaimer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.md,
    },
    healthKitDisclaimerText: {
        flex: 1,
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        lineHeight: 15,
    },

    // Vitals — explicit 2-column rows
    vitalsRow: { flexDirection: 'row', gap: CARD_GAP },
    vitalCard: {
        flex: 1, minWidth: 0,
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
    bar: { width: '60%', borderRadius: 4 },
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
