import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';
import { nutritionAPI } from '../services/api';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import {
    BuilderEntry,
    PresetItem,
    entriesFromPreset,
    displayTotals,
    setQuantity,
    removeEntry,
    toLogPayload,
    QUANTITY_STEP,
    MIN_QUANTITY,
    MAX_QUANTITY,
} from '../utils/mealBuilder';

export interface Preset {
    id: string;
    name: string;
    emoji: string;
    items: PresetItem[];
}

interface Props {
    preset: Preset | null;
    onClose: () => void;
    onLogged: (preset: Preset, totalCalories: number) => void;
    onError: (message: string) => void;
}

/**
 * A preset opens here instead of logging on tap.
 *
 * One-tap logging assumed every dal-chawal was the same dal-chawal. It isn't:
 * sometimes two rotis, sometimes none, sometimes no rice at all. So the preset
 * only SEEDS this list — quantities are adjusted and items removed before
 * anything is written. Catching the difference before it becomes data beats
 * logging wrong and editing after.
 */
const MealBuilderSheet: React.FC<Props> = ({ preset, onClose, onLogged, onError }) => {
    const [entries, setEntries] = useState<BuilderEntry[]>([]);
    const [busy, setBusy] = useState(false);

    // Reseed whenever a different preset opens, so edits to the last one never
    // leak into the next.
    useEffect(() => {
        setEntries(preset ? entriesFromPreset(preset.items) : []);
        setBusy(false);
    }, [preset?.id]);

    if (!preset) return null;

    const totals = displayTotals(entries);
    const allRemoved = entries.length === 0;

    const bump = (key: string, current: number, delta: number) => {
        Haptics.selectionAsync();
        setEntries(prev => setQuantity(prev, key, current + delta));
    };

    const drop = (key: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEntries(prev => removeEntry(prev, key));
    };

    const log = async () => {
        if (busy || allRemoved) return;
        setBusy(true);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await nutritionAPI.logBulk(toLogPayload(entries));
            onLogged(preset, result?.totals?.calories ?? totals.calories);
            onClose();
        } catch (err: any) {
            // Surface the server's reason rather than a generic string — the
            // API client's interceptor has already put it on error.message.
            onError(err?.message || `Could not log ${preset.name}. Please try again.`);
            setBusy(false);
        }
    };

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
            <View style={styles.sheet}>
                <View style={styles.grabber} />

                <View style={styles.header}>
                    <Text style={styles.emoji}>{preset.emoji}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{preset.name}</Text>
                        <Text style={styles.subtitle}>Adjust before logging</Text>
                    </View>
                    <Pressable
                        onPress={onClose}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                    >
                        <MaterialIcons name="close" size={22} color={colors.text.secondary} />
                    </Pressable>
                </View>

                <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                    {entries.map(e => {
                        const atMin = e.quantity <= MIN_QUANTITY;
                        const atMax = e.quantity >= MAX_QUANTITY;
                        return (
                            <View key={e.key} style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemName} numberOfLines={1}>{e.meal_name}</Text>
                                    <Text style={styles.itemMeta}>
                                        {Math.round((e.calories || 0) * e.quantity)} kcal
                                        {e.protein ? ` · ${Math.round((e.protein || 0) * e.quantity * 10) / 10}g P` : ''}
                                    </Text>
                                </View>

                                <View style={styles.stepper}>
                                    <Pressable
                                        onPress={() => bump(e.key, e.quantity, -QUANTITY_STEP)}
                                        disabled={atMin}
                                        hitSlop={8}
                                        style={[styles.stepBtn, atMin && styles.stepBtnDisabled]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Decrease ${e.meal_name}`}
                                    >
                                        <MaterialIcons name="remove" size={18} color={atMin ? colors.text.muted : colors.text.primary} />
                                    </Pressable>

                                    <Text style={styles.qty}>{e.quantity}</Text>

                                    <Pressable
                                        onPress={() => bump(e.key, e.quantity, QUANTITY_STEP)}
                                        disabled={atMax}
                                        hitSlop={8}
                                        style={[styles.stepBtn, atMax && styles.stepBtnDisabled]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Increase ${e.meal_name}`}
                                    >
                                        <MaterialIcons name="add" size={18} color={atMax ? colors.text.muted : colors.text.primary} />
                                    </Pressable>
                                </View>

                                <Pressable
                                    onPress={() => drop(e.key)}
                                    hitSlop={10}
                                    style={styles.removeBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remove ${e.meal_name}`}
                                >
                                    <MaterialIcons name="close" size={16} color={colors.text.muted} />
                                </Pressable>
                            </View>
                        );
                    })}

                    {allRemoved && (
                        <Text style={styles.empty}>
                            Nothing left in this meal. Close and start again, or add items from search.
                        </Text>
                    )}
                </ScrollView>

                <View style={styles.footer}>
                    <View>
                        <Text style={styles.totalKcal}>{totals.calories} kcal</Text>
                        <Text style={styles.totalMacros}>
                            {totals.protein}g P · {totals.carbs}g C · {totals.fat}g F
                        </Text>
                    </View>

                    <Pressable
                        onPress={log}
                        disabled={busy || allRemoved}
                        style={[styles.logBtn, (busy || allRemoved) && styles.logBtnDisabled]}
                        accessibilityRole="button"
                        accessibilityLabel={`Log meal, ${totals.calories} calories`}
                    >
                        {busy
                            ? <ActivityIndicator color={colors.background} />
                            : <Text style={styles.logBtnText}>Log meal</Text>}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderTopWidth: 1,
        borderColor: colors.glass.border,
        paddingBottom: spacing['3xl'],
        maxHeight: '82%',
    },
    grabber: {
        width: 36, height: 4, borderRadius: borderRadius.full,
        backgroundColor: colors.glass.border,
        alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md,
    },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
    },
    emoji: { fontSize: 28 },
    title: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    subtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },
    list: { paddingHorizontal: spacing.xl },
    row: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.glass.border,
    },
    itemName: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
    },
    itemMeta: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: 2,
    },
    stepper: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.full,
        borderWidth: 1, borderColor: colors.glass.border,
        paddingHorizontal: spacing.xs, paddingVertical: 2,
    },
    stepBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    stepBtnDisabled: { opacity: 0.4 },
    qty: {
        minWidth: 26, textAlign: 'center',
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    removeBtn: { padding: spacing.xs },
    empty: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        textAlign: 'center',
        paddingVertical: spacing['2xl'],
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md,
        borderTopWidth: 1, borderTopColor: colors.glass.border,
    },
    totalKcal: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    totalMacros: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: 2,
    },
    logBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        minWidth: 130, alignItems: 'center',
    },
    logBtnDisabled: { opacity: 0.4 },
    logBtnText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.background,
    },
});

export default MealBuilderSheet;
