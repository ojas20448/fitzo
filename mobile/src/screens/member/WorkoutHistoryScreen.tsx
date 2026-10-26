import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { workoutsAPI } from '../../services/api';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import { MemberScreen, memberStyles as s } from '../../components/navigation/MemberScreen';
import { cardioEntryError, cardioSetSummary, isCardioExercise } from '../../utils/cardio';
import type { ExerciseSet } from '../../components/workout/types';

type Record = { id: string; workout_type: string; completed: boolean; exercises?: string | null };
type Day = { logged_date: string; workouts: Record[] };
function details(raw: string | null | undefined): { name: string; sets: ExerciseSet[] }[] {
    try {
        const value = JSON.parse(raw || '[]');
        return Array.isArray(value) ? value.filter(exercise => typeof exercise?.name === 'string' && Array.isArray(exercise.sets)).map(exercise => ({
            name: exercise.name, sets: exercise.sets.filter((set: any) => set && set.completed !== false && (isCardioExercise(exercise) && set.duration_minutes != null
                ? !cardioEntryError(set, 'duration') && !cardioEntryError(set, 'effort')
                : Number.isFinite(Number(set.weight_kg)) && Number(set.weight_kg) >= 0 && Number.isInteger(Number(set.reps)) && Number(set.reps) > 0)),
        })) : [];
    } catch { return []; }
}
export default function WorkoutHistoryScreen() {
    const { user } = useAuth();
    const [saved, setSaved] = useState<{ owner: string; days: Day[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [limit, setLimit] = useState(30);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    useEffect(() => { setQuery(''); }, [user?.id]);
    const request = useRef(0);
    const load = useCallback(async () => {
        const id = ++request.current;
        if (!user?.id) { setLoading(false); return; }
        setLoading(true); setError(false);
        try {
            const response = await workoutsAPI.getHistory(limit);
            if (id === request.current) setSaved({ owner: user.id, days: Array.isArray(response.history) ? response.history : [] });
        } catch { if (id === request.current) setError(true); }
        finally { if (id === request.current) setLoading(false); }
    }, [user?.id, limit]);
    useFocusEffect(useCallback(() => { setExpanded(null); void load(); return () => { request.current++; }; }, [load]));
    const days = saved && saved.owner === user?.id ? saved.days : [];
    const search = query.trim().toLowerCase().replace(/_/g, ' ');
    const visibleDays = days.map(day => ({ ...day, workouts: day.workouts.map(workout => {
        const parsed = details(workout.exercises);
        return { ...workout, parsed, setCount: parsed.reduce((count, exercise) => count + exercise.sets.length, 0) };
    }).filter(workout => !search || workout.workout_type.toLowerCase().replace(/_/g, ' ').includes(search) || workout.parsed.some(exercise => exercise.name.toLowerCase().includes(search)) || (!workout.exercises?.startsWith('[') && workout.exercises?.toLowerCase().includes(search))) })).filter(day => day.workouts.length > 0);
    const total = days.reduce((count, day) => count + day.workouts.length, 0);
    const matches = visibleDays.reduce((count, day) => count + day.workouts.length, 0);
    return <MemberScreen title="Workout history" subtitle="YOUR TRAINING" onRefresh={() => void load()} refreshing={loading && !!days.length}
        headerRight={<Pressable style={s.iconButton} accessibilityRole="button" accessibilityLabel="Close workout history" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}><Ionicons name="close-outline" size={24} color={colors.primary} /></Pressable>}>
        <View style={styles.searchBar}><Ionicons name="search-outline" size={19} color={colors.text.secondary} /><TextInput accessibilityLabel="Search workout history" placeholder="Workout or exercise" placeholderTextColor={colors.text.muted} value={query} onChangeText={setQuery} style={styles.searchInput} autoCorrect={false} returnKeyType="search" />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear workout search" style={s.iconButton} onPress={() => setQuery('')}><Ionicons name="close-circle-outline" size={20} color={colors.text.secondary} /></Pressable>}</View>
        {!loading && days.length > 0 && <Text style={styles.resultCount} accessibilityLiveRegion="polite">{search ? `${matches} matching ${matches === 1 ? 'workout' : 'workouts'}` : `${total} saved ${total === 1 ? 'workout' : 'workouts'}`} · Tap a workout to see its sets</Text>}
        {loading && !days.length ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading workout history" /> : null}
        {error ? <EmptyState variant="error" onAction={() => void load()} /> : null}
        {!loading && !error && !days.length ? <EmptyState variant="no-workouts" onAction={() => router.push({ pathname: '/log/workout', params: { start: 'empty' } })} /> : null}
        {!loading && !!days.length && !!search && !visibleDays.length && <GlassCard style={s.card}><Ionicons name="search-outline" size={24} color={colors.text.secondary} /><Text style={s.title}>No matching workouts</Text><Text style={s.detail}>Try a workout type or an exercise name.{days.length >= limit ? ' You can also load earlier workouts below.' : ''}</Text><Button title="Clear search" variant="secondary" onPress={() => setQuery('')} /></GlassCard>}
        {visibleDays.map(day => <View key={day.logged_date} style={styles.day}><Text style={styles.date}>{new Date(`${day.logged_date.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            {day.workouts.map(workout => <GlassCard key={workout.id}>
                <Pressable style={({ pressed }) => [styles.workout, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={`View ${workout.workout_type} workout`} accessibilityState={{ expanded: expanded === workout.id }} aria-expanded={expanded === workout.id} onPress={() => setExpanded(value => value === workout.id ? null : workout.id)}>
                    <View style={s.actionIcon}><Ionicons name="barbell-outline" size={22} color={colors.text.secondary} /></View><View style={s.grow}><Text style={s.title}>{workout.workout_type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())}</Text><Text style={s.detail}>{workout.parsed.length ? `${workout.parsed.length} ${workout.parsed.length === 1 ? 'exercise' : 'exercises'} · ${workout.setCount} ${workout.setCount === 1 ? 'set' : 'sets'}` : workout.completed ? 'Completed workout' : 'Saved log'}</Text></View><Ionicons name={expanded === workout.id ? 'chevron-up-outline' : 'chevron-down-outline'} size={19} color={colors.text.muted} />
                </Pressable>
                {expanded === workout.id && <View style={styles.details}>{workout.parsed.length ? workout.parsed.map((exercise, i) => <View key={i} style={styles.exercise}><Text style={s.title}>{exercise.name}</Text>{exercise.sets.length ? exercise.sets.map((set, j) => <View key={j} style={styles.set}><Text style={styles.setLabel}>Set {j + 1}</Text><Text style={styles.setValue}>{set.duration_minutes != null ? cardioSetSummary(set) : `${Number(set.weight_kg) > 0 ? `${set.weight_kg} kg × ` : ''}${set.reps} reps`}</Text></View>) : <Text style={s.detail}>No completed sets recorded.</Text>}</View>) : <Text style={s.detail}>{workout.exercises && !workout.exercises.startsWith('[') ? workout.exercises : 'No exercise details were recorded for this log.'}</Text>}</View>}
            </GlassCard>)}
        </View>)}
        {days.length >= limit ? <Button title="Show earlier workouts" variant="secondary" loading={loading} onPress={() => setLimit(value => value + 30)} /> : null}
    </MemberScreen>;
}
const styles = StyleSheet.create({
    searchBar: { minHeight: 54, paddingLeft: spacing.lg, paddingRight: spacing.xs, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.glass.borderLight, backgroundColor: colors.glass.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    searchInput: { minHeight: 52, flex: 1, minWidth: 0, color: colors.text.primary, fontSize: 14, fontFamily: typography.fontFamily.regular },
    resultCount: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 19 },
    day: { gap: spacing.md },
    date: { color: colors.text.secondary, fontFamily: typography.fontFamily.medium, fontSize: 12 },
    workout: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: 88 },
    details: { gap: spacing.xl, padding: spacing.lg, paddingTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glass.border },
    exercise: { gap: spacing.md },
    set: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
    setLabel: { color: colors.text.muted, fontFamily: typography.fontFamily.regular, fontSize: 12 },
    setValue: { color: colors.text.secondary, fontFamily: typography.fontFamily.medium, fontSize: 13 },
});
