import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useNutrition } from '../../context/NutritionContext';
import { workoutsAPI, getAuthToken } from '../../services/api';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import TrainingChoices, { TrainingAnswers } from '../../components/TrainingChoices';
import { colors, typography } from '../../styles/theme';
import { startingSplit, Goal } from '../../utils/onboardingPlan';
import { buildStarterPlan, SavedTrainingPreferences, SESSION_MINUTES, starterSessionDraft } from '../../utils/starterWorkout';

const GOALS = [{ id: 'fat_loss', title: 'Lose fat' }, { id: 'maintenance', title: 'Maintain' }, { id: 'muscle_gain', title: 'Build muscle' }] as const;
const EMPTY: TrainingAnswers = { days: null, experience: null, equipment: null, sessionMinutes: null };
export default function TrainingPreferencesScreen() {
    const { user } = useAuth();
    return <Editor key={user?.id ?? 'signed-out'} />;
}
function Editor() {
    const { user } = useAuth();
    const { updateWeeklyGoal } = useNutrition();
    const [answers, setAnswers] = useState<TrainingAnswers>(EMPTY);
    const [goal, setGoal] = useState<Goal | null>(null);
    const [split, setSplit] = useState<any>(null);
    const [age, setAge] = useState<number | undefined>();
    const [hasPreferences, setHasPreferences] = useState(false);
    const [replace, setReplace] = useState(false);
    const [review, setReview] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const mounted = useRef(true);
    const pending = useRef(false);
    const scroll = useRef<ScrollView>(null);

    const load = async () => {
        setLoading(true); setError('');
        try {
            const data = await workoutsAPI.getTrainingPreferences();
            if (!mounted.current) return;
            const p = data.preferences;
            setSplit(data.split); setHasPreferences(!!p); setAge(Number.isInteger(data.age) && data.age >= 14 && data.age <= 100 ? data.age : undefined);
            setLoaded(true);
            setGoal(['fat_loss', 'maintenance', 'muscle_gain'].includes(p?.goal_type) ? p.goal_type : null);
            setAnswers({ days: [1, 2, 3, 4, 5, 6].includes(data.split?.days_per_week) ? data.split.days_per_week : null,
                experience: ['new', 'returning', 'regular'].includes(p?.experience) ? p.experience : null,
                equipment: ['gym', 'dumbbells', 'bodyweight'].includes(p?.equipment) ? p.equipment : null,
                sessionMinutes: SESSION_MINUTES.includes(p?.session_minutes) ? p.session_minutes : null });
            setReplace(false); setReview(false); setConfirmRemove(false);
        } catch (e: any) { if (mounted.current) setError(e.message || 'Could not load your training preferences.'); }
        finally { if (mounted.current) setLoading(false); }
    };
    useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, []);
    const preferences: SavedTrainingPreferences | null = goal && answers.experience && answers.equipment && answers.sessionMinutes
        ? { goal_type: goal, experience: answers.experience, equipment: answers.equipment, session_minutes: answers.sessionMinutes } : null;
    const schedule = replace && answers.days ? startingSplit(answers.days, answers.equipment) : null;
    const replacement = schedule && preferences ? { ...schedule, training_plan: buildStarterPlan(schedule.days, preferences, age) } : null;
    const beginReview = () => {
        if (!preferences || (replace && !replacement)) { setError('Choose your goal, experience, equipment and session length. Choose training days to replace your routine.'); return; }
        setError(''); setMessage(''); setReview(true); scroll.current?.scrollTo({ y: 0, animated: false });
    };
    const save = async () => {
        if (!preferences || pending.current) return;
        pending.current = true; setBusy(true); setError('');
        try {
            const token = await getAuthToken();
            if (!mounted.current) return;
            if (!token || !user) throw new Error('Please sign in again to save your preferences.');
            await workoutsAPI.saveTrainingPreferences({ preferences, expected_split_id: split?.id ?? null,
                ...(replacement ? { replacement } : {}) }, token);
            if (!mounted.current) return;
            if (replacement) await updateWeeklyGoal(replacement.days_per_week);
            if (!mounted.current) return;
            await load();
            if (mounted.current) setMessage(replacement ? 'Preferences and starting routine saved.' : 'Preferences saved. Your routine is kept.');
        } catch (e: any) { if (mounted.current) setError(e.message || 'Could not save. Your choices are kept; try again.'); }
        finally { pending.current = false; if (mounted.current) setBusy(false); }
    };
    const remove = async () => {
        if (pending.current) return;
        pending.current = true; setBusy(true); setError('');
        try {
            const token = await getAuthToken();
            if (!mounted.current) return;
            if (!token || !user) throw new Error('Please sign in again to remove preferences.');
            await workoutsAPI.removeTrainingPreferences(token);
            if (!mounted.current) return;
            await load();
            if (mounted.current) setMessage('Training preferences and starting suggestions removed. Your schedule and workout history are kept.');
        } catch (e: any) { if (mounted.current) setError(e.message || 'Could not remove preferences. Try again.'); }
        finally { pending.current = false; if (mounted.current) setBusy(false); }
    };
    return <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <ScreenBackdrop />
        <View style={s.header}><TouchableOpacity style={s.back} disabled={busy} accessibilityRole="button" accessibilityLabel={review ? 'Edit preferences' : 'Back'} onPress={() => review ? setReview(false) : router.back()}><MaterialIcons name="arrow-back" size={24} color={colors.text.primary} /></TouchableOpacity><Text style={s.headerText}>Training preferences</Text></View>
        {loading ? <ActivityIndicator style={{ flex: 1 }} color={colors.primary} /> : <ScrollView ref={scroll} contentContainerStyle={s.content}>
            {!!message && <Text style={s.message} accessibilityLiveRegion="polite">{message}</Text>}
            {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
            {!!error && loaded && <TouchableOpacity style={s.secondary} disabled={busy} accessibilityRole="button" onPress={() => { void load(); }}><Text style={s.link}>Reload current routine</Text></TouchableOpacity>}
            {!loaded ? <TouchableOpacity style={s.secondary} accessibilityRole="button" onPress={() => { void load(); }}><Text style={s.link}>Reload preferences</Text></TouchableOpacity> : <View pointerEvents={busy ? 'none' : 'auto'}>
                {review ? <>
                    <Text style={s.title}>Review your changes</Text>
                    <Text style={s.body}>After you allow AI data sharing, the coach can use these preferences and your active schedule. Food targets are separate.</Text>
                    <Text style={s.summary}>{GOALS.find(item => item.id === goal)?.title} · {preferences?.experience === 'new' ? 'Just starting' : preferences?.experience === 'returning' ? 'Returning' : 'Training regularly'}</Text>
                    <Text style={s.body}>{preferences?.equipment === 'gym' ? 'Gym equipment' : preferences?.equipment === 'dumbbells' ? 'Dumbbells at home' : 'No equipment'} · about {preferences?.session_minutes} minutes</Text>
                    {replacement ? <>
                        <Text style={s.summary}>Replace with {replacement.name}</Text>
                        <Text style={s.body}>This becomes your active routine. Existing routines are retained in your saved splits. Previous workouts and weights are kept; the logger continues to prefer your previous same-day workout.</Text>
                        {replacement.days.map((day, i) => <View key={`${day}-${i}`} style={s.card}><Text style={s.summary}>{day}</Text>{starterSessionDraft(replacement.training_plan, day)?.map(ex => <Text key={ex.id} style={s.body}>{ex.name} · {ex.sets.length} × 10{ex.is_unilateral ? ' per side' : ''}</Text>)}</View>)}
                        {answers.equipment === 'bodyweight' && <Text style={s.body}>Floor exercises offer limited pulling options. A band, weights or gym access gives you more options.</Text>}
                    </> : <Text style={s.summary}>Keep {split?.name || 'your current routine'}. No exercises or schedule changes.</Text>}
                    <TouchableOpacity style={s.primary} disabled={busy} accessibilityRole="button" onPress={() => { void save(); }}><Text style={s.primaryText}>{busy ? 'Saving…' : 'Save changes'}</Text></TouchableOpacity>
                    <TouchableOpacity style={s.secondary} disabled={busy} accessibilityRole="button" onPress={() => setReview(false)}><Text style={s.link}>Edit preferences</Text></TouchableOpacity>
                </> : <>
                    <Text style={s.title}>Make training fit your week.</Text>
                    <Text style={s.body}>Adjust your starting preferences. Review a routine before replacing it.</Text>
                    <Text style={s.summary}>Your training goal</Text>
                    {GOALS.map(item => <TouchableOpacity style={[s.option, goal === item.id && s.selected]} key={item.id} disabled={busy} accessibilityRole="radio" accessibilityLabel={item.title} accessibilityState={{ checked: goal === item.id }} aria-checked={goal === item.id} onPress={() => { setGoal(item.id); setMessage(''); }}><Text style={s.link}>{item.title}</Text></TouchableOpacity>)}
                    <TrainingChoices value={answers} onChange={patch => { setAnswers(previous => ({ ...previous, ...patch })); setMessage(''); setError(''); }} disabled={busy} />
                    <Text style={s.summary}>Current routine: {split?.name || 'None saved'}</Text>
                    <Text style={s.body}>Changing days or equipment only changes the routine if you choose to replace it.</Text>
                    <TouchableOpacity style={[s.option, !replace && s.selected]} disabled={busy} accessibilityRole="radio" accessibilityLabel="Keep current routine" accessibilityState={{ checked: !replace }} aria-checked={!replace} onPress={() => setReplace(false)}><Text style={s.link}>Keep current routine</Text></TouchableOpacity>
                    <TouchableOpacity style={[s.option, replace && s.selected]} disabled={busy} accessibilityRole="radio" accessibilityLabel="Preview a replacement routine" accessibilityState={{ checked: replace }} aria-checked={replace} onPress={() => setReplace(true)}><Text style={s.link}>Preview a replacement routine</Text></TouchableOpacity>
                    <TouchableOpacity style={s.primary} disabled={busy} accessibilityRole="button" onPress={beginReview}><Text style={s.primaryText}>Review changes</Text></TouchableOpacity>
                    <Text style={s.body}>Preferences are saved in your account. The coach receives them only when you use AI features with data sharing enabled.</Text>
                    {hasPreferences && <>
                        <TouchableOpacity style={s.secondary} disabled={busy} accessibilityRole="button" onPress={() => setConfirmRemove(!confirmRemove)}><Text style={s.link}>Remove saved training preferences</Text></TouchableOpacity>
                        {confirmRemove && <View style={s.card}><Text style={s.body}>Remove your training goal, experience, equipment and time, including earlier starting exercise suggestions? Your schedule, custom routines and performed workout logs are kept. Food targets are separate.</Text><TouchableOpacity style={s.secondary} disabled={busy} accessibilityRole="button" onPress={() => { void remove(); }}><Text style={s.error}>Remove preferences and suggestions</Text></TouchableOpacity><TouchableOpacity style={s.secondary} accessibilityRole="button" onPress={() => setConfirmRemove(false)}><Text style={s.link}>Cancel</Text></TouchableOpacity></View>}
                    </>}
                </>}
            </View>}
        </ScrollView>}
    </SafeAreaView>;
}
const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 16 },
    back: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }, headerText: { flex: 1, fontFamily: typography.fontFamily.medium, color: colors.text.primary, fontSize: 18 },
    content: { padding: 24, width: '100%', maxWidth: 600, alignSelf: 'center', paddingBottom: 40 },
    title: { fontFamily: typography.fontFamily.semiBold, fontSize: 28, lineHeight: 36, color: colors.text.primary, marginBottom: 12 },
    body: { fontFamily: typography.fontFamily.regular, fontSize: 14, lineHeight: 22, color: colors.text.secondary, marginBottom: 12 },
    summary: { fontFamily: typography.fontFamily.medium, fontSize: 16, lineHeight: 24, color: colors.text.primary, marginVertical: 12 },
    option: { minHeight: 48, padding: 14, borderWidth: 1, borderColor: '#333', borderRadius: 12, backgroundColor: '#101010', marginBottom: 8 }, selected: { borderColor: colors.decoration.accent, backgroundColor: '#151811' },
    primary: { minHeight: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 14, padding: 16, backgroundColor: colors.primary, marginVertical: 16 }, primaryText: { color: colors.text.dark, fontFamily: typography.fontFamily.semiBold, fontSize: 15 },
    secondary: { minHeight: 48, paddingVertical: 12, justifyContent: 'center' }, link: { color: colors.text.primary, fontSize: 14, fontFamily: typography.fontFamily.medium },
    error: { color: '#FCA5A5', fontSize: 14, lineHeight: 22 }, message: { color: colors.decoration.accent, fontSize: 14, lineHeight: 22, marginBottom: 12 }, card: { padding: 16, borderWidth: 1, borderColor: '#333', borderRadius: 12, marginVertical: 8, backgroundColor: '#101010' },
});
