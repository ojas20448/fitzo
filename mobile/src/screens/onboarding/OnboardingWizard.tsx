import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, TextInput, Dimensions, ActivityIndicator, Pressable
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
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import { nutritionAPI, workoutsAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Science: Mifflin-St Jeor + Harris-Benedict averaged ─────────────────────
function computeTDEE(weight: number, height: number, age: number, gender: string, activity: string) {
    const mifflin = gender === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
    const harris = gender === 'male'
        ? 13.397 * weight + 4.799 * height - 5.677 * age + 88.362
        : 9.247 * weight + 3.098 * height - 4.330 * age + 447.593;
    const bmr = (mifflin + harris) / 2;
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
    if (goal === 'fat_loss') { proteinPct = 0.35; fatPct = 0.30; carbsPct = 0.35; }
    else if (goal === 'muscle_gain') { proteinPct = 0.30; carbsPct = 0.45; fatPct = 0.25; }
    else { proteinPct = 0.30; carbsPct = 0.40; fatPct = 0.30; }

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
    if (bmi < 18.5) return { label: 'Underweight', color: '#3B82F6' };
    if (bmi < 25) return { label: 'Normal Weight', color: '#22C55E' };
    if (bmi < 30) return { label: 'Overweight', color: '#F59E0B' };
    return { label: 'Obese', color: '#EF4444' };
}

const TOTAL_STEPS = 5;

// ─── Step metadata ───────────────────────────────────────────────────────────
const STEP_META: Record<number, { icon: keyof typeof MaterialIcons.glyphMap; purpose: string }> = {
    1: { icon: 'straighten', purpose: "Let's get to know your body" },
    2: { icon: 'flag', purpose: "Define what you're working towards" },
    3: { icon: 'directions-run', purpose: "Let's calculate your daily needs" },
    4: { icon: 'auto-graph', purpose: 'Your personalised nutrition blueprint' },
    5: { icon: 'calendar-today', purpose: 'Choose how you want to train' },
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

    const progressGlowStyle = useAnimatedStyle(() => ({
        shadowOpacity: progressGlow.value,
    }));

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
            } as any);

            if (form.split_id && form.split_id !== 'custom') {
                try { await workoutsAPI.adoptSplit(form.split_id); } catch { }
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
                    <NumInput label="Height" unit="cm" value={form.height_cm} onChange={v => set('height_cm', v)} placeholder="175" />
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
        const current = macroOverride || baseMacros;
        setMacroOverride({
            ...current,
            [macro]: Math.max(0, current[macro] + delta),
        });
    }, [macroOverride, baseMacros]);

    const renderStep4 = () => (
        <View style={s.stepWrap}>
            <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={s.stepHeader}>
                <View style={s.stepIconWrap}>
                    <MaterialIcons name="auto-graph" size={28} color={colors.text.primary} />
                </View>
                <Text style={s.title}>Your Blueprint</Text>
                <Text style={s.purpose}>{STEP_META[4].purpose}</Text>
                <Text style={s.subtitle}>Calculated using Mifflin-St Jeor + Harris-Benedict, adjusted for your goal.</Text>
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
                    <MacroBar label="Protein" g={macros.protein} cal={macros.protein * 4} color="#6366f1" pct={proteinPct} />
                    <MacroBar label="Carbs" g={macros.carbs} cal={macros.carbs * 4} color="#f59e0b" pct={carbsPct} />
                    <MacroBar label="Fat" g={macros.fat} cal={macros.fat * 9} color="#ec4899" pct={fatPct} />
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
                        color="#6366f1"
                        onIncrease={() => handleMacroAdjust('protein', 5)}
                        onDecrease={() => handleMacroAdjust('protein', -5)}
                    />
                    <MacroSlider
                        label="Carbs"
                        grams={macros.carbs}
                        color="#f59e0b"
                        onIncrease={() => handleMacroAdjust('carbs', 5)}
                        onDecrease={() => handleMacroAdjust('carbs', -5)}
                    />
                    <MacroSlider
                        label="Fat"
                        grams={macros.fat}
                        color="#ec4899"
                        onIncrease={() => handleMacroAdjust('fat', 5)}
                        onDecrease={() => handleMacroAdjust('fat', -5)}
                    />
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

    const renderStep5 = () => (
        <View style={s.stepWrap}>
            <Animated.View entering={FadeInDown.delay(100).duration(600).springify()} style={s.stepHeader}>
                <View style={s.stepIconWrap}>
                    <MaterialIcons name="calendar-today" size={28} color={colors.text.primary} />
                </View>
                <Text style={s.title}>Training Split</Text>
                <Text style={s.purpose}>{STEP_META[5].purpose}</Text>
                <Text style={s.subtitle}>
                    Based on your experience ({form.experience}), we recommend{' '}
                    <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.bold }}>
                        {splits.find(sp => sp.id === suggested)?.name}
                    </Text>.
                </Text>
            </Animated.View>

            <View style={{ gap: 10 }}>
                {splits.map((sp, idx) => {
                    const active = form.split_id === sp.id;
                    const isRecommended = sp.id === suggested;
                    return (
                        <Animated.View
                            key={sp.id}
                            entering={FadeInDown.delay(200 + idx * 100).duration(600).springify()}
                        >
                            <TouchableOpacity
                                style={[s.splitCard, active && s.splitCardActive]}
                                onPress={() => set('split_id', sp.id)}
                                activeOpacity={0.85}
                            >
                                <View style={[s.splitIconWrap, active && s.splitIconWrapActive]}>
                                    <MaterialIcons
                                        name={sp.icon}
                                        size={20}
                                        color={active ? colors.text.primary : colors.text.muted}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={[s.splitName, active && { color: colors.text.primary }]}>{sp.name}</Text>
                                        {isRecommended && <PulsingBadge text="Recommended" />}
                                    </View>
                                    <Text style={s.splitMeta}>{sp.days}  {sp.level}</Text>
                                    <Text style={s.splitDesc}>{sp.desc}</Text>

                                    {/* Workout preview */}
                                    {active && sp.preview.length > 0 && (
                                        <Animated.View
                                            entering={FadeInDown.delay(50).duration(400).springify()}
                                            style={s.splitPreview}
                                        >
                                            {sp.preview.map((day, i) => (
                                                <View key={i} style={s.splitPreviewRow}>
                                                    <View style={s.splitPreviewDot} />
                                                    <Text style={s.splitPreviewText}>{day}</Text>
                                                </View>
                                            ))}
                                        </Animated.View>
                                    )}
                                </View>
                                {active && <MaterialIcons name="check-circle" size={20} color={colors.text.primary} />}
                            </TouchableOpacity>
                        </Animated.View>
                    );
                })}
            </View>
        </View>
    );

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    const progressPct = (step / TOTAL_STEPS) * 100;

    return (
        <SafeAreaView style={s.container}>
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
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
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
                        onPress={step === TOTAL_STEPS ? handleComplete : (step === 4 ? nextStep : nextStep)}
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
                                        {step === TOTAL_STEPS
                                            ? 'Get Started'
                                            : step === 4
                                                ? 'This Looks Right'
                                                : 'Continue'}
                                    </Text>
                                    {step < TOTAL_STEPS && <MaterialIcons name="arrow-forward" size={18} color={colors.text.dark} />}
                                </View>
                            )
                        }
                    </TouchableOpacity>
                </View>
            </Animated.View>
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
        paddingTop: spacing.sm,
    },
    progressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    progressBackBtn: {
        padding: 4,
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
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 8,
        elevation: 4,
    },

    // ── Scroll / layout ──────────────────────────────────────────
    scroll: { padding: spacing['2xl'], paddingBottom: 140 },
    stepWrap: { gap: 16 },

    // ── Step header ──────────────────────────────────────────────
    stepHeader: { gap: 6, marginBottom: 8 },
    stepIconWrap: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1, borderColor: colors.glass.border,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
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
        marginTop: 8,
    },

    // ── Gender ───────────────────────────────────────────────────
    genderBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: 14, borderRadius: borderRadius.md, borderWidth: 1,
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
        padding: 14, gap: 8, marginTop: 4,
    },
    previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
    previewLabel: { fontSize: 13, color: colors.text.muted },
    previewVal: { fontSize: 13, fontFamily: typography.fontFamily.bold, color: colors.text.primary },

    // ── Mini preview ─────────────────────────────────────────────
    miniPreview: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.md, borderWidth: 1,
        borderColor: colors.glass.borderLight,
        padding: 12, marginTop: 4,
    },
    miniPreviewText: {
        fontSize: 13, color: colors.text.muted, flex: 1,
    },

    // ── Activity ─────────────────────────────────────────────────
    activityCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
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
        padding: 20, gap: 12, overflow: 'hidden',
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
        borderColor: colors.glass.border, padding: 16,
    },
    macroCustomCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg, borderWidth: 1,
        borderColor: colors.glass.border, padding: 16,
    },
    customizeLink: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'center', paddingVertical: 4,
    },
    customizeLinkText: {
        fontSize: 13, color: colors.text.secondary,
        fontFamily: typography.fontFamily.medium,
    },
    resetLink: { alignSelf: 'center', paddingTop: 10 },
    resetLinkText: {
        fontSize: 12, color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
        textDecorationLine: 'underline',
    },
    infoBox: {
        flexDirection: 'row', gap: 10,
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.md, padding: 12,
        borderWidth: 1, borderColor: colors.glass.border,
    },
    infoText: { flex: 1, fontSize: 13, color: colors.text.muted, lineHeight: 19 },

    // ── Split ────────────────────────────────────────────────────
    splitCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14,
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
