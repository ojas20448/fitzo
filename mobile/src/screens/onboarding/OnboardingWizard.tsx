import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useNutrition } from '../../context/NutritionContext';
import { nutritionAPI, workoutsAPI, getAuthToken } from '../../services/api';
import { colors, typography } from '../../styles/theme';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import TrainingChoices from '../../components/TrainingChoices';
import { calculateCalories, calculateEnergy, calculateMacros, proteinPerKgForGoal } from '../../utils/nutritionTargets';
import { EMPTY_ONBOARDING, OnboardingForm, restoreOnboarding, startingSplit, validateBody, validateStep } from '../../utils/onboardingPlan';
import { clearOnboardingDraft, readOnboardingDraft, writeOnboardingDraft } from '../../utils/onboardingDraft';
import { getPendingInvite } from '../../utils/buddyInvite';
import { buildStarterPlan, EQUIPMENT_CHOICES, starterSessionDraft } from '../../utils/starterWorkout';

const STAGES = ['Goal', 'Routine', 'Basics', 'Plan'];
const GOALS = [
    { id: 'fat_loss', title: 'Lose fat', detail: 'Build a consistent training routine around your goal.' },
    { id: 'muscle_gain', title: 'Build muscle', detail: 'Make strength training part of your week.' },
    { id: 'maintenance', title: 'Maintain', detail: 'Keep your weight steady and build a consistent routine.' },
] as const;
const ACTIVITY = [
    { id: 'sedentary', title: 'Mostly sitting', detail: 'Little movement or exercise on most days.' },
    { id: 'light', title: 'Some movement', detail: 'Mostly sitting, with walks or a few workouts.' },
    { id: 'moderate', title: 'Regularly active', detail: 'Regular workouts and movement through the day.' },
    { id: 'active', title: 'Very active', detail: 'Hard workouts and active for much of the day.' },
    { id: 'very_active', title: 'Heavy physical work', detail: 'A demanding physical job or twice-daily training.' },
] as const;

function Choice({ title, detail, selected, onPress, compact = false }: { title: string; detail?: string; selected: boolean; onPress: () => void; compact?: boolean }) {
    return <TouchableOpacity onPress={onPress} style={[s.choice, compact && s.compactChoice, selected && s.choiceSelected]} activeOpacity={0.8}
        accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ selected, checked: selected }} aria-checked={selected}>
        <View style={s.choiceText}><Text style={s.choiceTitle}>{title}</Text>{detail && <Text style={s.choiceDetail}>{detail}</Text>}</View>
        <View style={[s.radio, selected && s.radioSelected]}>{selected && <View style={s.radioDot} />}</View>
    </TouchableOpacity>;
}

function Field({ label, unit, value, onChange, placeholder, integer = false, half = false, hideLabel = false }: {
    label: string; unit: string; value: string; onChange: (value: string) => void; placeholder: string; integer?: boolean; half?: boolean; hideLabel?: boolean;
}) {
    return <View style={[s.field, half && s.halfField]}>
        {!hideLabel && <Text style={s.label}>{label}</Text>}
        <View style={s.inputRow}>
            <TextInput style={s.input} value={value} onChangeText={onChange} placeholder={placeholder}
                placeholderTextColor={colors.text.subtle} keyboardType={integer ? 'number-pad' : 'decimal-pad'}
                accessibilityLabel={label} maxLength={7} />
            <Text style={s.unit}>{unit}</Text>
        </View>
    </View>;
}

export default function OnboardingWizard() {
    const { user, completeOnboarding } = useAuth();
    const { updateWeeklyGoal, refreshToday } = useNutrition();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState<OnboardingForm>({ ...EMPTY_ONBOARDING });
    const [ready, setReady] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    const [showActivity, setShowActivity] = useState(false);
    const [showSessions, setShowSessions] = useState(false);
    const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
    const [feet, setFeet] = useState('');
    const [inches, setInches] = useState('');
    const scroll = useRef<ScrollView>(null);
    const writeQueue = useRef<Promise<unknown>>(Promise.resolve());
    const finished = useRef(false);
    const submitting = useRef(false);
    const savedSplit = useRef('');
    const savedSplitId = useRef<string | null>(null);
    const loadedAccount = useRef<string | undefined>(undefined);

    useEffect(() => {
        let active = true;
        setReady(false);
        loadedAccount.current = undefined;
        setStep(1); setForm({ ...EMPTY_ONBOARDING });
        setHeightUnit('cm'); setFeet(''); setInches(''); setError('');
        finished.current = false; savedSplit.current = ''; savedSplitId.current = null;
        const load = async () => {
            try {
                const draft = user?.id ? restoreOnboarding(await readOnboardingDraft(user.id)) : null;
                if (active && draft) { setForm(draft.form); setStep(draft.step); }
            } catch { /* A missing draft must not block setup. */ }
            finally { if (active) { loadedAccount.current = user?.id; setReady(true); } }
        };
        void load();
        return () => { active = false; loadedAccount.current = undefined; };
    }, [user?.id]);

    useEffect(() => {
        if (!ready || !user?.id || loadedAccount.current !== user.id || finished.current) return;
        const account = user.id;
        const draft = JSON.stringify({ version: 1, step, form });
        // Serialize writes so an older answer cannot overwrite a newer one.
        writeQueue.current = writeQueue.current.catch(() => {}).then(() => writeOnboardingDraft(account, draft)).catch(() => {});
    }, [ready, user?.id, step, form]);

    const back = useCallback(() => {
        if (submitting.current || step <= 1) return;
        Keyboard.dismiss(); setError(''); setStep(step === 4 && !form.nutritionEnabled ? 2 : step - 1);
        scroll.current?.scrollTo({ y: 0, animated: false });
    }, [step, form.nutritionEnabled]);
    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (submitting.current) return true;
            if (step > 1) { back(); return true; }
            return false;
        });
        return () => subscription.remove();
    }, [step, back]);

    const change = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => {
        if (submitting.current) return;
        setError(''); setForm(previous => ({ ...previous, [key]: value }));
    };
    const next = () => {
        if (submitting.current) return;
        const problem = step === 3 && form.nutritionEnabled ? heightError() || validateStep(step, form) : validateStep(step, form);
        if (problem) { setError(problem); return; }
        Keyboard.dismiss(); setError(''); setStep(step === 2 && !form.nutritionEnabled ? 4 : step + 1);
        scroll.current?.scrollTo({ y: 0, animated: false });
    };

    const bodyValid = !validateBody(form) && !!form.activity;
    const stages = form.nutritionEnabled ? STAGES : ['Goal', 'Routine', 'Plan'];
    const shownStep = !form.nutritionEnabled && step === 4 ? 3 : step;
    const weight = Number(form.weight), height = Number(form.height), age = Number(form.age);
    const energy = bodyValid ? calculateEnergy(weight, height, age, form.gender!, form.activity!) : null;
    const automaticCalories = energy && form.goal ? calculateCalories(energy.tdee, form.goal, form.gender!, weight / (height / 100) ** 2) : 0;
    const calories = form.customCalories.trim() ? Number(form.customCalories) : automaticCalories;
    const calorieValid = Number.isInteger(calories) && calories >= 800 && calories <= 8000;
    const previewCalories = calorieValid ? calories : automaticCalories;
    const macros = bodyValid ? calculateMacros(previewCalories, weight, {}, form.goal!) : null;
    const schedule = form.days ? startingSplit(form.days, form.equipment) : null;
    const trainingPlan = schedule && form.experience && form.equipment && form.sessionMinutes
        ? buildStarterPlan(schedule.days, { experience: form.experience, equipment: form.equipment, session_minutes: form.sessionMinutes }, form.nutritionEnabled && bodyValid ? age : undefined) : null;
    const split = schedule && trainingPlan ? { ...schedule, training_plan: trainingPlan } : null;
    const firstWorkout = split ? starterSessionDraft(trainingPlan, split.days[0]) : null;

    const finish = async (destination: 'workout' | 'food' | 'home') => {
        if (submitting.current) return;
        const problem = validateStep(1, form) || validateStep(2, form) || validateStep(3, form);
        if (problem) { setError(problem); return; }
        if (!split || (form.nutritionEnabled && (!calorieValid || !macros || macros.protein * 4 + macros.fat * 9 > calories))) {
            setShowDetails(true); setError('Check your calorie target. Use the starting estimate or enter a target that covers your protein and fat.'); return;
        }
        submitting.current = true; setSaving(true); setError('');
        const account = user?.id;
        const active = () => loadedAccount.current === account;
        try {
            const token = await getAuthToken();
            if (!token || !active()) throw new Error('Please sign in again to save your setup.');
            // Pin each write to the starting session. A later account must not
            // receive this account's schedule, food answers or completion flag.
            const fingerprint = JSON.stringify(split);
            if (savedSplit.current !== fingerprint) {
                const result = await workoutsAPI.saveSplit(split, token);
                if (!active()) return;
                savedSplitId.current = result.split.id;
                savedSplit.current = fingerprint;
            }
            if (form.nutritionEnabled) await nutritionAPI.updateProfile({
                weight_kg: weight, height_cm: height, age, gender: form.gender!, goal_type: form.goal!,
                activity_level: form.activity!, is_vegetarian: form.vegetarian!,
                calorie_target_mode: form.customCalories.trim() ? 'custom' : 'automatic', macro_target_mode: 'automatic',
                ...(form.customCalories.trim() ? { target_calories: calories } : {}),
            }, token);
            if (!active()) return;
            await workoutsAPI.saveTrainingPreferences({ preferences: { experience: form.experience!, equipment: form.equipment!,
                session_minutes: form.sessionMinutes!, goal_type: form.goal! }, expected_split_id: savedSplitId.current, complete_setup: true }, token);
            if (!active()) return;
            await updateWeeklyGoal(form.days!);
            if (!active() || await getAuthToken() !== token) return;
            // Refresh totals in the background. A slow, non-critical read must
            // not hold the user on setup after their plan is already saved.
            void refreshToday();
            await completeOnboarding();
            finished.current = true;
            await writeQueue.current;
            if (user?.id) await clearOnboardingDraft(user.id).catch(() => {});
            const invite = await getPendingInvite().catch(() => null);
            if (invite || user?.role === 'trainer' || user?.role === 'manager') {
                router.replace('/');
                return;
            }
            // Keep Home beneath the first action. Avoid racing Index's async
            // invite redirect against a push to the workout or food screen.
            router.replace('/(tabs)');
            if (destination === 'workout') router.push({ pathname: '/log/workout', params: { intent: JSON.stringify({
                session_label: split.days[0], emphasis: [split.days[0]], training_pattern: split.split_id,
            }) } });
            if (destination === 'food') router.push('/log/calories');
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'message' in err ? err.message : null;
            if (active()) setError(typeof message === 'string' && message.trim() ? message : 'Could not save your plan. Your answers are kept here; please try again.');
        } finally { submitting.current = false; setSaving(false); }
    };

    const toggleHeight = () => {
        if (submitting.current) return;
        setError('');
        if (heightUnit === 'cm') {
            const cm = Number(form.height);
            const total = form.height.trim() && Number.isFinite(cm) && cm > 0 ? Math.round(cm / 2.54 * 10) / 10 : 0;
            setFeet(total ? String(Math.floor(total / 12)) : '');
            setInches(total ? String(Math.round((total % 12) * 10) / 10) : '');
            setHeightUnit('ft');
        } else setHeightUnit('cm');
    };
    const heightError = () => {
        if (heightUnit !== 'ft') return null;
        const ft = Number(feet), inch = Number(inches || 0);
        if (!feet.trim() || !Number.isInteger(ft) || ft < 0) return 'Enter your height in whole feet and inches.';
        if (!Number.isFinite(inch) || inch < 0 || inch >= 12) return 'Inches must be between 0 and 11.';
        if (!form.height || Number(form.height) < 100 || Number(form.height) > 250) return 'Check your height in feet and inches (about 3 ft 3 in to 8 ft 2 in).';
        return null;
    };
    const changeImperial = (ft: string, inch: string) => {
        if (submitting.current) return;
        setFeet(ft); setInches(inch);
        const total = (Number(ft || 0) * 12 + Number(inch || 0)) * 2.54;
        change('height', (ft || inch) && Number.isFinite(total) ? String(Math.round(total * 100) / 100) : '');
    };

    return <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <ScreenBackdrop />
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.top}>
                <TouchableOpacity onPress={back} disabled={step === 1 || saving} style={s.back}
                    accessibilityRole="button" accessibilityLabel="Previous step" accessibilityState={{ disabled: step === 1 || saving }}>
                    {step > 1 && <MaterialIcons name="arrow-back" size={23} color={colors.text.primary} />}
                </TouchableOpacity>
                <Text style={s.wordmark}>fitzo</Text><Text style={s.stepCount}>{shownStep} of {stages.length}</Text>
            </View>
            <View style={s.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: stages.length, now: shownStep }} aria-valuemin={1} aria-valuemax={stages.length} aria-valuenow={shownStep} accessibilityLabel={`Setup: ${STAGES[step - 1]}`}>
                {stages.map((stage, index) => <View key={stage} style={[s.progressPart, index < shownStep && s.progressActive]} />)}
            </View>
            {!ready ? <ActivityIndicator style={s.loader} color={colors.primary} /> : <>
                <ScrollView ref={scroll} contentContainerStyle={s.content} pointerEvents={saving ? 'none' : 'auto'} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
                    <Text style={s.stage}>{STAGES[step - 1]}</Text>
                    {step === 1 && <>
                        <Text style={s.title} accessibilityRole="header">What would you like to work on?</Text>
                        <Text style={s.subtitle}>Start with one goal. You can change it as you go.</Text>
                        <View style={s.choices}>{GOALS.map(goal => <Choice key={goal.id} title={goal.title} detail={goal.detail} selected={form.goal === goal.id} onPress={() => change('goal', goal.id)} />)}</View>
                        <Text style={s.footnote}>Three short screens to start training. Food targets and health connections can wait.</Text>
                    </>}
                    {step === 2 && <>
                        <Text style={s.title} accessibilityRole="header">What fits your week?</Text>
                        <Text style={s.subtitle}>Choose a week you can keep coming back to.</Text>
                        <TrainingChoices value={form} onChange={patch => { setError(''); setForm(previous => ({ ...previous, ...patch })); }} disabled={saving} />
                    </>}
                    {step === 3 && <>
                        <Text style={s.title} accessibilityRole="header">Food targets that fit you.</Text>
                        <Text style={s.subtitle}>Your height, weight and age help estimate your daily needs.</Text>
                        <Text style={s.sectionTitle}>How active is your everyday life?</Text>
                        <Text style={s.hint}>Include work, walking and exercise—not just gym days.</Text>
                        <TouchableOpacity onPress={() => setShowActivity(!showActivity)} style={s.activitySelect} accessibilityRole="button" accessibilityLabel="Choose everyday activity" accessibilityState={{ expanded: showActivity }} aria-expanded={showActivity}>
                            <Text style={s.choiceTitle}>{ACTIVITY.find(option => option.id === form.activity)?.title || 'Choose activity level'}</Text>
                            <MaterialIcons name={showActivity ? 'expand-less' : 'expand-more'} size={22} color={colors.text.secondary} />
                        </TouchableOpacity>
                        {showActivity ? <View style={s.choices}>{ACTIVITY.map(activity => <Choice key={activity.id} title={activity.title} detail={activity.detail} selected={form.activity === activity.id} onPress={() => { change('activity', activity.id); setShowActivity(false); }} />)}</View>
                            : form.activity && <Text style={s.hint}>{ACTIVITY.find(option => option.id === form.activity)?.detail}</Text>}
                        <View style={s.heightLabel}><Text style={s.label}>Height</Text>
                            <TouchableOpacity onPress={toggleHeight} style={s.unitToggle} accessibilityRole="button" accessibilityLabel={`Height in ${heightUnit === 'cm' ? 'centimetres. Switch to feet and inches' : 'feet and inches. Switch to centimetres'}`}>
                                <Text style={s.link}>{heightUnit === 'cm' ? 'Use ft / in' : 'Use cm'}</Text>
                            </TouchableOpacity>
                        </View>
                        {heightUnit === 'cm' ? <Field hideLabel label="Height in centimetres" unit="cm" value={form.height} onChange={v => change('height', v)} placeholder="175" /> :
                            <View style={s.fieldRow}><Field label="Feet" unit="ft" value={feet} onChange={v => changeImperial(v, inches)} placeholder="5" integer half /><Field label="Inches" unit="in" value={inches} onChange={v => changeImperial(feet, v)} placeholder="9" half /></View>}
                        <View style={s.fieldRow}><Field label="Weight" unit="kg" value={form.weight} onChange={v => change('weight', v)} placeholder="70" half /><Field label="Age" unit="years" value={form.age} onChange={v => change('age', v)} placeholder="25" integer half /></View>
                        <Text style={s.sectionTitle}>Sex used for the estimate</Text><Text style={s.hint}>The calorie formula uses biological sex.</Text>
                        <View style={s.choiceRow}>{(['male', 'female'] as const).map(gender => <Choice compact key={gender} title={gender === 'male' ? 'Male' : 'Female'} selected={form.gender === gender} onPress={() => change('gender', gender)} />)}</View>
                        <Text style={s.sectionTitle}>What do you usually eat?</Text>
                        <View style={s.choiceRow}><Choice compact title="Everything" selected={form.vegetarian === false} onPress={() => change('vegetarian', false)} /><Choice compact title="Vegetarian" selected={form.vegetarian === true} onPress={() => change('vegetarian', true)} /></View>
                    </>}
                    {step === 4 && split && <>
                        <Text style={s.title} accessibilityRole="header">Your starting plan.</Text>
                        <Text style={s.subtitle}>{form.nutritionEnabled ? 'Your week and daily food targets. Adjust them as you go.' : 'A first workout to start with. Everything stays editable.'}</Text>
                        <View style={s.focusSummary}><View style={s.choiceText}><Text style={s.label}>Your focus</Text><Text style={s.choiceTitle}>{GOALS.find(goal => goal.id === form.goal)?.title}</Text></View>
                            <TouchableOpacity disabled={saving} onPress={() => { setStep(1); setError(''); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={s.edit} accessibilityRole="button" accessibilityLabel="Edit your goal"><Text style={s.link}>Edit</Text></TouchableOpacity>
                        </View>
                        <View style={s.planCard}>
                            <View style={s.cardHeading}><Text style={s.sectionTitle}>Your training week</Text><TouchableOpacity disabled={saving} onPress={() => { setStep(2); setError(''); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={s.edit} accessibilityRole="button" accessibilityLabel="Edit training routine"><Text style={s.link}>Edit</Text></TouchableOpacity></View>
                            <Text style={s.planName}>{split.name}</Text>
                            <Text style={s.firstSession}>First session: {split.days[0]}</Text>
                            <Text style={s.planName}>{EQUIPMENT_CHOICES.find(item => item.id === form.equipment)?.title} · about {form.sessionMinutes} min</Text>
                            {firstWorkout?.map(ex => <View key={ex.id} style={s.exercisePreview}><Text style={s.scheduleDay}>{ex.name}</Text><Text style={s.hint}>{ex.sets.length} sets × 10 reps{ex.is_unilateral ? ' per side' : ''}</Text></View>)}
                            <Text style={s.hint}>A starting suggestion. Choose manageable weights and adjust reps in the logger; check off sets only after doing them.</Text>
                            {form.equipment === 'bodyweight' && <Text style={s.hint}>These are floor exercises. Adding a band, weights or gym access gives you more pulling exercises.</Text>}
                            <TouchableOpacity style={s.sessionsToggle} onPress={() => setShowSessions(!showSessions)} accessibilityRole="button" accessibilityState={{ expanded: showSessions }} aria-expanded={showSessions}>
                                <Text style={s.link}>{showSessions ? 'Hide sessions' : `See all ${split.days.length} ${split.days.length === 1 ? 'session' : 'sessions'}`}</Text><MaterialIcons name={showSessions ? 'expand-less' : 'expand-more'} size={20} color={colors.text.secondary} />
                            </TouchableOpacity>
                            {showSessions && split.days.map((day, index) => <View key={`${day}_${index}`} style={s.schedule}><Text style={s.scheduleIndex}>{index + 1}</Text><Text style={s.scheduleDay}>{day}</Text></View>)}
                            <Text style={s.hint}>Leave room for rest days. The time estimate depends on your pace and breaks.</Text>
                        </View>
                        {form.nutritionEnabled && macros ? <View style={s.planCard}>
                            <View style={s.cardHeading}><Text style={s.sectionTitle}>Your daily food targets</Text><TouchableOpacity disabled={saving} onPress={() => { setStep(3); setError(''); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={s.edit} accessibilityRole="button" accessibilityLabel="Edit food basics"><Text style={s.link}>Edit</Text></TouchableOpacity></View>
                            <Text style={s.calories}>{previewCalories.toLocaleString()} <Text style={s.calorieUnit}>kcal</Text></Text>
                            {!calorieValid && <Text style={s.hint}>Custom target is incomplete. This preview shows the starting estimate.</Text>}
                            <View style={s.macroRow}>{(['protein', 'carbs', 'fat'] as const).map(macro => <View key={macro} style={s.macro}><Text style={[s.macroValue, { color: colors.macro[macro] }]}>{macros[macro]} g</Text><Text style={s.macroLabel}>{macro === 'protein' ? 'Protein' : macro === 'carbs' ? 'Carbs' : 'Fat'}</Text></View>)}</View>
                            <Text style={s.hint}>Starting estimates, not exact needs. Review them alongside your progress.</Text>
                        </View> : <TouchableOpacity style={s.activitySelect} accessibilityRole="button" accessibilityLabel="Add food targets (optional)" onPress={() => { change('nutritionEnabled', true); setStep(3); scroll.current?.scrollTo({ y: 0, animated: false }); }}><View style={s.choiceText}><Text style={s.choiceTitle}>Add food targets (optional)</Text><Text style={s.choiceDetail}>Or start training and set these up later.</Text></View><MaterialIcons name="add" size={22} color={colors.text.secondary} /></TouchableOpacity>}
                        <Text style={s.optionalNote}>Health connections are optional. You can add one later from your health report.</Text>
                    </>}
                    {step === 4 && form.nutritionEnabled && <>
                        <TouchableOpacity style={s.detailsToggle} onPress={() => setShowDetails(!showDetails)} accessibilityRole="button" accessibilityState={{ expanded: showDetails }} aria-expanded={showDetails}>
                            <Text style={s.link}>How these targets work</Text><MaterialIcons name={showDetails ? 'expand-less' : 'expand-more'} size={20} color={colors.text.secondary} />
                        </TouchableOpacity>
                        {showDetails && <View style={s.details}>
                            <Text style={s.hint}>Calories use a starting estimate from your measurements, activity and goal. Protein starts at {proteinPerKgForGoal(form.goal!)} g per kg; fat is about 30% of calories, and carbs fill the rest.</Text>
                            <Field label="Custom daily calories (optional)" unit="kcal" value={form.customCalories} onChange={v => change('customCalories', v)} placeholder={String(automaticCalories)} integer />
                            <Text style={s.hint}>Leave blank to use the estimate. You can edit individual macros later in your fitness profile.</Text>
                            <Text style={s.source} onPress={() => Linking.openURL('https://pubmed.ncbi.nlm.nih.gov/2305711/')} accessibilityRole="link">Calorie estimate source: Mifflin et al.</Text>
                        </View>}
                        <Text style={s.disclaimer}>Fitzo provides fitness estimates, not medical advice. Consult a qualified professional for individual dietary or medical needs.</Text>
                    </>}
                </ScrollView>
                <View style={s.footer}>
                    {!!error && <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>}
                    <TouchableOpacity style={[s.primaryButton, saving && s.disabled]} disabled={saving} onPress={step < 4 ? next : () => { void finish('workout'); }}
                        accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }}>
                        {saving ? <ActivityIndicator color={colors.text.dark} /> : <Text style={s.primaryText}>{step < 4 ? 'Continue' : 'Start my first workout'}</Text>}
                    </TouchableOpacity>
                    {step === 3 && <TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityLabel="Set up food later" style={s.finishLink} onPress={() => { change('nutritionEnabled', false); setStep(4); scroll.current?.scrollTo({ y: 0, animated: false }); }}><Text style={s.link}>Set up food later</Text></TouchableOpacity>}
                    {step === 4 && <View style={s.finishLinks}>
                        {form.nutritionEnabled && <TouchableOpacity disabled={saving} onPress={() => { void finish('food'); }} style={s.finishLink} accessibilityRole="button"><Text style={s.link}>Log a meal first</Text></TouchableOpacity>}
                        <TouchableOpacity disabled={saving} onPress={() => { void finish('home'); }} style={s.finishLink} accessibilityRole="button"><Text style={s.link}>Explore Fitzo first</Text></TouchableOpacity>
                    </View>}
                </View>
            </>}
        </KeyboardAvoidingView>
    </SafeAreaView>;
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, width: '100%', maxWidth: 600, alignSelf: 'center' },
    back: { width: 48, height: 48, justifyContent: 'center' }, wordmark: { flex: 1, fontFamily: typography.fontFamily.bold, color: colors.text.primary, fontSize: 24, letterSpacing: -1 },
    stepCount: { fontFamily: typography.fontFamily.regular, color: colors.text.secondary, fontSize: 13 },
    progress: { flexDirection: 'row', gap: 6, marginHorizontal: 24, marginVertical: 12, maxWidth: 552, alignSelf: 'center', width: '88%' },
    progressPart: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#252525' }, progressActive: { backgroundColor: colors.decoration.accent },
    content: { padding: 24, paddingBottom: 32, width: '100%', maxWidth: 600, alignSelf: 'center' },
    stage: { color: colors.decoration.accent, fontFamily: typography.fontFamily.medium, fontSize: 13, marginBottom: 16 },
    title: { fontFamily: typography.fontFamily.semiBold, color: colors.text.primary, fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
    subtitle: { fontFamily: typography.fontFamily.regular, color: colors.text.secondary, fontSize: 15, lineHeight: 23, marginTop: 12, marginBottom: 24 },
    choices: { gap: 10 }, choice: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#292929', backgroundColor: '#101010', minHeight: 60 },
    choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, compactChoice: { flexGrow: 1, flexBasis: 145, padding: 14, gap: 8 },
    activitySelect: { minHeight: 60, padding: 16, backgroundColor: '#101010', borderColor: '#333', borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    choiceSelected: { borderColor: colors.decoration.accent, backgroundColor: '#151811' }, choiceText: { flex: 1, minWidth: 0 },
    choiceTitle: { fontFamily: typography.fontFamily.medium, color: colors.text.primary, fontSize: 16 }, choiceDetail: { fontFamily: typography.fontFamily.regular, color: colors.text.secondary, fontSize: 13, lineHeight: 20, marginTop: 6 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#777', alignItems: 'center', justifyContent: 'center' }, radioSelected: { borderColor: colors.decoration.accent }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.decoration.accent },
    footnote: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20, marginTop: 28 },
    sectionTitle: { fontFamily: typography.fontFamily.medium, color: colors.text.primary, fontSize: 16, marginVertical: 12 }, hint: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20, marginBottom: 12 },
    dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, day: { minWidth: 48, minHeight: 48, padding: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#333', backgroundColor: '#101010' }, daySelected: { backgroundColor: colors.decoration.accent, borderColor: colors.decoration.accent },
    dayText: { fontFamily: typography.fontFamily.medium, fontSize: 18, color: colors.text.primary }, dayTextSelected: { color: colors.text.dark },
    fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, field: { marginBottom: 16 }, halfField: { flexGrow: 1, flexBasis: 130 }, label: { fontFamily: typography.fontFamily.medium, color: colors.text.secondary, fontSize: 13, marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101010', borderRadius: 12, borderWidth: 1, borderColor: '#333', paddingHorizontal: 14 }, input: { flex: 1, minWidth: 0, minHeight: 56, paddingVertical: 12, color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 20 }, unit: { fontFamily: typography.fontFamily.regular, fontSize: 13, color: colors.text.secondary },
    heightLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, unitToggle: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
    planCard: { padding: 20, marginBottom: 16, borderRadius: 18, backgroundColor: '#101010', borderWidth: 1, borderColor: '#252525' }, cardHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    focusSummary: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 20, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#252525' },
    edit: { padding: 10, minHeight: 44, justifyContent: 'center' }, planName: { fontFamily: typography.fontFamily.regular, color: colors.text.secondary, fontSize: 13, lineHeight: 20, marginBottom: 12 },
    schedule: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9 }, scheduleIndex: { fontFamily: typography.fontFamily.regular, color: colors.text.secondary, width: 20, fontSize: 13 }, scheduleDay: { flex: 1, fontFamily: typography.fontFamily.medium, color: colors.text.primary, fontSize: 15 },
    firstSession: { fontFamily: typography.fontFamily.medium, color: colors.text.primary, fontSize: 15, lineHeight: 22 }, sessionsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, marginVertical: 4 },
    exercisePreview: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#252525', marginBottom: 7 },
    calories: { color: colors.text.primary, fontFamily: typography.fontFamily.semiBold, fontSize: 36, marginVertical: 10 }, calorieUnit: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 14 },
    macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 10, marginBottom: 20 }, macro: { flexGrow: 1 }, macroValue: { fontFamily: typography.fontFamily.medium, color: colors.text.primary, fontSize: 18 }, macroLabel: { fontFamily: typography.fontFamily.regular, color: colors.text.secondary, fontSize: 13, marginTop: 6 },
    optionalNote: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20, marginVertical: 8 }, detailsToggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, details: { marginTop: 12 }, source: { color: colors.text.primary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20, textDecorationLine: 'underline', paddingVertical: 12 }, disclaimer: { fontFamily: typography.fontFamily.regular, color: colors.text.secondary, fontSize: 12, lineHeight: 19, marginTop: 12 },
    footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: colors.background, width: '100%', maxWidth: 600, alignSelf: 'center' },
    primaryButton: { minHeight: 56, padding: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary }, primaryText: { color: colors.text.dark, fontFamily: typography.fontFamily.semiBold, fontSize: 15, textAlign: 'center' },
    finishLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, finishLink: { minHeight: 48, justifyContent: 'center', paddingVertical: 12 }, link: { fontFamily: typography.fontFamily.medium, fontSize: 13, color: colors.text.primary },
    error: { color: '#FCA5A5', fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20, marginBottom: 12 }, disabled: { opacity: 0.6 }, loader: { flex: 1 },
});
