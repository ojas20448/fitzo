import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { nutritionAPI } from '../services/api';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

interface PresetItem {
    meal_name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
}

interface Preset {
    id: string;
    name: string;
    emoji: string;
    items: PresetItem[];
}

interface ThaliPresetsProps {
    onLogged?: (preset: Preset, totalCalories: number) => void;
}

const ThaliPresets: React.FC<ThaliPresetsProps> = ({ onLogged }) => {
    const [presets, setPresets] = useState<Preset[]>([]);
    const [pending, setPending] = useState<string | null>(null);

    useEffect(() => {
        nutritionAPI.getPresets()
            .then((r) => setPresets(r.presets ?? []))
            .catch(() => setPresets([]));
    }, []);

    const logPreset = async (preset: Preset) => {
        if (pending) return;
        setPending(preset.id);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await nutritionAPI.logBulk(preset.items);
            onLogged?.(preset, result?.totals?.calories ?? 0);
        } catch {
            // Surfaced by the caller's toast; nothing useful to do here.
        } finally {
            setPending(null);
        }
    };

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
                            onPress={() => logPreset(preset)}
                            disabled={pending !== null}
                            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                            accessibilityRole="button"
                            accessibilityLabel={`Log ${preset.name}, ${kcal} calories`}
                        >
                            {pending === preset.id ? (
                                <ActivityIndicator color={colors.text.primary} />
                            ) : (
                                <>
                                    <Text style={styles.emoji}>{preset.emoji}</Text>
                                    <Text style={styles.name} numberOfLines={2}>{preset.name}</Text>
                                    <Text style={styles.meta}>{kcal} kcal · {preset.items.length} items</Text>
                                </>
                            )}
                        </Pressable>
                    );
                })}
            </ScrollView>
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
