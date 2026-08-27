import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import * as Haptics from '../utils/haptics';
import { nutritionAPI } from '../services/api';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import MealBuilderSheet, { Preset } from './MealBuilderSheet';

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
const ThaliPresets: React.FC<ThaliPresetsProps> = ({ onLogged, onError }) => {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [open, setOpen] = useState<Preset | null>(null);

    useEffect(() => {
        nutritionAPI.getPresets()
            .then((r) => setPresets(r.presets ?? []))
            .catch(() => setPresets([]));
    }, []);

    if (presets.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>QUICK MEALS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {presets.map((preset) => {
                    const kcal = preset.items.reduce((s, i) => s + i.calories, 0);
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
                            <Text style={styles.name} numberOfLines={2}>{preset.name}</Text>
                            <Text style={styles.meta}>~{kcal} kcal · {preset.items.length} items</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

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
    container: { marginVertical: spacing.md },
    title: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        letterSpacing: 1.2,
        marginBottom: spacing.sm,
    },
    card: {
        width: 140,
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
