import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import * as Haptics from '../utils/haptics';
import { nutritionAPI } from '../services/api';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import MealBuilderSheet, { Preset } from './MealBuilderSheet';
import { useAuth } from '../context/AuthContext';

interface ThaliPresetsProps {
    onLogged?: (preset: Preset, totalCalories: number) => void;
    onError?: (message: string) => void;
}

/**
 * Presets are a STARTING POINT, not a shortcut.
 *
 * These used to log their whole item list on one tap. That only works if every
 * dal-chawal is the same dal-chawal, and it isn't — the roti count changes, the
 * rice gets skipped, the sabzi is different. Tapping now opens the meal builder
 * so the member adjusts quantities and drops items before anything is written.
 */
const ThaliPresets: React.FC<ThaliPresetsProps> = (props) => {
    const { user } = useAuth();
    return user ? <MealIdeas key={user.id} {...props} /> : null;
};

const MealIdeas: React.FC<ThaliPresetsProps> = ({ onLogged, onError }) => {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [open, setOpen] = useState<Preset | null>(null);
    const [diet, setDiet] = useState<'vegetarian' | 'all' | undefined>();
    const [defaultDiet, setDefaultDiet] = useState<'vegetarian' | 'all'>('all');
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setFailed(false);
        setPresets([]);
        nutritionAPI.getPresets(diet)
            .then((r) => { if (active) { setPresets(r.presets ?? []); setDefaultDiet(r.diet ?? 'all'); } })
            .catch(() => { if (active) setFailed(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [diet, retry]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>MEAL IDEAS</Text>
            <Text style={styles.hint}>Everyday food. Review portions and swaps before logging.</Text>
            <View style={styles.filters}>
                {(['all', 'vegetarian'] as const).map(value => (
                    <Pressable key={value} onPress={() => setDiet(value)} style={[styles.filter, (diet ?? defaultDiet) === value && styles.selected]} accessibilityRole="button" accessibilityState={{ selected: (diet ?? defaultDiet) === value }} accessibilityLabel={value === 'all' ? 'Show all meal ideas' : 'Show vegetarian meal ideas'}>
                        <Text style={styles.name}>{value === 'all' ? 'All meals' : 'Vegetarian'}</Text>
                    </Pressable>
                ))}
            </View>
            {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Loading meal ideas" />}
            {failed && <View><Text style={styles.hint}>Meal ideas could not load. You can still log food from search.</Text><Pressable style={styles.filter} onPress={() => setRetry(value => value + 1)} accessibilityRole="button" accessibilityLabel="Retry meal ideas"><Text style={styles.name}>Try again</Text></Pressable></View>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {presets.map((preset) => {
                    const kcal = preset.items.reduce((s, i) => s + i.calories, 0);
                    const protein = Math.round(preset.items.reduce((s, i) => s + (i.protein ?? 0), 0));
                    return (
                        <Pressable
                            key={preset.id}
                            onPress={() => {
                                Haptics.selectionAsync();
                                setOpen(preset);
                            }}
                            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                            accessibilityRole="button"
                            // "Open", not "Log" — tapping no longer writes anything.
                            accessibilityLabel={`Open ${preset.name}, about ${kcal} calories, ${preset.items.length} items to adjust`}
                        >
                            <Text style={styles.emoji}>{preset.emoji}</Text>
                            <Text style={styles.name}>{preset.name}</Text>
                            <Text style={styles.meta}>~{kcal} kcal · {protein}g protein</Text>
                            <Text style={styles.meta}>{preset.vegetarian ? 'Vegetarian' : 'Contains eggs or meat'}</Text>
                            <Text style={styles.meta}>View portions & swaps →</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
            {!loading && !failed && presets.length === 0 && <Text style={styles.hint}>No meal ideas available yet. Try food search.</Text>}

            <MealBuilderSheet
                preset={open}
                onClose={() => setOpen(null)}
                onLogged={(p, total) => onLogged?.(p, total)}
                onError={(m) => onError?.(m)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginVertical: spacing.md, paddingHorizontal: spacing.xl },
    title: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        letterSpacing: 1.2,
        marginBottom: spacing.sm,
    },
    hint: { color: colors.text.secondary, fontSize: typography.sizes.sm, lineHeight: 20, marginBottom: spacing.sm },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
    filter: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.full },
    selected: { borderColor: colors.primary, backgroundColor: colors.glass.surface },
    card: {
        width: 190,
        minHeight: 104,
        justifyContent: 'center',
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        marginRight: spacing.sm,
    },
    cardPressed: { backgroundColor: colors.glass.surfaceHover },
    emoji: { fontSize: 24, marginBottom: spacing.xs },
    name: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
    },
    meta: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
});

export default ThaliPresets;
