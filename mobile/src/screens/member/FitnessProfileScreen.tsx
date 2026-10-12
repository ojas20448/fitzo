import ScreenBackdrop from '../../components/ScreenBackdrop';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { nutritionAPI, workoutsAPI, getAuthToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { EMPTY_ONBOARDING, validateBody } from '../../utils/onboardingPlan';
import { useNutrition } from '../../context/NutritionContext';
import { calculateEnergy, calculateCalories, calculateMacros, proteinPerKgForGoal } from '../../utils/nutritionTargets';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import { useToast } from '../../components/Toast';

const GOALS = [
    { id: 'fat_loss', label: 'Lose Fat', icon: 'trending-down', color: '#FF6B6B' },
    { id: 'maintenance', label: 'Maintain', icon: 'swap-vert', color: '#4ECDC4' },
    { id: 'muscle_gain', label: 'Build Muscle', icon: 'trending-up', color: '#FFE66D' },
];

const ACTIVITY_LEVELS = [
    { id: 'sedentary', label: 'Sedentary', desc: 'Mostly sitting, little daily movement' },
    { id: 'light', label: 'Light', desc: 'Mostly sitting, plus walks or a few workouts' },
    { id: 'moderate', label: 'Moderate', desc: 'Regular exercise plus a reasonably active day' },
    { id: 'active', label: 'Active', desc: 'Hard exercise and active for much of the day' },
    { id: 'very_active', label: 'Very Active', desc: 'Heavy physical work or demanding twice-daily training' },
];

export default function FitnessProfileScreen() {
    const { user } = useAuth();
    return <ProfileEditor key={user?.id ?? 'signed-out'} />;
}
function ProfileEditor() {
    const mounted = useRef(true);
    const [loadError, setLoadError] = useState('');
    const toast = useToast();
    const showError = toast.error;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | null>(null);
    const [goalType, setGoalType] = useState('');
    const [activityLevel, setActivityLevel] = useState('');
    const [isVegetarian, setIsVegetarian] = useState<boolean | null>(null);
    // Manual calorie override. Off by default so the app keeps auto-calculating
    // from biometrics; on, it sends target_calories and the backend stops
    // recomputing it (routes/nutrition.js treats a supplied target as final).
    const [useCustomCalories, setUseCustomCalories] = useState(false);
    const [customCalories, setCustomCalories] = useState('');
    const [savedMacros, setSavedMacros] = useState<{ protein: number; carbs: number; fat: number } | null>(null);
    const [keepCustomMacros, setKeepCustomMacros] = useState(false);
    const [calculatedCalories, setCalculatedCalories] = useState<number | null>(null);

    // Calculated values
    const bmi = parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2) || 0;

    const basicsError = validateBody({ ...EMPTY_ONBOARDING, height, weight, age, gender, vegetarian: isVegetarian })
        || (!activityLevel ? 'Choose your everyday activity.' : null) || (!goalType ? 'Choose your goal.' : null);
    const bodyValid = !basicsError;
    const w = Number(weight), h = Number(height), a = Number(age);
    const autoCalories = bodyValid ? calculateCalories(calculateEnergy(w, h, a, gender!, activityLevel).tdee, goalType, gender!, bmi) : 0;
    const customCalNum = Number(customCalories);
    const effectiveCalories = useCustomCalories && Number.isFinite(customCalNum) && customCalNum >= 800 && customCalNum <= 8000
        ? customCalNum
        : autoCalories;
    const liveMacros = calculateMacros(effectiveCalories, w, keepCustomMacros && savedMacros
        ? { protein: savedMacros.protein, fat: savedMacros.fat } : {}, goalType);

    const { weeklyWorkoutGoal, updateWeeklyGoal, refreshToday } = useNutrition();
    const [showWeeklyGoal, setShowWeeklyGoal] = useState(false);
    const weeklyGoalTouched = useRef(false);
    const [weeklyGoal, setWeeklyGoal] = useState('4');

    // ... existing state ...

    useEffect(() => { if (!weeklyGoalTouched.current) setWeeklyGoal(String(weeklyWorkoutGoal)); }, [weeklyWorkoutGoal]);

    const loadProfile = useCallback(async () => {
        setLoading(true); setLoadError('');
        try {
            const { profile } = await nutritionAPI.getProfile();
            if (!mounted.current) return;
            if (profile) {
                setHeight(profile.height_cm != null ? String(profile.height_cm) : '');
                setWeight(profile.weight_kg != null ? String(profile.weight_kg) : '');
                setAge(String(profile.age ?? ''));
                setGender(profile.gender ?? null);
                setGoalType(profile.goal_type ?? '');
                setActivityLevel(profile.activity_level ?? '');
                setIsVegetarian(profile.is_vegetarian ?? null);
                setCalculatedCalories(profile.target_calories ?? null);
                setUseCustomCalories(profile.calorie_target_mode === 'custom');
                const custom = profile.macro_target_mode === 'custom'
                    && [profile.target_protein, profile.target_carbs, profile.target_fat].every(value => value != null && Number.isFinite(Number(value)) && Number(value) >= 0);
                setKeepCustomMacros(custom);
                setSavedMacros(custom ? { protein: Number(profile.target_protein), carbs: Number(profile.target_carbs), fat: Number(profile.target_fat) } : null);
                if (profile.target_calories) {
                    setCustomCalories(String(Math.round(profile.target_calories)));
                }
            } else {
                const training = await workoutsAPI.getTrainingPreferences();
                if (mounted.current) setGoalType(training.preferences?.goal_type ?? '');
            }
        } catch (error: any) {
            if (!mounted.current) return;
            setLoadError('Could not load your food profile. Retry before editing.');
            showError('Error', error.message || 'Something went wrong');
        } finally {
            if (mounted.current) setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        mounted.current = true; void loadProfile();
        return () => { mounted.current = false; };
    }, [loadProfile]);



    const handleSave = async () => {
        if (saving || loadError) return;
        if (basicsError) { toast.error('Complete your food basics', basicsError); return; }
        const override = Number(customCalories);
        if (useCustomCalories && (!Number.isInteger(override) || override < 800 || override > 8000)) {
            toast.error('Check that number', 'Enter a daily target between 800 and 8000 kcal.');
            return;
        }
        if (liveMacros.protein * 4 + liveMacros.fat * 9 > effectiveCalories) {
            toast.error('Check your targets', 'Protein and fat exceed your calorie target. Increase calories or use suggested macros.');
            return;
        }

        setSaving(true);
        try {
            const token = await getAuthToken();
            if (!token || !mounted.current) return;
            const result = await nutritionAPI.updateProfile({
                height_cm: parseFloat(height),
                weight_kg: parseFloat(weight),
                age: Number(age),
                gender: gender!,
                activity_level: activityLevel as any,
                goal_type: goalType as any,
                is_vegetarian: isVegetarian!,
                calorie_target_mode: useCustomCalories ? 'custom' : 'automatic',
                macro_target_mode: keepCustomMacros ? 'custom' : 'automatic',
                ...(keepCustomMacros ? { target_protein: liveMacros.protein, target_carbs: liveMacros.carbs, target_fat: liveMacros.fat } : {}),
                // Omitted entirely when off, so the backend recalculates.
                ...(useCustomCalories ? { target_calories: override } : {}),
            }, token);
            if (!mounted.current) return;

            // Save weekly goal
            if (weeklyGoalTouched.current) await updateWeeklyGoal(Number(weeklyGoal));
            await refreshToday();

            if (!mounted.current) return;
            toast.success('Profile Updated!', `Daily target: ${result.profile.target_calories} kcal`);
            router.back();
        } catch (error: any) {
            if (!mounted.current) return;
            toast.error('Could not save profile', error.message || 'Please check your details and try again.');
        } finally {
            if (mounted.current) setSaving(false);
        }
    };

    if (loadError) return <SafeAreaView style={styles.container}><View style={{ padding: 24 }}><Text style={styles.toggleDesc}>{loadError}</Text><TouchableOpacity style={{ minHeight: 48 }} accessibilityRole="button" onPress={() => { void loadProfile(); }}><Text style={styles.toggleLabel}>Retry</Text></TouchableOpacity><TouchableOpacity style={{ minHeight: 48 }} accessibilityRole="button" onPress={() => router.back()}><Text style={styles.toggleLabel}>Back</Text></TouchableOpacity></View></SafeAreaView>;
    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenBackdrop />
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenBackdrop />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Food targets</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Physical Stats */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your measurements</Text>

                    {/* Gender Toggle */}
                    <View style={styles.genderRow}>
                        <Pressable
                            style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                            onPress={() => setGender('male')} accessibilityRole="radio" accessibilityLabel="Male" accessibilityState={{ checked: gender === 'male' }} aria-checked={gender === 'male'}
                        >
                            <MaterialIcons name="male" size={20} color={gender === 'male' ? colors.text.dark : colors.text.muted} />
                            <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>Male</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                            onPress={() => setGender('female')} accessibilityRole="radio" accessibilityLabel="Female" accessibilityState={{ checked: gender === 'female' }} aria-checked={gender === 'female'}
                        >
                            <MaterialIcons name="female" size={20} color={gender === 'female' ? colors.text.dark : colors.text.muted} />
                            <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>Female</Text>
                        </Pressable>
                    </View>

                    {/* Height, Weight, Age Inputs */}
                    <View style={styles.inputRow}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Height</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    accessibilityLabel="Height" value={height}
                                    onChangeText={setHeight}
                                    keyboardType="numeric"
                                    placeholder="170"
                                    placeholderTextColor={colors.text.subtle}
                                />
                                <Text style={styles.inputUnit}>cm</Text>
                            </View>
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Weight</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    accessibilityLabel="Weight" value={weight}
                                    onChangeText={setWeight}
                                    keyboardType="numeric"
                                    placeholder="70"
                                    placeholderTextColor={colors.text.subtle}
                                />
                                <Text style={styles.inputUnit}>kg</Text>
                            </View>
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Age</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    accessibilityLabel="Age" value={age}
                                    onChangeText={setAge}
                                    keyboardType="numeric"
                                    placeholder="25"
                                    placeholderTextColor={colors.text.subtle}
                                />
                                <Text style={styles.inputUnit}>yrs</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Goal Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your goal</Text>
                    <View style={styles.goalsRow}>
                        {GOALS.map((goal) => (
                            <Pressable
                                key={goal.id}
                                style={[
                                    styles.goalCard,
                                    goalType === goal.id && [styles.goalCardActive, { borderColor: goal.color }]
                                ]}
                                onPress={() => setGoalType(goal.id)} accessibilityRole="radio" accessibilityLabel={goal.label} accessibilityState={{ checked: goalType === goal.id }} aria-checked={goalType === goal.id}
                            >
                                <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                                    <MaterialIcons name={goal.icon as any} size={24} color={goal.color} />
                                </View>
                                <Text style={[
                                    styles.goalLabel,
                                    goalType === goal.id && { color: goal.color }
                                ]}>{goal.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Weekly Goal Selection */}
                <View style={styles.section}>
                    <TouchableOpacity style={{ minHeight: 48, justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="Adjust weekly workout target (optional)" accessibilityState={{ expanded: showWeeklyGoal }} aria-expanded={showWeeklyGoal} onPress={() => setShowWeeklyGoal(!showWeeklyGoal)}><Text style={styles.toggleLabel}>Weekly workout target (optional)</Text></TouchableOpacity>
                    {showWeeklyGoal && <View style={styles.weeklyGoalContainer}>
                        <Text style={styles.weeklyGoalValue}>{weeklyGoal} days/week</Text>
                        <View style={styles.daysRow}>
                            {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                                <Pressable
                                    key={days}
                                    style={[
                                        styles.dayBtn,
                                        weeklyGoal === String(days) && styles.dayBtnActive
                                    ]}
                                    onPress={() => { weeklyGoalTouched.current = true; setWeeklyGoal(String(days)); }} accessibilityRole="radio" accessibilityLabel={`${days} workouts per week`} accessibilityState={{ checked: weeklyGoal === String(days) }} aria-checked={weeklyGoal === String(days)}
                                >
                                    <Text style={[
                                        styles.dayBtnText,
                                        weeklyGoal === String(days) && styles.dayBtnTextActive
                                    ]}>{days}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>}
                </View>

                {/* Activity Level */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Daily activity</Text>
                    {ACTIVITY_LEVELS.map((level) => (
                        <Pressable
                            key={level.id}
                            style={[
                                styles.activityRow,
                                activityLevel === level.id && styles.activityRowActive
                            ]}
                            onPress={() => setActivityLevel(level.id)} accessibilityRole="radio" accessibilityLabel={level.label} accessibilityState={{ checked: activityLevel === level.id }} aria-checked={activityLevel === level.id}
                        >
                            <View style={styles.activityRadio}>
                                {activityLevel === level.id && <View style={styles.activityRadioInner} />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.activityLabel}>{level.label}</Text>
                                <Text style={styles.activityDesc}>{level.desc}</Text>
                            </View>
                        </Pressable>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text style={styles.toggleLabel}>Food preference</Text>
                    {[{ value: true, label: 'Vegetarian' }, { value: false, label: 'No food restriction' }].map(option => <TouchableOpacity key={option.label} style={styles.activityRow} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: isVegetarian === option.value }} aria-checked={isVegetarian === option.value} onPress={() => setIsVegetarian(option.value)}><Text style={styles.toggleLabel}>{option.label}{isVegetarian === option.value ? ' ✓' : ''}</Text></TouchableOpacity>)}
                </View>

                {/* Daily calorie target — auto by default, overridable */}
                <View style={styles.section}>
                    <Pressable
                        style={styles.toggleRow}
                        onPress={() => setUseCustomCalories(!useCustomCalories)}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.toggleLabel}>Set my own calorie target</Text>
                            <Text style={styles.toggleDesc}>
                                {useCustomCalories
                                    ? 'Your number is used as-is. Turn off to go back to automatic.'
                                    : calculatedCalories
                                        ? `Calculated for you: ${Math.round(calculatedCalories)} kcal/day`
                                        : 'Calculated from your stats, goal and activity level'}
                            </Text>
                        </View>
                        <View style={[styles.toggle, useCustomCalories && styles.toggleActive]}>
                            <View style={[styles.toggleKnob, useCustomCalories && styles.toggleKnobActive]} />
                        </View>
                    </Pressable>

                    {useCustomCalories && (
                        <View style={styles.customCalRow}>
                            <TextInput
                                style={styles.customCalInput}
                                value={customCalories}
                                onChangeText={setCustomCalories}
                                keyboardType="number-pad"
                                placeholder={calculatedCalories ? String(Math.round(calculatedCalories)) : '2200'}
                                placeholderTextColor={colors.text.muted}
                                maxLength={4}
                            />
                            <Text style={styles.customCalUnit}>kcal / day</Text>
                        </View>
                    )}
                </View>

                {/* Target Breakdown Preview */}
                <View style={styles.section}>
                    {savedMacros && (
                        <Pressable style={styles.toggleRow} onPress={() => setKeepCustomMacros(value => !value)} accessibilityRole="switch" accessibilityState={{ checked: keepCustomMacros }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.toggleLabel}>Keep my custom protein and fat</Text>
                                <Text style={styles.toggleDesc}>Carbs adjust to your calories. Turn off to use suggested macros.</Text>
                            </View>
                            <View style={[styles.toggle, keepCustomMacros && styles.toggleActive]}>
                                <View style={[styles.toggleKnob, keepCustomMacros && styles.toggleKnobActive]} />
                            </View>
                        </Pressable>
                    )}
                    {bodyValid && <><Text style={styles.sectionTitle}>Target breakdown</Text>
                    <View style={styles.macroPreviewCard}>
                        <View style={styles.macroPreviewRow}>
                            <View style={styles.macroPreviewItem}>
                                <Text style={styles.macroPreviewLabel}>Calories</Text>
                                <Text style={styles.macroPreviewValue}>
                                    {effectiveCalories} <Text style={styles.macroPreviewUnit}>kcal</Text>
                                </Text>
                                <Text style={styles.macroPreviewSub}>{useCustomCalories ? 'Custom' : 'Auto'}</Text>
                            </View>
                            <View style={styles.macroPreviewDivider} />
                            <View style={styles.macroPreviewItem}>
                                <Text style={[styles.macroPreviewLabel, { color: colors.macro.protein }]}>Protein</Text>
                                <Text style={styles.macroPreviewValue}>
                                    {liveMacros.protein} <Text style={styles.macroPreviewUnit}>g</Text>
                                </Text>
                                <Text style={styles.macroPreviewSub}>
                                    {Math.round((liveMacros.protein * 4 / (effectiveCalories || 1)) * 100)}%
                                </Text>
                            </View>
                            <View style={styles.macroPreviewDivider} />
                            <View style={styles.macroPreviewItem}>
                                <Text style={[styles.macroPreviewLabel, { color: colors.macro.carbs }]}>Carbs</Text>
                                <Text style={styles.macroPreviewValue}>
                                    {liveMacros.carbs} <Text style={styles.macroPreviewUnit}>g</Text>
                                </Text>
                                <Text style={styles.macroPreviewSub}>
                                    {Math.round((liveMacros.carbs * 4 / (effectiveCalories || 1)) * 100)}%
                                </Text>
                            </View>
                            <View style={styles.macroPreviewDivider} />
                            <View style={styles.macroPreviewItem}>
                                <Text style={[styles.macroPreviewLabel, { color: colors.macro.fat }]}>Fat</Text>
                                <Text style={styles.macroPreviewValue}>
                                    {liveMacros.fat} <Text style={styles.macroPreviewUnit}>g</Text>
                                </Text>
                                <Text style={styles.macroPreviewSub}>
                                    {Math.round((liveMacros.fat * 9 / (effectiveCalories || 1)) * 100)}%
                                </Text>
                            </View>
                        </View>
                    </View>
                    </>}
                </View>

                {/* Save Button */}
                <Text style={styles.toggleDesc}>
                    {!bodyValid ? 'Complete your measurements, goal, activity and food preference to preview targets. ' : keepCustomMacros ? 'Your custom protein and fat are kept. Carbs fill the remaining calories. ' : `Suggested protein uses ${proteinPerKgForGoal(goalType)} g per kg. Fat provides about 30% of calories; carbs fill the rest. `}
                    Calories are a starting estimate; review your progress over a few weeks.
                </Text>
                <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving} accessibilityRole="button" accessibilityLabel="Save food targets"
                >
                    <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save food targets'}</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: 100,
    },

    // BMI Card
    bmiCard: {
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    bmiLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 1,
    },
    bmiValue: {
        fontSize: 48,
        fontFamily: typography.fontFamily.bold,
        marginVertical: spacing.sm,
    },
    bmiCategory: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
    },
    bmiCitationContainer: {
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        alignItems: 'center',
        gap: 4,
    },
    bmiCitationText: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        textAlign: 'center',
    },
    bmiCitationLink: {
        color: colors.primary,
        textDecorationLine: 'underline',
    },
    bmiDisclaimerText: {
        fontSize: 10,
        color: colors.text.muted,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 2,
    },

    // Section
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.lg,
    },

    // Gender
    genderRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    genderBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    genderBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    genderText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    genderTextActive: {
        color: colors.text.dark,
    },

    // Inputs
    inputRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    inputGroup: {
        flex: 1,
        flexBasis: 120,
        minWidth: 0,
    },
    inputLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginBottom: spacing.sm,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        paddingHorizontal: spacing.sm, // Reduced padding
    },
    input: {
        flex: 1,
        minWidth: 0,
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        paddingVertical: spacing.md,
    },
    inputUnit: {
        fontSize: 10, // Smaller unit font
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginLeft: 2,
    },

    // Goals
    goalsRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    goalCard: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 2,
        borderColor: colors.glass.border,
    },
    goalCardActive: {
        backgroundColor: colors.surfaceLight,
    },
    goalIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    goalLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
    },

    // Activity
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: spacing.md,
    },
    activityRowActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '10',
    },
    activityRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.text.muted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityRadioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    activityLabel: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    activityDesc: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },

    // Toggle
    customCalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    customCalInput: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.lg,
        minWidth: 110,
        textAlign: 'center',
    },
    customCalUnit: {
        fontFamily: typography.fontFamily.regular,
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    toggleLabel: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    toggleDesc: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    toggle: {
        width: 50,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.surfaceLight,
        padding: 2,
    },
    toggleActive: {
        backgroundColor: colors.primary,
    },
    toggleKnob: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: colors.text.primary,
    },
    toggleKnobActive: {
        marginLeft: 20,
    },

    // Save
    saveBtn: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        padding: spacing.lg,
        alignItems: 'center',
        marginTop: spacing.xl,
        ...shadows.glow,
    },
    saveBtnDisabled: {
        opacity: 0.7,
    },
    saveBtnText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 1,
    },

    // Weekly Goal
    weeklyGoalContainer: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        alignItems: 'center',
    },
    weeklyGoalValue: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        marginBottom: spacing.md,
    },
    daysRow: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    dayBtn: {
        width: 44,
        height: 44,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    dayBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dayBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    dayBtnTextActive: {
        color: colors.text.dark,
        fontFamily: typography.fontFamily.bold,
    },
    macroPreviewCard: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    macroPreviewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    macroPreviewItem: {
        flex: 1,
        alignItems: 'center',
    },
    macroPreviewDivider: {
        width: 1,
        height: 36,
        backgroundColor: colors.glass.border,
    },
    macroPreviewLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginBottom: 2,
    },
    macroPreviewValue: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    macroPreviewUnit: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    macroPreviewSub: {
        fontSize: 10,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 1,
    },
});
