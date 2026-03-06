import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { readinessAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

// Score to color mapping
const SCORE_COLOR = (score: number) => {
    if (score >= 85) return '#22C55E'; // green
    if (score >= 70) return '#86EFAC'; // light green
    if (score >= 50) return '#F59E0B'; // amber
    if (score >= 30) return '#FB923C'; // orange
    return '#EF4444';                  // red
};

const SCORE_LABEL = (score: number) => {
    if (score >= 85) return 'Peak';
    if (score >= 70) return 'High';
    if (score >= 50) return 'Moderate';
    if (score >= 30) return 'Low';
    return 'Rest Day';
};

interface SliderProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    lowLabel: string;
    highLabel: string;
}

const ScaleSelector: React.FC<SliderProps> = ({ label, value, onChange, lowLabel, highLabel }) => (
    <View style={styles.sliderBlock}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <View style={styles.scaleRow}>
            {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity
                    key={n}
                    style={[
                        styles.scaleDot,
                        value === n && styles.scaleDotActive,
                    ]}
                    onPress={() => onChange(n)}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.scaleDotText,
                        value === n && styles.scaleDotTextActive,
                    ]}>
                        {n}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
        <View style={styles.scaleHints}>
            <Text style={styles.scaleHintText}>{lowLabel}</Text>
            <Text style={styles.scaleHintText}>{highLabel}</Text>
        </View>
    </View>
);

const ReadinessCheckInScreen: React.FC = () => {
    const toast = useToast();
    const [energy, setEnergy] = useState(3);
    const [sleep, setSleep] = useState(3);
    const [soreness, setSoreness] = useState(3);
    const [sleepHours, setSleepHours] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
    const [existingReadiness, setExistingReadiness] = useState<any>(null);
    const [checkingExisting, setCheckingExisting] = useState(true);

    useEffect(() => {
        checkExisting();
    }, []);

    const checkExisting = async () => {
        try {
            const res = await readinessAPI.getToday();
            if (res.checked_in) {
                setAlreadyCheckedIn(true);
                setExistingReadiness(res.readiness);
                // Prefill with existing values
                setEnergy(res.readiness.energy_level);
                setSleep(res.readiness.sleep_quality);
                setSoreness(res.readiness.soreness);
                if (res.readiness.sleep_hours) {
                    setSleepHours(String(res.readiness.sleep_hours));
                }
            }
        } catch (e) {
            // Not checked in yet, fine
        } finally {
            setCheckingExisting(false);
        }
    };

    // Live preview score
    const previewScore = (() => {
        const energyScore   = ((energy - 1) / 4) * 35;
        const sleepScore    = ((sleep - 1) / 4) * 30;
        const sorenessScore = ((5 - soreness) / 4) * 25;
        const hours = parseFloat(sleepHours);
        let hoursBonus = 5;
        if (!isNaN(hours)) {
            if (hours >= 7 && hours <= 9) hoursBonus = 10;
            else if (hours >= 6 && hours < 7)  hoursBonus = 6;
            else if (hours > 9 && hours <= 10) hoursBonus = 7;
            else if (hours >= 5 && hours < 6)  hoursBonus = 3;
            else hoursBonus = 0;
        }
        return Math.round(energyScore + sleepScore + sorenessScore + hoursBonus);
    })();

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const hours = parseFloat(sleepHours);
            const res = await readinessAPI.checkin({
                energy_level: energy,
                sleep_quality: sleep,
                soreness,
                sleep_hours: !isNaN(hours) ? hours : undefined,
                notes: notes.trim() || undefined,
            });
            setAlreadyCheckedIn(true);
            setExistingReadiness(res.readiness);
            toast.success('Checked in', res.readiness.recommendation_message);
        } catch (e: any) {
            toast.error('Error', e?.response?.data?.message || 'Check-in failed');
        } finally {
            setLoading(false);
        }
    };

    if (checkingExisting) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
            </SafeAreaView>
        );
    }

    const score = existingReadiness?.readiness_score ?? previewScore;
    const scoreColor = SCORE_COLOR(score);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Morning Check-In</Text>
                    <View style={{ width: 36 }} />
                </View>

                {/* Score Ring */}
                <View style={styles.scoreContainer}>
                    <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
                        <Text style={[styles.scoreNumber, { color: scoreColor }]}>{score}</Text>
                        <Text style={styles.scoreSubText}>/ 100</Text>
                    </View>
                    <Text style={[styles.scoreLabel, { color: scoreColor }]}>
                        {SCORE_LABEL(score)} Readiness
                    </Text>
                    {(existingReadiness || !alreadyCheckedIn) && (
                        <Text style={styles.scoreMessage}>
                            {existingReadiness?.recommendation_message ||
                                'Fill in your morning stats below'}
                        </Text>
                    )}
                </View>

                {alreadyCheckedIn && existingReadiness && (
                    <View style={styles.checkedInBadge}>
                        <MaterialIcons name="check-circle" size={14} color={colors.success} />
                        <Text style={styles.checkedInText}>
                            Checked in today. Update below to recalculate.
                        </Text>
                    </View>
                )}

                {/* Inputs */}
                <View style={styles.card}>
                    <ScaleSelector
                        label="Energy Level"
                        value={energy}
                        onChange={setEnergy}
                        lowLabel="Exhausted"
                        highLabel="Energized"
                    />
                    <View style={styles.divider} />
                    <ScaleSelector
                        label="Sleep Quality"
                        value={sleep}
                        onChange={setSleep}
                        lowLabel="Terrible"
                        highLabel="Amazing"
                    />
                    <View style={styles.divider} />
                    <ScaleSelector
                        label="Muscle Soreness"
                        value={soreness}
                        onChange={setSoreness}
                        lowLabel="None"
                        highLabel="Very sore"
                    />
                </View>

                {/* Sleep hours */}
                <View style={styles.card}>
                    <Text style={styles.sliderLabel}>Sleep Hours (optional)</Text>
                    <TextInput
                        style={styles.textInput}
                        keyboardType="decimal-pad"
                        placeholder="e.g. 7.5"
                        placeholderTextColor={colors.text.muted}
                        value={sleepHours}
                        onChangeText={setSleepHours}
                        maxLength={4}
                    />
                </View>

                {/* Notes */}
                <View style={styles.card}>
                    <Text style={styles.sliderLabel}>Notes (optional)</Text>
                    <TextInput
                        style={[styles.textInput, styles.textArea]}
                        multiline
                        placeholder="Feeling off, skipped dinner..."
                        placeholderTextColor={colors.text.muted}
                        value={notes}
                        onChangeText={setNotes}
                        maxLength={200}
                    />
                </View>

                {/* Submit */}
                <TouchableOpacity
                    style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading
                        ? <ActivityIndicator color={colors.text.dark} />
                        : <Text style={styles.submitText}>
                            {alreadyCheckedIn ? 'Update Check-In' : 'Log Readiness'}
                          </Text>
                    }
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scroll: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
    },
    backBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    title: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: typography.sizes.lg,
        color: colors.text.primary,
    },
    scoreContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    scoreRing: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glass.surface,
        marginBottom: spacing.md,
    },
    scoreNumber: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: 40,
        lineHeight: 44,
    },
    scoreSubText: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    scoreLabel: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: typography.sizes.lg,
        marginBottom: spacing.xs,
    },
    scoreMessage: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.sizes.sm,
        color: colors.text.secondary,
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
    },
    checkedInBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        marginBottom: spacing.md,
    },
    checkedInText: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.sizes.xs,
        color: colors.success,
    },
    card: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    divider: {
        height: 1,
        backgroundColor: colors.glass.border,
        marginVertical: spacing.md,
    },
    sliderBlock: {
        gap: spacing.sm,
    },
    sliderLabel: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.sm,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    scaleRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    scaleDot: {
        flex: 1,
        height: 44,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    scaleDotActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    scaleDotText: {
        fontFamily: typography.fontFamily.medium,
        fontSize: typography.sizes.sm,
        color: colors.text.secondary,
    },
    scaleDotTextActive: {
        color: colors.text.dark,
    },
    scaleHints: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    scaleHintText: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
    },
    textInput: {
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.sizes.sm,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
        paddingTop: spacing.sm,
    },
    submitBtn: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.md,
    },
    submitBtnDisabled: {
        opacity: 0.6,
    },
    submitText: {
        fontFamily: typography.fontFamily.semiBold,
        fontSize: typography.sizes.md,
        color: colors.text.dark,
    },
});

export default ReadinessCheckInScreen;
