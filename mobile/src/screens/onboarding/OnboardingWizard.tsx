import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Platform, KeyboardAvoidingView,
    ScrollView, TextInput, Dimensions, ActivityIndicator, Pressable, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, {
    FadeInDown, FadeIn, FadeInUp,
    useSharedValue, useAnimatedStyle, withRepeat,
    withTiming, withSequence, Easing,
} from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius, shadows, shadow } from '../../styles/theme';
import { nutritionAPI, workoutsAPI, healthAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { isHealthAvailable, requestPermissions, getTodaysSummary } from '../../services/healthService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Science: Mifflin-St Jeor equation ──────────────────────────────────────
function computeTDEE(weight: number, height: number, age: number, gender: string, activity: string) {
    // Mifflin-St Jeor — most accurate modern BMR formula
    const bmr = gender === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
    const multipliers: Record<string, number> = {
        sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
    };
    return { bmr: Math.round(bmr), tdee: Math.round(bmr * (multipliers[activity] || 1.55)) };
}

function computeTargetCalories(tdee: number, goal: string) {
    if (goal === 'fat_loss') return tdee - 500;
    if (goal === 'muscle_gain') return tdee + 300;
    return tdee;
}

function computeMacros(calories: number, goal: string, dietary: string) {
    let proteinPct: number, carbsPct: number, fatPct: number;
    // Macro splits tuned for Indian diets (carb-heavy: rice, roti, dal)
    if (goal === 'fat_loss') { proteinPct = 0.30; fatPct = 0.25; carbsPct = 0.45; }
    else if (goal === 'muscle_gain') { proteinPct = 0.30; carbsPct = 0.45; fatPct = 0.25; }
    else { proteinPct = 0.20; carbsPct = 0.50; fatPct = 0.30; }

    if (dietary === 'vegetarian' || dietary === 'vegan') {
        proteinPct -= 0.03;
        carbsPct += 0.03;
    }

    return {
        protein: Math.round((calories * proteinPct) / 4),
        carbs: Math.round((calories * carbsPct) / 4),
        fat: Math.round((calories * fatPct) / 9),
    };
}

function computeBMI(weight: number, height: number) {
    const h = height / 100;
    return weight / (h * h);
}

function bmiCategory(bmi: number) {
    if (bmi < 18.5) return { label: 'Underweight', color: colors.info };
    if (bmi < 25) return { label: 'Normal Weight', color: colors.success };
    if (bmi < 30) return { label: 'Overweight', color: colors.warning };
    return { label: 'Obese', color: colors.error };
}

/**
 * Onboarding is two screens, deliberately.
 *
 * It used to be six: body stats, goal, activity, blueprint, training split,
 * health connect. Only the first three collect anything the app cannot run
 * without — the blueprint is a read-only reveal, and the split and Health
 * Connect are both changeable later from Workouts and Settings respectively.
 * Four screens of that was a wall between signup and the first logged set.
 *
 * Now: stats, then goal + activity + the blueprint reveal on one screen.
 * Split and Health Connect moved out and are offered in-app afterwards.
 */
const TOTAL_STEPS = 2;

// ─── Step metadata ───────────────────────────────────────────────────────────
const STEP_META: Record<number, { icon: keyof typeof MaterialIcons.glyphMap; purpose: string }> = {
    1: { icon: 'straighten', purpose: "Let's get to know your body" },
    2: { icon: 'auto-graph', purpose: 'Your goal, and the plan that follows from it' },
    // Retained: renderStep3/4 still read STEP_META[3] and [4] for their
    // sub-section headers now that they are composed into step 2.
    3: { icon: 'directions-run', purpose: "Let's calculate your daily needs" },
    4: { icon: 'auto-graph', purpose: 'Your personalised nutrition blueprint' },
};

// ─── Animated Chip Selector ──────────────────────────────────────────────────
function ChipGroup<T extends string>({ options, value, onChange, delay = 0 }: {
    options: { id: T; label: string; icon?: string; desc?: string }[];
    value: T;
    onChange: (v: T) => void;
    delay?: number;
}) {
    return (
        <Animated.View
            entering={FadeInDown.delay(delay).duration(600).springify()}
            style={chip.grid}
        >
            {options.map((o, idx) => {
                const active = value === o.id;
                return (
                    <AnimatedPressable
                        key={o.id}
                        style={[chip.card, active && chip.cardActive]}
                        onPress={() => onChange(o.id)}
                    >
                        {o.icon && (
                            <Text style={chip.icon}>{o.icon}</Text>
                        )}
                        <Text style={[chip.label, active && chip.labelActive]}>{o.label}</Text>
                        {o.desc && <Text style={[chip.desc, active && chip.descActive]}>{o.desc}</Text>}
                    </AnimatedPressable>
                );
            })}
        </Animated.View>
    );
}

const chip = StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    card: {
        flex: 1, minWidth: '45%',
        backgroundColor: colors.glass.surface,
        borderWidth: 1, borderColor: colors.glass.border,
        borderRadius: borderRadius.lg, padding: 14, alignItems: 'center', gap: 4,
    },
    cardActive: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(255,255,255,0.08)',
        ...shadows.glowCard,
    },
    icon: { fontSize: 22, marginBottom: 2 },
    label: { fontSize: 14, fontFamily: typography.fontFamily.bold, color: colors.text.secondary, textAlign: 'center' },
    labelActive: { color: colors.text.primary },
    desc: { fontSize: 11, color: colors.text.muted, textAlign: 'center' },
    descActive: { color: colors.text.secondary },
});

// ─── Number input ─────────────────────────────────────────────────────────────
/**
 * HeightInput — cm by default, switchable to ft/in.
 *
 * The canonical value stays centimetres (that is what the backend stores and
 * what BMI/TDEE are computed from); feet and inches are a display layer that
 * converts on the way in and out. The imperial half keeps its own local ft/in
 * text so a half-typed value like 5' with an empty inches box doesn't get
 * rounded away mid-keystroke.
 */
function HeightInput({ valueCm, onChangeCm, unit, onToggleUnit }: {
    valueCm: string;
    onChangeCm: (v: string) => void;
    unit: 'cm' | 'ft';
    onToggleUnit: (u: 'cm' | 'ft') => void;
}) {
    const [ft, setFt] = useState('');
    const [inch, setInch] = useState('');

    // Keep the ft/in boxes in sync when cm changes from elsewhere (e.g. the
    // user switches units, or a value is restored), but never while they are
    // actively typing in them — that would fight the cursor.
    useEffect(() => {
        if (unit !== 'ft') return;
        const cm = parseFloat(valueCm);
        if (!cm || Number.isNaN(cm)) return;
        const totalInches = cm / 2.54;
        const f = Math.floor(totalInches / 12);
        const i = Math.round(totalInches - f * 12);
        // 11.6" rounds to 12" — carry it into the next foot instead of showing 5'12"
        const carried = i === 12 ? { f: f + 1, i: 0 } : { f, i };
        setFt(String(carried.f));
        setInch(String(carried.i));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unit]);

    const pushImperial = (nextFt: string, nextIn: string) => {
        setFt(nextFt);
        setInch(nextIn);
        const f = parseFloat(nextFt) || 0;
        const i = parseFloat(nextIn) || 0;
        if (!nextFt && !nextIn) {
            onChangeCm('');
            return;
        }
        onChangeCm(((f * 12 + i) * 2.54).toFixed(1));
    };

    return (
        <View style={num.container}>
            <View style={num.labelRow}>
                <Text style={[num.label, { marginBottom: 0 }]}>Height</Text>
                <View style={unitTog.wrap}>
                    {(['cm', 'ft'] as const).map(u => (
                        <TouchableOpacity
                            key={u}
                            onPress={() => onToggleUnit(u)}
                            style={[unitTog.btn, unit === u && unitTog.btnActive]}
                            accessibilityLabel={`Enter height in ${u === 'cm' ? 'centimetres' : 'feet and inches'}`}
                            accessibilityState={{ selected: unit === u }}
                        >
                            <Text style={[unitTog.text, unit === u && unitTog.textActive]}>
                                {u === 'cm' ? 'cm' : 'ft/in'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {unit === 'cm' ? (
                <View style={num.row}>
                    <TextInput
                        style={num.input}
                        value={valueCm}
                        onChangeText={onChangeCm}
                        keyboardType="decimal-pad"
                        placeholder="175"
                        placeholderTextColor={colors.text.subtle}
                    />
                    <Text style={num.unit}>cm</Text>
                </View>
            ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={[num.row, { flex: 1 }]}>
                        <TextInput
                            style={num.input}
                            value={ft}
                            onChangeText={v => pushImperial(v.replace(/[^0-9]/g, ''), inch)}
                            keyboardType="number-pad"
                            placeholder="5"
                            placeholderTextColor={colors.text.subtle}
                            maxLength={1}
                        />
                        <Text style={num.unit}>ft</Text>
                    </View>
                    <View style={[num.row, { flex: 1 }]}>
                        <TextInput
                            style={num.input}
                            value={inch}
                            onChangeText={v => pushImperial(ft, v.replace(/[^0-9]/g, ''))}
                            keyboardType="number-pad"
                            placeholder="9"
                            placeholderTextColor={colors.text.subtle}
                            maxLength={2}
                        />
                        <Text style={num.unit}>in</Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const unitTog = StyleSheet.create({
    wrap: {
        flexDirection: 'row',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.full,
        padding: 2,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    btn: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
    btnActive: { backgroundColor: colors.primary },
    text: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 0.5,
    },
    textActive: { color: colors.background },
});

function NumInput({ label, unit, value, onChange, placeholder }: {
    label: string; unit: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
    return (
        <View style={num.container}>
            <Text style={num.label}>{label}</Text>
            <View style={num.row}>
                <TextInput
                    style={num.input}
                    value={value}
                    onChangeText={onChange}
                    keyboardType="decimal-pad"
                    placeholder={placeholder}
                    placeholderTextColor={colors.text.subtle}
                />
                <Text style={num.unit}>{unit}</Text>
            </View>
        </View>
    );
}

const num = StyleSheet.create({
    container: { flex: 1 },
    label: {
        fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
    },
    // Height needs its label and unit toggle on one line; the toggle carries
    // its own bottom margin so both halves sit on the same baseline.
    labelRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.glass.surface, borderWidth: 1,
        borderColor: colors.glass.border, borderRadius: borderRadius.md, paddingHorizontal: 14,
    },
    input: {
        flex: 1, height: 52, color: colors.text.primary,
        fontSize: 20, fontFamily: typography.fontFamily.bold,
    },
    unit: { color: colors.text.muted, fontSize: 14, fontFamily: typography.fontFamily.medium },
});

// ─── Macro bar ────────────────────────────────────────────────────────────────
function MacroBar({ label, g, cal, color, pct }: { label: string; g: number; cal: number; color: string; pct: number }) {
    return (
        <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.bold, fontSize: 14 }}>{label}</Text>
                <Text style={{ color: colors.text.muted, fontSize: 13 }}>{g}g  {cal} kcal</Text>
            </View>
            <View style={{ height: 6, backgroundColor: colors.glass.surfaceHover, borderRadius: 4 }}>
                <Animated.View
                    entering={FadeIn.delay(200).duration(800)}
                    style={{ height: 6, width: `${Math.min(pct, 100)}%`, backgroundColor: color, borderRadius: 4 }}
                />
            </View>
        </View>
    );
}

// ─── Pulsing badge ────────────────────────────────────────────────────────────
function PulsingBadge({ text }: { text: string }) {
    const pulse = useSharedValue(1);

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
                withTiming(1.0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            true
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }],
    }));

    return (
        <Animated.View style={[s.suggestedBadge, animStyle]}>
            <Text style={s.suggestedText}>{text}</Text>
        </Animated.View>
    );
}

// ─── Calorie Adjuster (+/- buttons) ──────────────────────────────────────────
function CalorieAdjuster({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <View style={adjuster.row}>
            <TouchableOpacity
                style={adjuster.btn}
                onPress={() => onChange(Math.max(value - 50, 800))}
                activeOpacity={0.7}
            >
                <MaterialIcons name="remove" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={adjuster.center}>
                <Text style={adjuster.val}>{value}</Text>
                <Text style={adjuster.unit}>kcal / day</Text>
            </View>
            <TouchableOpacity
                style={adjuster.btn}
                onPress={() => onChange(value + 50)}
                activeOpacity={0.7}
            >
                <MaterialIcons name="add" size={20} color={colors.text.primary} />
            </TouchableOpacity>
        </View>
    );
}

const adjuster = StyleSheet.create({
    row: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
    },
    btn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.glass.surfaceHover, borderWidth: 1,
        borderColor: colors.glass.borderLight,
        alignItems: 'center', justifyContent: 'center',
    },
    center: { alignItems: 'center', minWidth: 120 },
    val: {
        fontSize: 42, fontFamily: typography.fontFamily.bold,
        color: colors.text.primary, lineHeight: 50,
    },
    unit: { fontSize: 13, color: colors.text.muted, marginTop: 2 },
});

// ─── Macro Slider ─────────────────────────────────────────────────────────────
function MacroSlider({ label, grams, color, onIncrease, onDecrease }: {
    label: string; grams: number; color: string;
    onIncrease: () => void; onDecrease: () => void;
}) {
    return (
        <View style={macroSlider.row}>
            <View style={[macroSlider.dot, { backgroundColor: color }]} />
            <Text style={macroSlider.label}>{label}</Text>
            <View style={macroSlider.controls}>
                <TouchableOpacity onPress={onDecrease} style={macroSlider.miniBtn}>
                    <MaterialIcons name="remove" size={14} color={colors.text.muted} />
                </TouchableOpacity>
                <Text style={macroSlider.value}>{grams}g</Text>
                <TouchableOpacity onPress={onIncrease} style={macroSlider.miniBtn}>
                    <MaterialIcons name="add" size={14} color={colors.text.muted} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const macroSlider = StyleSheet.create({
    row: {
        flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
        borderBottomWidth: 1, borderBottomColor: colors.glass.border,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    label: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.medium, color: colors.text.secondary },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    miniBtn: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: colors.glass.surfaceHover, borderWidth: 1,
        borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
    },
    value: { fontSize: 14, fontFamily: typography.fontFamily.bold, color: colors.text.primary, minWidth: 40, textAlign: 'center' },
});

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function OnboardingWizard() {
    const toast = useToast();
    const { completeOnboarding } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    // Blueprint customization state
    const [calorieOffset, setCalorieOffset] = useState(0);
    const [showMacroCustomize, setShowMacroCustomize] = useState(false);
    const [macroOverride, setMacroOverride] = useState<{ protein: number; carbs: number; fat: number } | null>(null);

    const [form, setForm] = useState({
        height_cm: '',
        weight_kg: '',
        age: '',
        gender: 'male' as 'male' | 'female',
        body_fat_pct: '',
        goal_type: 'maintenance' as 'fat_loss' | 'maintenance' | 'muscle_gain',
        activity_level: 'moderate' as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
        experience: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
        dietary: 'everything' as 'everything' | 'vegetarian' | 'vegan',
        split_id: 'custom' as string,
    });

    const set = useCallback((k: string, v: any) => setForm(p => ({ ...p, [k]: v })), []);

    // Metric by default (India-first), but switchable. height_cm stays the
    // single source of truth regardless of what's on screen.
    const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');

    // ── Health Connect state ─────────────────────────────────────
    const [healthAvailable, setHealthAvailable] = useState(false);
    const [healthConnected, setHealthConnected] = useState(false);
    const [healthSyncing, setHealthSyncing] = useState(false);

    useEffect(() => {
        setHealthAvailable(isHealthAvailable());
    }, []);

    // ── Memoized derived values ──────────────────────────────────
    const w = parseFloat(form.weight_kg);
    const h = parseFloat(form.height_cm);
    const a = parseFloat(form.age);
    const hasBody = !!w && !!h && !!a;

    const { bmr, tdee } = useMemo(() => {
        if (!hasBody) return { bmr: 0, tdee: 0 };
        return computeTDEE(w, h, a, form.gender, form.activity_level);
    }, [w, h, a, form.gender, form.activity_level, hasBody]);

    const baseTargetCal = useMemo(() => {
        if (!hasBody) return 0;
        return computeTargetCalories(tdee, form.goal_type);
    }, [tdee, form.goal_type, hasBody]);

    const targetCal = baseTargetCal + calorieOffset;

    const baseMacros = useMemo(() => {
        if (!hasBody) return { protein: 0, carbs: 0, fat: 0 };
        return computeMacros(targetCal, form.goal_type, form.dietary);
    }, [targetCal, form.goal_type, form.dietary, hasBody]);

    const macros = macroOverride || baseMacros;

    const { bmi, bmiCat } = useMemo(() => {
        if (!hasBody) return { bmi: 0, bmiCat: bmiCategory(0) };
        const bmiVal = computeBMI(w, h);
        return { bmi: bmiVal, bmiCat: bmiCategory(bmiVal) };
    }, [w, h, hasBody]);

    // Mini calorie estimate for after step 2
    const miniEstimate = useMemo(() => {
        if (!hasBody) return null;
        const cal = computeTargetCalories(tdee, form.goal_type);
        return cal;
    }, [hasBody, tdee, form.goal_type]);

    // Reset macro override when base changes
    useEffect(() => {
        setMacroOverride(null);
    }, [baseTargetCal, form.goal_type, form.dietary]);

    // Reset calorie offset when goal changes
    useEffect(() => {
        setCalorieOffset(0);
    }, [form.goal_type]);

    // ── Progress bar glow animation ──────────────────────────────
    const progressGlow = useSharedValue(0.3);
    useEffect(() => {
        progressGlow.value = withRepeat(
            withSequence(
                withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
            ),
            -1, true
        );
    }, []);

    // Android ignores `shadowOpacity` entirely (see styles/theme.ts), so
    // animating it there is a silent no-op. Drive the whole shadow via an
    // animated `boxShadow` string on Android instead; iOS keeps the cheaper
    // native shadowOpacity path it already renders correctly.
    const progressGlowStyle = useAnimatedStyle(() =>
        Platform.OS === 'ios'
            ? { shadowOpacity: progressGlow.value }
            : { boxShadow: `0px 0px 16px rgba(255, 255, 255, ${progressGlow.value})` }
    );

    // ── Navigation ───────────────────────────────────────────────
    const nextStep = useCallback(() => {
        if (step === 1 && (!form.height_cm || !form.weight_kg || !form.age)) {
            toast.error('Missing Info', 'Please fill in height, weight, and age');
            return;
        }
        setStep(s => Math.min(s + 1, TOTAL_STEPS));
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [step, form.height_cm, form.weight_kg, form.age, toast]);

    const prevStep = useCallback(() => {
        setStep(s => Math.max(s - 1, 1));
        scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []);

    const handleComplete = async () => {
        setLoading(true);
        try {
            await nutritionAPI.updateProfile({
                weight_kg: w,
                height_cm: h,
                age: a,
                gender: form.gender,
                goal_type: form.goal_type,
                activity_level: form.activity_level,
                body_fat_pct: form.body_fat_pct ? parseFloat(form.body_fat_pct) : undefined,
                is_vegetarian: form.dietary !== 'everything',
                target_calories: targetCal,
                target_protein: macros.protein,
                target_carbs: macros.carbs,
                target_fat: macros.fat,
            } as any);

            if (form.split_id) {
                try {
                    if (form.split_id === 'full_body') {
                        await workoutsAPI.saveSplit({
                            split_id: 'full_body',
                            name: 'Full Body 3-Day',
                            days: ['Full Body A', 'Full Body B', 'Full Body C'],
                            days_per_week: 3,
                        });
                    } else if (form.split_id === 'upper_lower') {
                        await workoutsAPI.saveSplit({
                            split_id: 'upper_lower',
                            name: 'Upper / Lower 4-Day',
                            days: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
                            days_per_week: 4,
                        });
                    } else if (form.split_id === 'ppl') {
                        await workoutsAPI.saveSplit({
                            split_id: 'ppl',
                            name: 'Push / Pull / Legs',
                            days: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
                            days_per_week: 6,
                        });
                    } else {
                        await workoutsAPI.saveSplit({
                            split_id: 'custom',
                            name: 'Push / Pull / Legs Custom',
                            days: ['Push', 'Pull', 'Legs'],
                            days_per_week: 3,
                        });
                    }
                } catch { }
            }

            completeOnboarding();
            toast.success('Welcome to Fitzo!', 'Your plan is ready.');
            setTimeout(() => router.replace('/(tabs)'), 400);
        } catch (err: any) {
            toast.error('Error', err?.message || 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Body Stats
    // ─────────────────────────────────────────────────────────────
    const renderStep1 = () => (
        <View style={s.stepWrap}>
            <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={s.stepHeader}>
                <View style={s.stepIconWrap}>
                    <MaterialIcons name="straighten" size={28} color={colors.text.primary} />
                </View>
                <Text style={s.title}>Your Body Stats</Text>
                <Text style={s.purpose}>{STEP_META[1].purpose}</Text>
                <Text style={s.subtitle}>
                    We use these to calculate your calorie targets using the Mifflin-St Jeor equation -- the gold standard in sports nutrition.
                </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(600).springify()}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <HeightInput
                        valueCm={form.height_cm}
                        onChangeCm={v => set('height_cm', v)}
                        unit={heightUnit}
                        onToggleUnit={setHeightUnit}
                    />
                    <NumInput label="Weight" unit="kg" value={form.weight_kg} onChange={v => set('weight_kg', v)} placeholder="70" />
                </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(600).springify()}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <NumInput label="Age" unit="yrs" value={form.age} onChange={v => set('age', v)} placeholder="25" />
                    <NumInput label="Body Fat" unit="%" value={form.body_fat_pct} onChange={v => set('body_fat_pct', v)} placeholder="Optional" />
                </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400).duration(600).springify()}>
                <Text style={[s.sectionLabel, { marginTop: 4 }]}>Biological Sex</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    {(['male', 'female'] as const).map(g => {
                        const active = form.gender === g;
                        return (
                            <TouchableOpacity
                                key={g}
                                style={[s.genderBtn, active && s.genderBtnActive]}
                                onPress={() => set('gender', g)}
                            >
                                <MaterialIcons
                                    name={g === 'male' ? 'male' : 'female'}
                                    size={20}
                                    color={active ? colors.text.primary : colors.text.muted}
                                />
                                <Text style={[s.genderText, active && { color: colors.text.primary }]}>
                                    {g.charAt(0).toUpperCase() + g.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Animated.View>

            {/* Live BMI preview */}
            {hasBody && (
                <Animated.View entering={FadeInDown.delay(100).duration(500).springify()} style={s.previewBox}>
                    <View style={s.previewRow}>
                        <Text style={s.previewLabel}>BMI</Text>
                        <Text style={[s.previewVal, { color: bmiCat.color }]}>{bmi.toFixed(1)}  {bmiCat.label}</Text>
                    </View>
                    <View style={s.previewRow}>
                        <Text style={s.previewLabel}>Est. Maintenance</Text>
                        <Text style={s.previewVal}>{tdee} kcal</Text>
                    </View>

                    {/* Scientific Citations & Medical Disclaimer (Guideline 1.4.1) */}
                    <View style={s.citationBox}>
                        <Text style={s.citationTitle}>SOURCES & MEDICAL DISCLAIMER</Text>
                        <Text style={s.citationText}>
                            • BMI categories:{' '}
                            <Text
                                style={s.citationLink}
                                onPress={() => Linking.openURL('https://www.who.int/data/gho/data/themes/topics/topic-details/GHO/body-mass-index')}
                            >
                                World Health Organization (WHO)
                            </Text>
                        </Text>
                        <Text style={s.citationText}>
                            • Calorie calculations:{' '}
                            <Text
                                style={s.citationLink}
                                onPress={() => Linking.openURL('https://pubmed.ncbi.nlm.nih.gov/2305711/')}
                            >
                                Mifflin-St Jeor Equation (Mifflin et al., 1990)
                            </Text>
                        </Text>
                        <Text style={s.disclaimerText}>
                            Fitzo calculations are for informational/fitness tracking only and do not provide medical diagnosis or advice. Always consult a physician before starting any diet or training program.
                        </Text>
                    </View>
                </Animated.View>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Goal
    // ─────────────────────────────────────────────────────────────
    const renderStep2 = () => (
        <View style={s.stepWrap}>
            <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={s.stepHeader}>
                <View style={s.stepIconWrap}>
                    <MaterialIcons name="flag" size={28} color={colors.text.primary} />
                </View>
                <Text style={s.title}>What's Your Goal?</Text>
                <Text style={s.purpose}>{STEP_META[2].purpose}</Text>
                <Text style={s.subtitle}>This adjusts your calorie surplus or deficit and optimises your macro split.</Text>
            </Animated.View>

            <ChipGroup<'fat_loss' | 'maintenance' | 'muscle_gain'>
                value={form.goal_type}
                onChange={v => set('goal_type', v)}
                delay={200}
                options={[
                    { id: 'fat_loss', label: 'Lose Fat', icon: '🔥', desc: '−500 kcal/day' },
                    { id: 'maintenance', label: 'Maintain', icon: '⚖️', desc: 'TDEE calories' },
                    { id: 'muscle_gain', label: 'Build Muscle', icon: '💪', desc: '+300 kcal/day' },
                ]}
            />

            <Animated.View entering={FadeInDown.delay(300).duration(600).springify()}>
                <Text style={s.sectionLabel}>Experience Level</Text>
            </Animated.View>
            <ChipGroup<'beginner' | 'intermediate' | 'advanced'>
                value={form.experience}
                onChange={v => set('experience', v)}
                delay={350}
                options={[
                    { id: 'beginner', label: 'Beginner', icon: '🌱', desc: '< 1 year' },
                    { id: 'intermediate', label: 'Intermediate', icon: '🏋️', desc: '1-3 years' },
                    { id: 'advanced', label: 'Advanced', icon: '🏆', desc: '3+ years' },
                ]}
            />

            <Animated.View entering={FadeInDown.delay(400).duration(600).springify()}>
                <Text style={s.sectionLabel}>Dietary Preference</Text>
            </Animated.View>
            <ChipGroup<'everything' | 'vegetarian' | 'vegan'>
                value={form.dietary}
                onChange={v => set('dietary', v)}
                delay={450}
                options={[
                    { id: 'everything', label: 'Everything', icon: '🍗' },
                    { id: 'vegetarian', label: 'Vegetarian', icon: '🥚' },
                    { id: 'vegan', label: 'Vegan', icon: '🌿' },
                ]}
            />

            {/* Mini calorie preview after filling goal */}
            {miniEstimate && (
                <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={s.miniPreview}>
                    <MaterialIcons name="bolt" size={18} color={colors.text.primary} />
                    <Text style={s.miniPreviewText}>
                        Estimated daily target:{' '}
                        <Text style={{ fontFamily: typography.fontFamily.bold, color: colors.text.primary }}>
                            {miniEstimate} kcal
                        </Text>
                    </Text>
                </Animated.View>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Activity Level
    // ─────────────────────────────────────────────────────────────
    const activityOptions = useMemo(() => [
        { id: 'sedentary', label: 'Sedentary', icon: 'weekend' as keyof typeof MaterialIcons.glyphMap, desc: 'Desk job, little to no exercise' },
        { id: 'light', label: 'Lightly Active', icon: 'directions-walk' as keyof typeof MaterialIcons.glyphMap, desc: 'Light exercise 1-3x/week' },
        { id: 'moderate', label: 'Moderately Active', icon: 'directions-bike' as keyof typeof MaterialIcons.glyphMap, desc: 'Exercise 3-5x/week' },
        { id: 'active', label: 'Very Active', icon: 'fitness-center' as keyof typeof MaterialIcons.glyphMap, desc: 'Hard exercise 6-7x/week' },
        { id: 'very_active', label: 'Athlete / Manual Labor', icon: 'flash-on' as keyof typeof MaterialIcons.glyphMap, desc: 'Training twice a day or physical job' },
    ], []);

    const renderStep3 = () => (
        <View style={s.stepWrap}>
            <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={s.stepHeader}>
                <View style={s.stepIconWrap}>
                    <MaterialIcons name="directions-run" size={28} color={colors.text.primary} />
                </View>
                <Text style={s.title}>How Active Are You?</Text>
                <Text style={s.purpose}>{STEP_META[3].purpose}</Text>
                <Text style={s.subtitle}>Be honest -- overestimating activity is the most common reason calorie targets don't work.</Text>
            </Animated.View>

            {activityOptions.map((o, idx) => {
                const active = form.activity_level === o.id;
                return (
                    <Animated.View
                        key={o.id}
                        entering={FadeInDown.delay(200 + idx * 80).duration(600).springify()}
                    >
                        <TouchableOpacity
                            style={[s.activityCard, active && s.activityCardActive]}
                            onPress={() => set('activity_level', o.id)}
                            activeOpacity={0.8}
                        >
                            <View style={[s.activityIconWrap, active && s.activityIconWrapActive]}>
                                <MaterialIcons
                                    name={o.icon}
                                    size={20}
                                    color={active ? colors.text.primary : colors.text.muted}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.activityLabel, active && { color: colors.text.primary }]}>{o.label}</Text>
                                <Text style={s.activityDesc}>{o.desc}</Text>
                            </View>
                            {active && <MaterialIcons name="check-circle" size={20} color={colors.text.primary} />}
                        </TouchableOpacity>
                    </Animated.View>
                );
            })}

            {/* Live TDEE estimate */}
            {hasBody && (
                <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={s.miniPreview}>
                    <MaterialIcons name="local-fire-department" size={18} color={colors.warning} />
                    <Text style={s.miniPreviewText}>
                        TDEE with this level:{' '}
                        <Text style={{ fontFamily: typography.fontFamily.bold, color: colors.text.primary }}>
                            {tdee} kcal
                        </Text>
                    </Text>
                </Animated.View>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Your Blueprint (Results)
    // ─────────────────────────────────────────────────────────────
    const { proteinPct, carbsPct, fatPct } = useMemo(() => {
        if (!targetCal) return { proteinPct: 0, carbsPct: 0, fatPct: 0 };
        return {
            proteinPct: Math.round((macros.protein * 4 / targetCal) * 100),
            carbsPct: Math.round((macros.carbs * 4 / targetCal) * 100),
            fatPct: Math.round((macros.fat * 9 / targetCal) * 100),
        };
    }, [macros, targetCal]);

    const handleCalorieChange = useCallback((newVal: number) => {
        setCalorieOffset(newVal - baseTargetCal);
    }, [baseTargetCal]);

    const handleMacroAdjust = useCallback((macro: 'protein' | 'carbs' | 'fat', delta: number) => {
        const current = { ...(macroOverride || baseMacros) };
        const newVal = Math.max(0, current[macro] + delta);
        const actualDelta = newVal - current[macro];
        current[macro] = newVal;

        // Redistribute calorie difference to the other two macros
        const calPerG: Record<string, number> = { protein: 4, carbs: 4, fat: 9 };
        const calDiff = actualDelta * calPerG[macro]; // calories added/removed
        const others = (['protein', 'carbs', 'fat'] as const).filter(m => m !== macro);

        // Split the calorie difference equally between the other two
        const halfCal = calDiff / 2;
        for (const other of others) {
            const gDelta = Math.round(halfCal / calPerG[other]);
            current[other] = Math.max(0, current[other] - gDelta);
        }

        setMacroOverride(current);
    }, [macroOverride, baseMacros]);

    const renderStep4 = () => (
        <View style={s.stepWrap}>
            <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={s.stepHeader}>
                <View style={s.stepIconWrap}>
                    <MaterialIcons name="auto-graph" size={28} color={colors.text.primary} />
                </View>
                <Text style={s.title}>Your Blueprint</Text>
                <Text style={s.purpose}>{STEP_META[4].purpose}</Text>
                <Text style={s.subtitle}>Calculated using the Mifflin-St Jeor equation, adjusted for your goal.</Text>
            </Animated.View>

            {/* Editable calorie target */}
            <Animated.View entering={FadeInDown.delay(200).duration(600).springify()}>
                <View style={s.calCard}>
                    <LinearGradient
                        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    />
                    <Text style={s.calLabel}>Daily Calorie Target</Text>
                    <CalorieAdjuster value={targetCal} onChange={handleCalorieChange} />
                    {calorieOffset !== 0 && (
                        <Text style={s.calOffsetHint}>
                            {calorieOffset > 0 ? '+' : ''}{calorieOffset} from recommended ({baseTargetCal})
                        </Text>
                    )}
                    <View style={s.calStatsRow}>
                        <View style={s.calStatBox}>
                            <Text style={s.calStatLabel}>TDEE</Text>
                            <Text style={s.calStatVal}>{tdee}</Text>
                        </View>
                        <View style={s.calStatDivider} />
                        <View style={s.calStatBox}>
                            <Text style={s.calStatLabel}>BMR</Text>
                            <Text style={s.calStatVal}>{bmr}</Text>
                        </View>
                        <View style={s.calStatDivider} />
                        <View style={s.calStatBox}>
                            <Text style={s.calStatLabel}>BMI</Text>
                            <Text style={[s.calStatVal, { color: bmiCat.color }]}>{bmi.toFixed(1)}</Text>
                        </View>
                        <View style={s.calStatDivider} />
                        <View style={s.calStatBox}>
                            <Text style={s.calStatLabel}>Goal</Text>
                            <Text style={s.calStatVal}>
                                {form.goal_type === 'fat_loss' ? '-0.5kg/wk' : form.goal_type === 'muscle_gain' ? '+0.3kg/wk' : 'Maintain'}
                            </Text>
                        </View>
                    </View>
                </View>
            </Animated.View>

            {/* Macro breakdown */}
            <Animated.View entering={FadeInDown.delay(350).duration(600).springify()}>
                <Text style={s.sectionLabel}>Macro Targets</Text>
                <View style={s.macroCard}>
                    <MacroBar label="Protein" g={macros.protein} cal={macros.protein * 4} color={colors.macro.protein} pct={proteinPct} />
                    <MacroBar label="Carbs" g={macros.carbs} cal={macros.carbs * 4} color={colors.macro.carbs} pct={carbsPct} />
                    <MacroBar label="Fat" g={macros.fat} cal={macros.fat * 9} color={colors.macro.fat} pct={fatPct} />
                </View>
            </Animated.View>

            {/* Customize macros link */}
            <Animated.View entering={FadeInDown.delay(450).duration(600).springify()}>
                <TouchableOpacity
                    style={s.customizeLink}
                    onPress={() => setShowMacroCustomize(!showMacroCustomize)}
                    activeOpacity={0.7}
                >
                    <MaterialIcons
                        name={showMacroCustomize ? 'expand-less' : 'tune'}
                        size={16}
                        color={colors.text.secondary}
                    />
                    <Text style={s.customizeLinkText}>
                        {showMacroCustomize ? 'Hide customization' : 'Customize macros'}
                    </Text>
                </TouchableOpacity>
            </Animated.View>

            {showMacroCustomize && (
                <Animated.View entering={FadeInDown.delay(50).duration(400).springify()} style={s.macroCustomCard}>
                    <MacroSlider
                        label="Protein"
                        grams={macros.protein}
                        color={colors.macro.protein}
                        onIncrease={() => handleMacroAdjust('protein', 5)}
                        onDecrease={() => handleMacroAdjust('protein', -5)}
                    />
                    <MacroSlider
                        label="Carbs"
                        grams={macros.carbs}
                        color={colors.macro.carbs}
                        onIncrease={() => handleMacroAdjust('carbs', 5)}
                        onDecrease={() => handleMacroAdjust('carbs', -5)}
                    />
                    <MacroSlider
                        label="Fat"
                        grams={macros.fat}
                        color={colors.macro.fat}
                        onIncrease={() => handleMacroAdjust('fat', 5)}
                        onDecrease={() => handleMacroAdjust('fat', -5)}
                    />
                    <Text style={s.macroCalTotal}>
                        Total: {macros.protein * 4 + macros.carbs * 4 + macros.fat * 9} kcal
                    </Text>
                    {macroOverride && (
                        <TouchableOpacity
                            onPress={() => setMacroOverride(null)}
                            style={s.resetLink}
                        >
                            <Text style={s.resetLinkText}>Reset to recommended</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(500).duration(600).springify()}>
                <View style={s.infoBox}>
                    <MaterialIcons name="lightbulb-outline" size={16} color={colors.text.muted} style={{ marginTop: 1 }} />
                    <Text style={s.infoText}>
                        {form.dietary !== 'everything'
                            ? 'Your protein targets are achievable through plant-based sources. Focus on legumes, tofu, and seeds. '
                            : 'Protein is set high to preserve muscle during your goal. '}
                        You can fine-tune these targets anytime in your profile.
                    </Text>
                </View>
            </Animated.View>
        </View>
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 5: Training Split
    // ─────────────────────────────────────────────────────────────
    const suggested = useMemo(() =>
        form.experience === 'beginner' ? 'full_body'
            : form.experience === 'intermediate' ? 'upper_lower' : 'ppl'
    , [form.experience]);

    const splits = useMemo(() => [
        {
            id: 'full_body', name: 'Full Body', days: '3 days/week', level: 'Beginner', icon: 'accessibility-new' as keyof typeof MaterialIcons.glyphMap,
            desc: 'Hit every muscle 3x/week for maximum stimulus.',
            preview: ['Mon: Full Body A', 'Wed: Full Body B', 'Fri: Full Body C'],
        },
        {
            id: 'upper_lower', name: 'Upper / Lower', days: '4 days/week', level: 'Intermediate', icon: 'fitness-center' as keyof typeof MaterialIcons.glyphMap,
            desc: 'Balanced split with good frequency and volume.',
            preview: ['Mon: Upper', 'Tue: Lower', 'Thu: Upper', 'Fri: Lower'],
        },
        {
            id: 'ppl', name: 'Push / Pull / Legs', days: '6 days/week', level: 'Advanced', icon: 'flash-on' as keyof typeof MaterialIcons.glyphMap,
            desc: 'High volume for experienced lifters.',
            preview: ['Mon: Push', 'Tue: Pull', 'Wed: Legs', 'Thu: Push', 'Fri: Pull', 'Sat: Legs'],
        },
        {
            id: 'custom', name: 'Custom / Decide Later', days: 'Flexible', level: 'Any', icon: 'edit-calendar' as keyof typeof MaterialIcons.glyphMap,
            desc: 'Pick a plan from the library after setup.',
            preview: [],
        },
    ], []);

    // Training split (old step 5) and Health Connect (old step 6) were removed
    // from onboarding. Both are set later: split via Workouts -> Today's
    // Training, Health Connect via Settings -> Health.
    //
    // handleConnectHealth is kept below: the Health Connect prompt shown after
    // onboarding reuses it.
    const handleConnectHealth = async () => {
        setHealthSyncing(true);
        try {
            const granted = await requestPermissions();
            if (granted) {
                setHealthConnected(true);
                // Sync initial data
                const summary = await getTodaysSummary();
                await healthAPI.sync({
                    steps: summary.steps,
                    active_calories: summary.activeCalories,
                    resting_heart_rate: summary.restingHeartRate,
                    sleep_hours: summary.sleepHours,
                    source: 'wearable',
                });
                toast.success('Connected!', 'Health data synced successfully');
            } else {
                toast.error('Permission Denied', 'Please allow health access in your device settings');
            }
        } catch {
            toast.error('Error', 'Could not connect to health services');
        } finally {
            setHealthSyncing(false);
        }
    };


    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    const progressPct = (step / TOTAL_STEPS) * 100;

    return (
        <SafeAreaView style={s.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
            {/* Premium progress bar with glow */}
            <View style={s.progressArea}>
                <View style={s.progressHeader}>
                    {step > 1 && (
                        <TouchableOpacity onPress={prevStep} style={s.progressBackBtn} activeOpacity={0.7}>
                            <MaterialIcons name="arrow-back-ios" size={16} color={colors.text.muted} />
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }} />
                    <Text style={s.stepCount}>Step {step} of {TOTAL_STEPS}</Text>
                </View>
                <View style={s.progressTrack}>
                    <Animated.View
                        style={[
                            s.progressFill,
                            { width: `${progressPct}%` },
                            progressGlowStyle,
                        ]}
                    />
                </View>
            </View>

            <ScrollView
                ref={scrollRef}
                contentContainerStyle={s.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {step === 1 && renderStep1()}
                {/* Step 2 composes what used to be three separate screens:
                    goal, activity level, and the calculated blueprint. They
                    are stacked in one scroll so the numbers update live as
                    the user picks, instead of hiding the payoff two taps away. */}
                {step === 2 && (
                    <>
                        {renderStep2()}
                        {renderStep3()}
                        {renderStep4()}
                    </>
                )}
            </ScrollView>

            {/* Sticky bottom button with glow */}
            <Animated.View
                entering={FadeInUp.delay(300).duration(500).springify()}
                style={s.footer}
            >
                <LinearGradient
                    colors={['transparent', colors.background, colors.background]}
                    style={s.footerGradient}
                    pointerEvents="none"
                />
                <View style={s.footerContent}>
                    <TouchableOpacity
                        style={[s.nextBtn, loading && { opacity: 0.6 }]}
                        onPress={step === TOTAL_STEPS ? handleComplete : nextStep}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['rgba(255,255,255,1)', 'rgba(220,220,220,1)']}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                        />
                        {loading
                            ? <ActivityIndicator color={colors.text.dark} size="small" />
                            : (
                                <View style={s.nextBtnInner}>
                                    <Text style={s.nextText}>
                                        {step === TOTAL_STEPS ? 'Start Training' : 'Continue'}
                                    </Text>
                                    {step < TOTAL_STEPS && <MaterialIcons name="arrow-forward" size={18} color={colors.text.dark} />}
                                </View>
                            )
                        }
                    </TouchableOpacity>
                </View>
            </Animated.View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // ── Progress area ────────────────────────────────────────────
    progressArea: {
        paddingHorizontal: spacing['2xl'],
        paddingTop: spacing.lg,
    },
    progressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    progressBackBtn: {
        padding: spacing.xs,
    },
    stepCount: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
        letterSpacing: 0.5,
    },
    progressTrack: {
        height: 2,
        backgroundColor: colors.glass.border,
        borderRadius: 1,
        overflow: 'hidden',
    },
    progressFill: {
        height: 2,
        backgroundColor: colors.primary,
        borderRadius: 1,
        // Was: shadowRadius 8 + elevation 4 with no shadowOpacity — that is a
        // no-op on iOS (opacity defaults to 0) but drew a white Material halo
        // on Android. Now identical on both.
        ...shadow({ blur: 8, color: colors.primary, opacity: 0.5 }),
    },

    // ── Scroll / layout ──────────────────────────────────────────
    scroll: { padding: spacing['2xl'], paddingBottom: 140 },
    stepWrap: { gap: spacing.lg },

    // ── Step header ──────────────────────────────────────────────
    stepHeader: { gap: spacing.sm, marginBottom: spacing.sm },
    stepIconWrap: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.xs,
    },
    title: {
        fontSize: 30,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: -0.5,
        lineHeight: 36,
    },
    purpose: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    subtitle: {
        fontSize: typography.sizes.md,
        color: colors.text.muted,
        lineHeight: 21,
    },
    sectionLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: spacing.sm,
    },

    // ── Gender ───────────────────────────────────────────────────
    genderBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        padding: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1,
        borderColor: colors.glass.border, backgroundColor: colors.glass.surface,
    },
    genderBtnActive: {
        borderColor: colors.glass.borderHover,
        backgroundColor: colors.glass.surfaceHover,
        ...shadows.glowCard,
    },
    genderText: {
        fontSize: 15, fontFamily: typography.fontFamily.bold, color: colors.text.secondary,
    },

    // ── Live preview ─────────────────────────────────────────────
    previewBox: {
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.md,
        borderWidth: 1, borderColor: colors.glass.borderLight,
        padding: spacing.lg, gap: spacing.sm, marginTop: spacing.xs,
    },
    previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
    previewLabel: { fontSize: 13, color: colors.text.muted },
    previewVal: { fontSize: 13, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
    citationBox: {
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        gap: 4,
    },
    citationTitle: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    citationText: {
        fontSize: 11,
        color: colors.text.muted,
        lineHeight: 16,
    },
    citationLink: {
        color: colors.primary,
        textDecorationLine: 'underline',
        fontFamily: typography.fontFamily.medium,
    },
    disclaimerText: {
        fontSize: 10,
        color: colors.text.muted,
        fontStyle: 'italic',
        lineHeight: 14,
        marginTop: 4,
    },

    // ── Mini preview ─────────────────────────────────────────────
    miniPreview: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.md, borderWidth: 1,
        borderColor: colors.glass.borderLight,
        padding: spacing.md, marginTop: spacing.xs,
    },
    miniPreviewText: {
        fontSize: 13, color: colors.text.muted, flex: 1,
    },

    // ── Activity ─────────────────────────────────────────────────
    activityCard: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg,
        borderRadius: borderRadius.md, borderWidth: 1,
        borderColor: colors.glass.border,
        backgroundColor: colors.glass.surface,
    },
    activityCardActive: {
        borderColor: colors.glass.borderHover,
        backgroundColor: colors.glass.surfaceHover,
        ...shadows.glowCard,
    },
    activityIconWrap: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.glass.surface,
        borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
    },
    activityIconWrapActive: {
        backgroundColor: colors.glass.surfaceHover,
        borderColor: colors.glass.borderLight,
    },
    activityLabel: {
        fontSize: 14, fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary, marginBottom: 2,
    },
    activityDesc: { fontSize: 12, color: colors.text.muted },

    // ── Blueprint ────────────────────────────────────────────────
    calCard: {
        borderRadius: borderRadius.xl,
        borderWidth: 1, borderColor: colors.glass.borderLight,
        padding: spacing.xl, gap: spacing.md, overflow: 'hidden',
        alignItems: 'center',
    },
    calLabel: {
        fontSize: typography.sizes.xs, color: colors.text.muted,
        textTransform: 'uppercase', letterSpacing: 1.5,
        fontFamily: typography.fontFamily.semiBold,
    },
    calOffsetHint: {
        fontSize: typography.sizes.xs, color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
    },
    calStatsRow: {
        flexDirection: 'row', alignItems: 'center',
        width: '100%', marginTop: 4,
    },
    calStatBox: { flex: 1, alignItems: 'center', gap: 2 },
    calStatDivider: { width: 1, height: 28, backgroundColor: colors.glass.border },
    calStatLabel: {
        fontSize: 10, color: colors.text.muted,
        fontFamily: typography.fontFamily.semiBold,
        textTransform: 'uppercase', letterSpacing: 0.5,
    },
    calStatVal: { fontSize: 13, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
    macroCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg, borderWidth: 1,
        borderColor: colors.glass.border, padding: spacing.lg,
    },
    macroCustomCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg, borderWidth: 1,
        borderColor: colors.glass.border, padding: spacing.lg,
    },
    customizeLink: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'center', paddingVertical: 4,
    },
    customizeLinkText: {
        fontSize: 13, color: colors.text.secondary,
        fontFamily: typography.fontFamily.medium,
    },
    macroCalTotal: { fontSize: 12, color: colors.text.muted, textAlign: 'center' as const, marginTop: 8, fontFamily: typography.fontFamily.medium },
    resetLink: { alignSelf: 'center', paddingTop: 10 },
    resetLinkText: {
        fontSize: 12, color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
        textDecorationLine: 'underline',
    },
    infoBox: {
        flexDirection: 'row', gap: 10,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.md, padding: spacing.md,
        borderWidth: 1, borderColor: colors.glass.border,
    },
    infoText: { flex: 1, fontSize: 13, color: colors.text.muted, lineHeight: 19 },

    // ── Split ────────────────────────────────────────────────────
    splitCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg,
        borderRadius: borderRadius.lg, borderWidth: 1,
        borderColor: colors.glass.border,
        backgroundColor: colors.glass.surface,
    },
    splitCardActive: {
        borderColor: colors.glass.borderHover,
        backgroundColor: colors.glass.surfaceHover,
        ...shadows.glowCard,
    },
    splitIconWrap: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.glass.surface,
        borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
        marginTop: 2,
    },
    splitIconWrapActive: {
        backgroundColor: colors.glass.surfaceHover,
        borderColor: colors.glass.borderLight,
    },
    splitName: { fontSize: 15, fontFamily: typography.fontFamily.bold, color: colors.text.secondary },
    splitMeta: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
    splitDesc: { fontSize: 12, color: colors.text.muted, marginTop: 4, lineHeight: 17 },
    suggestedBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6,
        paddingHorizontal: 6, paddingVertical: 2,
        borderWidth: 1, borderColor: colors.glass.borderLight,
    },
    suggestedText: {
        fontSize: 10, fontFamily: typography.fontFamily.bold,
        color: colors.text.primary, letterSpacing: 0.3,
    },
    splitPreview: {
        marginTop: 8, paddingTop: 8,
        borderTopWidth: 1, borderTopColor: colors.glass.border,
        gap: 4,
    },
    splitPreviewRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    splitPreviewDot: {
        width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text.muted,
    },
    splitPreviewText: {
        fontSize: 12, color: colors.text.secondary,
        fontFamily: typography.fontFamily.medium,
    },

    // ── Footer ───────────────────────────────────────────────────
    footer: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
    },
    footerGradient: {
        position: 'absolute',
        top: -40, left: 0, right: 0, height: 40,
    },
    footerContent: {
        backgroundColor: colors.background,
        paddingHorizontal: spacing['2xl'],
        paddingBottom: spacing['3xl'],
        paddingTop: spacing.md,
    },
    nextBtn: {
        height: 54, borderRadius: borderRadius.lg,
        overflow: 'hidden',
        alignItems: 'center', justifyContent: 'center',
        ...shadows.glowMd,
    },
    nextBtnInner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    nextText: {
        color: colors.text.dark, fontSize: 16,
        fontFamily: typography.fontFamily.bold,
    },
});
