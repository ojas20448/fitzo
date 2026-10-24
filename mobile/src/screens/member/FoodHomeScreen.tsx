import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useNutrition } from '../../context/NutritionContext';
import { caloriesAPI, type CalorieDay, type CalorieEntry } from '../../services/api';
import { groupDiaryEntries, localDiaryDate, shiftDiaryDate } from '../../utils/foodDiary';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';
import { MEAL_TYPES, type MealType } from '../../utils/foodPortion';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import FoodEntrySheet from '../../components/FoodEntrySheet';
import { MemberScreen, MemberAction, memberStyles as s } from '../../components/navigation/MemberScreen';
import { useLocalDay } from '../../hooks/useLocalDay';

export default function FoodHomeScreen() {
    const { user } = useAuth();
    const { calorieGoal, macroTargets, refreshToday } = useNutrition();
    const today = useLocalDay();
    const [date, setDate] = useState(localDiaryDate);
    const previousToday = useRef(today);
    useEffect(() => {
        const previous = previousToday.current;
        previousToday.current = today;
        setDate(value => value === previous ? today : value);
    }, [today]);
    const [saved, setSaved] = useState<{ owner: string; date: string; day: CalorieDay } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [entry, setEntry] = useState<CalorieEntry | null>(null);
    const request = useRef(0);
    const load = useCallback(async () => {
        const id = ++request.current;
        if (!user?.id) { setLoading(false); return; }
        setLoading(true); setError(false);
        try {
            const day = await caloriesAPI.getDay(date);
            if (id === request.current) setSaved({ owner: user.id, date, day });
        } catch { if (id === request.current) setError(true); }
        finally { if (id === request.current) setLoading(false); }
    }, [date, user?.id]);
    useFocusEffect(useCallback(() => {
        setEntry(null); void load();
        return () => { request.current++; };
    }, [load]));
    const day = saved?.owner === user?.id && saved?.date === date ? saved.day : null;
    const addFood = (meal?: MealType) => {
        setDate(localDiaryDate());
        router.push(meal ? { pathname: '/log/calories', params: { meal_type: meal } } : '/log/calories');
    };
    const totals = day?.totals;
    const calories = Math.round(totals?.calories || 0);
    const hasTarget = date === today && calorieGoal !== null && calorieGoal > 0;
    const groups = day ? groupDiaryEntries(day.entries) : [];
    const meals = [...MEAL_TYPES.map(key => ({ key, title: key === 'snack' ? 'Snacks' : key[0].toUpperCase() + key.slice(1), entries: groups.find(group => group.key === key)?.entries || [] })), ...groups.filter(group => group.key === 'other')];
    const mealIcons = { breakfast: 'cafe-outline', lunch: 'sunny-outline', dinner: 'moon-outline', snack: 'nutrition-outline', other: 'restaurant-outline' } as const;
    return <MemberScreen title="Food" subtitle="YOUR DIARY" headerStyle={styles.header} onRefresh={() => void load()} refreshing={loading && !!day}
        headerRight={date !== today ? <Pressable accessibilityRole="button" accessibilityLabel="Go to today" style={styles.todayButton} onPress={() => setDate(localDiaryDate())}><Text style={styles.link}>Today</Text></Pressable> : undefined}>
        <View style={styles.dateRow}>
            <Pressable style={s.iconButton} accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => setDate(value => shiftDiaryDate(value, -1))}><Ionicons name="chevron-back" size={22} color={colors.primary} /></Pressable>
            <View style={styles.dateCopy}><Text style={s.title}>{date === today ? 'Today' : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}</Text><Text style={styles.dateDetail}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text></View>
            <Pressable style={s.iconButton} accessibilityRole="button" accessibilityLabel="Next day" accessibilityState={{ disabled: date >= today }} disabled={date >= today} onPress={() => setDate(value => shiftDiaryDate(value, 1))}><Ionicons name="chevron-forward" size={22} color={date >= today ? colors.text.subtle : colors.primary} /></Pressable>
        </View>
        {loading && !day ? <ActivityIndicator color={colors.primary} accessibilityLabel="Loading food diary" /> : null}
        {error ? <EmptyState variant="error" title="Could not refresh your food diary" onAction={() => void load()} /> : null}
        {day && <GlassCard style={s.card}>
            <Text style={styles.eyebrow}>DAILY NUTRITION</Text>
            <View style={styles.energyRow}><View style={s.grow}><Text style={styles.calories}>{calories.toLocaleString()} <Text style={styles.calorieUnit}>kcal</Text></Text><Text style={s.detail}>Food logged {date === today ? 'today' : 'this day'}</Text></View>
                {hasTarget && <View style={styles.targetCopy}><Text style={styles.targetValue}>{Math.abs(calorieGoal! - calories).toLocaleString()}</Text><Text style={styles.dateDetail}>{calories > calorieGoal! ? 'kcal over target' : 'kcal remaining'}</Text></View>}</View>
            {hasTarget && <View style={styles.targetBlock}>
                <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel="Daily calorie target" accessibilityValue={{ min: 0, max: calorieGoal!, now: Math.min(calorieGoal!, calories), text: `${calories} of ${calorieGoal} calories logged` }}><View style={[styles.fill, { width: `${Math.min(100, calories / calorieGoal! * 100)}%` }]} /></View>
                <Text style={styles.dateDetail}>Your target: {calorieGoal!.toLocaleString()} kcal</Text>
            </View>}
            <View style={styles.macros}>{(['protein', 'carbs', 'fat'] as const).map(macro => <View style={styles.macro} key={macro}>
                <View style={styles.macroLabel}><View style={[styles.macroDot, { backgroundColor: colors.macro[macro] }]} /><Text style={styles.dateDetail}>{macro[0].toUpperCase() + macro.slice(1)}</Text></View>
                <Text style={styles.macroValue}>{Math.round(totals?.[macro] || 0)}<Text style={styles.dateDetail}> g</Text></Text>
                {date === today && macroTargets && <Text style={styles.macroTarget}>of {macroTargets[macro]} g</Text>}
            </View>)}</View>
            {!day.entries.length && <Text style={s.detail}>No food logged for this day.</Text>}
            {calorieGoal === null && date === today ? <Button variant="ghost" title="Set up food targets" onPress={() => router.push('/member/fitness-profile')} /> : null}
        </GlassCard>}
        <Button title={date === today ? 'Add food' : 'Add food for today'} icon={<Ionicons name="add-outline" size={20} color={colors.text.dark} />} onPress={() => addFood()} fullWidth />
        {date !== today && <Text style={s.detail}>Adding food records it in today&apos;s diary. You can edit this day&apos;s saved entries below.</Text>}
        {day && <View style={styles.meals}><Text style={s.section}>Meals</Text>{meals.map(group => <GlassCard key={group.key}>
            <View style={styles.mealHeader}><View style={s.actionIcon}><Ionicons name={mealIcons[group.key]} size={20} color={colors.text.secondary} /></View><View style={s.grow}><Text style={s.title}>{group.title}</Text>{group.entries.length > 0 && <Text style={styles.dateDetail}>{Math.round(group.entries.reduce((sum, item) => sum + Number(item.calories || 0), 0))} kcal</Text>}</View>
                {group.key !== 'other' && <Pressable accessibilityRole="button" accessibilityLabel={`Add ${group.key}${date !== today ? ' for today' : ''}`} style={styles.mealAdd} onPress={() => addFood(group.key as MealType)}><Ionicons name="add-outline" size={18} color={colors.primary} /><Text style={styles.link}>{date === today ? 'Add' : 'Add for today'}</Text></Pressable>}
            </View>
            {!group.entries.length && <Text style={styles.emptyMeal}>Nothing logged yet.</Text>}
            {group.entries.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Edit ${item.food_name || 'food entry'}`} style={({ pressed }) => [styles.foodRow, pressed && s.pressed]} onPress={() => setEntry(item)}>
                <View style={s.grow}><Text style={s.title}>{item.food_name || 'Food entry'}</Text><Text style={s.detail}>{item.serving_size || 'Portion not recorded'}</Text></View>
                <Text style={styles.foodCalories}>{Math.round(item.calories)}<Text style={styles.dateDetail}> kcal</Text></Text><Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
            </Pressable>)}
        </GlassCard>)}</View>}
        <View style={styles.meals}><Text style={s.section}>Food tools</Text><GlassCard>
            <MemberAction icon="time-outline" title="Recent foods & quick add" detail="Repeat foods and your saved shortcuts" onPress={() => addFood()} />
            <MemberAction icon="book-outline" title="Recipes & saved meals" onPress={() => router.push('/member/recipes')} />
        </GlassCard></View>
        <GlassCard><MemberAction icon="stats-chart-outline" title="Nutrition details" onPress={() => router.push('/member/nutrition-insights')} /><MemberAction icon="bulb-outline" title="Ask Spotter" detail="Ask about your food or nutrition" onPress={() => router.push({ pathname: '/ai-coach', params: { source: 'food', prompt: 'Help me review my recent food logs.' } })} /></GlassCard>
        <FoodEntrySheet entry={saved?.owner === user?.id ? entry : null} onClose={() => setEntry(null)} onChanged={() => { void load(); void refreshToday(); }} />
    </MemberScreen>;
}
const styles = StyleSheet.create({
    header: { paddingTop: spacing.xs, paddingBottom: spacing.sm },
    todayButton: { minHeight: 44, minWidth: 64, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.full },
    link: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 12 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dateCopy: { flex: 1, alignItems: 'center', gap: 5 },
    dateDetail: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 18 },
    eyebrow: { color: colors.text.secondary, fontFamily: typography.fontFamily.medium, fontSize: 10, letterSpacing: 1.3 },
    energyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'center' },
    calories: { color: colors.text.primary, fontFamily: typography.fontFamily.semiBold, fontSize: 34, letterSpacing: -1 },
    calorieUnit: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, letterSpacing: 0 },
    targetCopy: { gap: spacing.xs, alignItems: 'flex-end' },
    targetValue: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 18 },
    targetBlock: { gap: spacing.sm },
    track: { height: 5, borderRadius: 3, backgroundColor: colors.glass.surfaceHover, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
    macros: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glass.border },
    macro: { flex: 1, minWidth: 64, gap: 6 },
    macroLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    macroDot: { width: 4, height: 4, borderRadius: 2 },
    macroValue: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 18 },
    macroTarget: { color: colors.text.muted, fontFamily: typography.fontFamily.regular, fontSize: 11 },
    meals: { gap: spacing.md },
    mealHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md, padding: spacing.lg },
    mealAdd: { minHeight: 44, minWidth: 54, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm },
    emptyMeal: { color: colors.text.muted, fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 18, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    foodRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', minHeight: 72, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glass.border },
    foodCalories: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 14 },
});
