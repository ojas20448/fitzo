import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, TextInput, Dimensions, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import { nutritionAPI, workoutsAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    return Math.round(bmr * (multipliers[activity] || 1.55));
}

function computeTargetCalories(tdee: number, goal: string) {
    if (goal === 'fat_loss') return tdee - 500;
    if (goal === 'muscle_gain') return tdee + 300;
    return tdee;
}

function computeMacros(calories: number, goal: string, dietary: string) {
    // Protein-first approach (higher protein for fat loss / muscle gain)
    let proteinPct: number, carbsPct: number, fatPct: number;
    if (goal === 'fat_loss') { proteinPct = 0.35; fatPct = 0.30; carbsPct = 0.35; }
    else if (goal === 'muscle_gain') { proteinPct = 0.30; carbsPct = 0.45; fatPct = 0.25; }
    else { proteinPct = 0.30; carbsPct = 0.40; fatPct = 0.30; }

    // Vegetarian: slightly less protein (plant sources), more carbs
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

// ─── Reusable chip selector ───────────────────────────────────────────────────
function ChipGroup<T extends string>({ options, value, onChange }: {
    options: { id: T; label: string; icon?: string; desc?: string }[];
    value: T;
    onChange: (v: T) => void;
}) {
    return (
        <View style={chip.grid}>
            {options.map(o => {
                const active = value === o.id;
                return (
                    <TouchableOpacity
                        key={o.id}
                        style={[chip.card, active && chip.cardActive]}
                        onPress={() => onChange(o.id)}
                        activeOpacity={0.8}
                    >
                        {o.icon && (
                            <Text style={chip.icon}>{o.icon}</Text>
                        )}
                        <Text style={[chip.label, active && chip.labelActive]}>{o.label}</Text>
                        {o.desc && <Text style={[chip.desc, active && chip.descActive]}>{o.desc}</Text>}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const chip = StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    card: {
        flex: 1, minWidth: '45%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 14, padding: 14, alignItems: 'center', gap: 4,
    },
    cardActive: { borderColor: colors.primary, backgroundColor: 'rgba(99,102,241,0.15)' },
    icon: { fontSize: 22, marginBottom: 2 },
    label: { fontSize: 14, fontFamily: typography.fontFamily.bold, color: colors.text.secondary, textAlign: 'center' },
    labelActive: { color: colors.primary },
    desc: { fontSize: 11, color: colors.text.muted, textAlign: 'center' },
    descActive: { color: colors.primary + 'cc' },
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
                    placeholderTextColor={colors.text.muted}
                />
                <Text style={num.unit}>{unit}</Text>
            </View>
        </View>
    );
}

const num = StyleSheet.create({
    container: { flex: 1 },
    label: { fontSize: 12, fontFamily: typography.fontFamily.bold, color: colors.text.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
    row: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 14,
    },
    input: { flex: 1, height: 52, color: colors.text.primary, fontSize: 20, fontFamily: typography.fontFamily.bold },
    unit: { color: colors.text.muted, fontSize: 14, fontFamily: typography.fontFamily.medium },
});

// ─── Macro bar ────────────────────────────────────────────────────────────────
function MacroBar({ label, g, cal, color, pct }: { label: string; g: number; cal: number; color: string; pct: number }) {
    return (
        <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: colors.text.primary, fontFamily: typography.fontFamily.bold, fontSize: 14 }}>{label}</Text>
                <Text style={{ color: colors.text.muted, fontSize: 13 }}>{g}g · {cal} kcal</Text>
            </View>
            <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                <View style={{ height: 6, width: `${pct}%`, backgroundColor: color, borderRadius: 4 }} />
            </View>
        </View>
    );
}

export default function OnboardingWizard() {
    const toast = useToast();
    const { completeOnboarding } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        height_cm: '',
        weight_kg: '',
        age: '',
        gender: 'male' as 'male' | 'female',
        body_fat_pct: '',       // optional
        goal_type: 'maintenance' as 'fat_loss' | 'maintenance' | 'muscle_gain',
        activity_level: 'moderate' as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',
        experience: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
        dietary: 'everything' as 'everything' | 'vegetarian' | 'vegan',
        split_id: 'custom' as string,
    });

    const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

    // ── Derived values ───────────────────────────────────────────
    const w = parseFloat(form.weight_kg);
    const h = parseFloat(form.height_cm);
    const a = parseFloat(form.age);
    const hasBody = !!w && !!h && !!a;

    const tdee = hasBody ? computeTDEE(w, h, a, form.gender, form.activity_level) : 0;
    const targetCal = hasBody ? computeTargetCalories(tdee, form.goal_type) : 0;
    const macros = hasBody ? computeMacros(targetCal, form.goal_type, form.dietary) : { protein: 0, carbs: 0, fat: 0 };
    const bmi = hasBody ? computeBMI(w, h) : 0;
    const bmiCat = bmiCategory(bmi);

    const nextStep = () => {
        if (step === 1 && (!form.height_cm || !form.weight_kg || !form.age)) {
            toast.error('Missing Info', 'Please fill in height, weight, and age');
            return;
        }
        setStep(s => Math.min(s + 1, TOTAL_STEPS));
    };
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

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
            toast.success('Welcome to Fitzo! 🎉', 'Your plan is ready.');
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
            <Text style={s.emoji}>📏</Text>
            <Text style={s.title}>Your Body Stats</Text>
            <Text style={s.subtitle}>We use these to calculate your calorie targets using the Mifflin-St Jeor equation — the gold standard in sports nutrition.</Text>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <NumInput label="Height" unit="cm" value={form.height_cm} onChange={v => set('height_cm', v)} placeholder="175" />
                <NumInput label="Weight" unit="kg" value={form.weight_kg} onChange={v => set('weight_kg', v)} placeholder="70" />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <NumInput label="Age" unit="yrs" value={form.age} onChange={v => set('age', v)} placeholder="25" />
                <NumInput label="Body Fat" unit="%" value={form.body_fat_pct} onChange={v => set('body_fat_pct', v)} placeholder="Optional" />
            </View>

            <Text style={[s.sectionLabel, { marginTop: 20 }]}>Biological Sex</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['male', 'female'] as const).map(g => (
                    <TouchableOpacity
                        key={g}
                        style={[s.genderBtn, form.gender === g && s.genderBtnActive]}
                        onPress={() => set('gender', g)}
                    >
                        <Text style={{ fontSize: 20 }}>{g === 'male' ? '♂️' : '♀️'}</Text>
                        <Text style={[s.genderText, form.gender === g && { color: colors.primary }]}>
                            {g.charAt(0).toUpperCase() + g.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Live BMI preview */}
            {hasBody && (
                <View style={s.previewBox}>
                    <View style={s.previewRow}>
                        <Text style={s.previewLabel}>BMI</Text>
                        <Text style={[s.previewVal, { color: bmiCat.color }]}>{bmi.toFixed(1)} · {bmiCat.label}</Text>
                    </View>
                    <View style={s.previewRow}>
                        <Text style={s.previewLabel}>Maintenance Calories</Text>
                        <Text style={s.previewVal}>{tdee} kcal</Text>
                    </View>
                </View>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Goal
    // ─────────────────────────────────────────────────────────────
    const renderStep2 = () => (
        <View style={s.stepWrap}>
            <Text style={s.emoji}>🎯</Text>
            <Text style={s.title}>What's your main goal?</Text>
            <Text style={s.subtitle}>This adjusts your calorie surplus or deficit and optimises your macro split.</Text>

            <ChipGroup<'fat_loss' | 'maintenance' | 'muscle_gain'>
                value={form.goal_type}
                onChange={v => set('goal_type', v)}
                options={[
                    { id: 'fat_loss', label: 'Lose Fat', icon: '🔥', desc: '−500 kcal/day' },
                    { id: 'maintenance', label: 'Maintain', icon: '⚖️', desc: 'TDEE calories' },
                    { id: 'muscle_gain', label: 'Build Muscle', icon: '💪', desc: '+300 kcal/day' },
                ]}
            />

            <Text style={s.sectionLabel}>Experience Level</Text>
            <ChipGroup<'beginner' | 'intermediate' | 'advanced'>
                value={form.experience}
                onChange={v => set('experience', v)}
                options={[
                    { id: 'beginner', label: 'Beginner', icon: '🌱', desc: '< 1 year' },
                    { id: 'intermediate', label: 'Intermediate', icon: '🏋️', desc: '1–3 years' },
                    { id: 'advanced', label: 'Advanced', icon: '🏆', desc: '3+ years' },
                ]}
            />

            <Text style={s.sectionLabel}>Dietary Preference</Text>
            <ChipGroup<'everything' | 'vegetarian' | 'vegan'>
                value={form.dietary}
                onChange={v => set('dietary', v)}
                options={[
                    { id: 'everything', label: 'Everything', icon: '🍗' },
                    { id: 'vegetarian', label: 'Vegetarian', icon: '🥚' },
                    { id: 'vegan', label: 'Vegan', icon: '🌿' },
                ]}
            />
        </View>
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Activity Level
    // ─────────────────────────────────────────────────────────────
    const renderStep3 = () => (
        <View style={s.stepWrap}>
            <Text style={s.emoji}>🏃</Text>
            <Text style={s.title}>How active are you?</Text>
            <Text style={s.subtitle}>Be honest — overestimating activity is the most common reason calorie targets don't work.</Text>

            {[
                { id: 'sedentary', label: 'Sedentary', icon: '🪑', desc: 'Desk job, little to no exercise' },
                { id: 'light', label: 'Lightly Active', icon: '🚶', desc: 'Light exercise 1–3x/week' },
                { id: 'moderate', label: 'Moderately Active', icon: '🚴', desc: 'Exercise 3–5x/week' },
                { id: 'active', label: 'Very Active', icon: '🏋️', desc: 'Hard exercise 6–7x/week' },
                { id: 'very_active', label: 'Athlete / Manual Labor', icon: '⚡', desc: 'Training twice a day or physical job' },
            ].map(o => {
                const active = form.activity_level === o.id;
                return (
                    <TouchableOpacity
                        key={o.id}
                        style={[s.activityCard, active && s.activityCardActive]}
                        onPress={() => set('activity_level', o.id)}
                    >
                        <Text style={{ fontSize: 22 }}>{o.icon}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.activityLabel, active && { color: colors.primary }]}>{o.label}</Text>
                            <Text style={s.activityDesc}>{o.desc}</Text>
                        </View>
                        {active && <MaterialIcons name="check-circle" size={20} color={colors.primary} />}
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Your Blueprint (Results)
    // ─────────────────────────────────────────────────────────────
    const renderStep4 = () => {
        const proteinPct = Math.round((macros.protein * 4 / targetCal) * 100);
        const carbsPct = Math.round((macros.carbs * 4 / targetCal) * 100);
        const fatPct = Math.round((macros.fat * 9 / targetCal) * 100);

        return (
            <View style={s.stepWrap}>
                <Text style={s.emoji}>📊</Text>
                <Text style={s.title}>Your Blueprint</Text>
                <Text style={s.subtitle}>Calculated using Mifflin-St Jeor + Harris-Benedict equations, then adjusted for your goal.</Text>

                {/* Calorie ring / summary */}
                <View style={s.calCard}>
                    <LinearGradient
                        colors={['rgba(99,102,241,0.2)', 'rgba(99,102,241,0.05)']}
                        style={StyleSheet.absoluteFill}
                        borderRadius={16}
                    />
                    <View style={{ alignItems: 'center' }}>
                        <Text style={s.calLabel}>Daily Target</Text>
                        <Text style={s.calNum}>{targetCal}</Text>
                        <Text style={s.calSub}>kcal / day</Text>
                    </View>
                    <View style={s.calDivider} />
                    <View style={{ gap: 8 }}>
                        <View style={s.calRow}>
                            <Text style={s.calStatLabel}>TDEE (Maintenance)</Text>
                            <Text style={s.calStatVal}>{tdee} kcal</Text>
                        </View>
                        <View style={s.calRow}>
                            <Text style={s.calStatLabel}>BMI</Text>
                            <Text style={[s.calStatVal, { color: bmiCat.color }]}>{bmi.toFixed(1)} · {bmiCat.label}</Text>
                        </View>
                        <View style={s.calRow}>
                            <Text style={s.calStatLabel}>Goal</Text>
                            <Text style={s.calStatVal}>{form.goal_type === 'fat_loss' ? '−0.5 kg/week' : form.goal_type === 'muscle_gain' ? '+0.3 kg/week est.' : 'Maintain weight'}</Text>
                        </View>
                    </View>
                </View>

                {/* Macro breakdown */}
                <Text style={s.sectionLabel}>Macro Targets</Text>
                <View style={s.macroCard}>
                    <MacroBar label="🥩 Protein" g={macros.protein} cal={macros.protein * 4} color="#6366f1" pct={proteinPct} />
                    <MacroBar label="🍚 Carbs" g={macros.carbs} cal={macros.carbs * 4} color="#f59e0b" pct={carbsPct} />
                    <MacroBar label="🫒 Fat" g={macros.fat} cal={macros.fat * 9} color="#ec4899" pct={fatPct} />
                </View>

                <View style={s.infoBox}>
                    <Text style={s.infoIcon}>💡</Text>
                    <Text style={s.infoText}>
                        {form.dietary !== 'everything' ? 'Your protein targets are achieved through plant-based sources. Focus on legumes, tofu, and seeds. ' : 'Protein is calculated at 35% of calories to preserve muscle. '}
                        You can fine-tune these targets anytime in your profile.
                    </Text>
                </View>
            </View>
        );
    };

    // ─────────────────────────────────────────────────────────────
    // STEP 5: Training Split
    // ─────────────────────────────────────────────────────────────
    const renderStep5 = () => {
        // Suggest a plan based on experience
        const suggested = form.experience === 'beginner' ? 'full_body'
            : form.experience === 'intermediate' ? 'upper_lower' : 'ppl';

        const splits = [
            { id: 'full_body', name: 'Full Body', days: '3 days/week', level: 'Beginner', icon: '🏃', desc: 'Best for beginners. Hit every muscle 3x/week for maximum stimulus.' },
            { id: 'upper_lower', name: 'Upper / Lower', days: '4 days/week', level: 'Intermediate', icon: '🏋️', desc: 'Balanced split with good frequency and volume.' },
            { id: 'ppl', name: 'Push / Pull / Legs', days: '6 days/week', level: 'Advanced', icon: '⚡', desc: 'High volume. Best for experienced lifters who can handle 6 sessions.' },
            { id: 'custom', name: 'Custom / Decide Later', days: 'Flexible', level: 'Any', icon: '🗓️', desc: 'Skip for now and pick a plan from the library after setup.' },
        ];

        return (
            <View style={s.stepWrap}>
                <Text style={s.emoji}>🗓️</Text>
                <Text style={s.title}>Pick a Training Split</Text>
                <Text style={s.subtitle}>
                    Based on your experience ({form.experience}), we recommend{' '}
                    <Text style={{ color: colors.primary, fontFamily: typography.fontFamily.bold }}>
                        {splits.find(sp => sp.id === suggested)?.name}
                    </Text>.
                </Text>

                <View style={{ gap: 10 }}>
                    {splits.map(sp => {
                        const active = form.split_id === sp.id;
                        return (
                            <TouchableOpacity
                                key={sp.id}
                                style={[s.splitCard, active && s.splitCardActive]}
                                onPress={() => set('split_id', sp.id)}
                                activeOpacity={0.85}
                            >
                                <Text style={{ fontSize: 22 }}>{sp.icon}</Text>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={[s.splitName, active && { color: colors.primary }]}>{sp.name}</Text>
                                        {sp.id === suggested && (
                                            <View style={s.suggestedBadge}>
                                                <Text style={s.suggestedText}>Recommended</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={s.splitMeta}>{sp.days} · {sp.level}</Text>
                                    <Text style={s.splitDesc}>{sp.desc}</Text>
                                </View>
                                {active && <MaterialIcons name="check-circle" size={20} color={colors.primary} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    // ─────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={s.container}>
            {/* Progress */}
            <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
            </View>
            <Text style={s.stepCount}>{step} of {TOTAL_STEPS}</Text>

            <ScrollView
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

            <View style={s.footer}>
                {step > 1 && (
                    <TouchableOpacity style={s.backBtn} onPress={prevStep}>
                        <MaterialIcons name="arrow-back" size={20} color={colors.text.muted} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[s.nextBtn, loading && { opacity: 0.6 }]}
                    onPress={step === TOTAL_STEPS ? handleComplete : nextStep}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <>
                            <Text style={s.nextText}>{step === TOTAL_STEPS ? 'Get Started 🎉' : 'Continue'}</Text>
                            {step < TOTAL_STEPS && <MaterialIcons name="arrow-forward" size={18} color="#fff" />}
                        </>
                    }
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)' },
    progressFill: { height: 3, backgroundColor: colors.primary, borderRadius: 2 },
    stepCount: { textAlign: 'right', paddingHorizontal: 20, paddingTop: 8, fontSize: 12, color: colors.text.muted, fontFamily: typography.fontFamily.medium },
    scroll: { padding: 24, paddingBottom: 32 },
    stepWrap: { gap: 16 },
    emoji: { fontSize: 36, marginBottom: -4 },
    title: { fontSize: 26, fontFamily: typography.fontFamily.bold, color: colors.text.primary, letterSpacing: -0.5 },
    subtitle: { fontSize: 14, color: colors.text.muted, lineHeight: 21 },
    sectionLabel: { fontSize: 12, fontFamily: typography.fontFamily.bold, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },

    // Gender
    genderBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: 14, borderRadius: 12, borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)',
    },
    genderBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(99,102,241,0.12)' },
    genderText: { fontSize: 15, fontFamily: typography.fontFamily.bold, color: colors.text.secondary },

    // Live preview
    previewBox: {
        backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 12,
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)', padding: 14, gap: 8, marginTop: 4,
    },
    previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
    previewLabel: { fontSize: 13, color: colors.text.muted },
    previewVal: { fontSize: 13, fontFamily: typography.fontFamily.bold, color: colors.text.primary },

    // Activity
    activityCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    activityCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(99,102,241,0.1)' },
    activityLabel: { fontSize: 14, fontFamily: typography.fontFamily.bold, color: colors.text.primary, marginBottom: 2 },
    activityDesc: { fontSize: 12, color: colors.text.muted },

    // Blueprint
    calCard: {
        flexDirection: 'row', alignItems: 'center', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)',
        padding: 18, gap: 16, overflow: 'hidden',
    },
    calLabel: { fontSize: 12, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
    calNum: { fontSize: 42, fontFamily: typography.fontFamily.bold, color: colors.text.primary, lineHeight: 50 },
    calSub: { fontSize: 13, color: colors.text.muted },
    calDivider: { width: 1, height: 80, backgroundColor: 'rgba(255,255,255,0.1)' },
    calRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    calStatLabel: { fontSize: 12, color: colors.text.muted },
    calStatVal: { fontSize: 12, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
    macroCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16,
    },
    infoBox: {
        flexDirection: 'row', gap: 10, backgroundColor: 'rgba(99,102,241,0.08)',
        borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.15)',
    },
    infoIcon: { fontSize: 16, marginTop: 1 },
    infoText: { flex: 1, fontSize: 13, color: colors.text.muted, lineHeight: 19 },

    // Split
    splitCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14,
        borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    splitCardActive: { borderColor: colors.primary, backgroundColor: 'rgba(99,102,241,0.1)' },
    splitName: { fontSize: 15, fontFamily: typography.fontFamily.bold, color: colors.text.primary },
    splitMeta: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
    splitDesc: { fontSize: 12, color: colors.text.muted, marginTop: 4, lineHeight: 17 },
    suggestedBadge: {
        backgroundColor: colors.primary + '25', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    },
    suggestedText: { fontSize: 10, fontFamily: typography.fontFamily.bold, color: colors.primary },

    // Footer
    footer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
        paddingHorizontal: 24, paddingBottom: 24, paddingTop: 12, gap: 12,
    },
    backBtn: {
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    nextBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: colors.primary, height: 52, borderRadius: 14,
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    nextText: { color: '#fff', fontSize: 16, fontFamily: typography.fontFamily.bold },
});
