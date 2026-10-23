import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from '../utils/haptics';
import { nutritionAPI, getAuthToken } from '../services/api';
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
    portionLabel,
    substituteEntry,
} from '../utils/mealBuilder';

export interface Preset {
    id: string;
    name: string;
    emoji: string;
    items: PresetItem[];
    description?: string;
    vegetarian?: boolean;
    meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
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
    const [swapping, setSwapping] = useState<string | null>(null);
    const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('snack');
    const [sessionReady, setSessionReady] = useState(false);
    const [sessionChecked, setSessionChecked] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const expectedToken = useRef<string | null>(null);
    const saving = useRef(false);
    const generation = useRef(0);

    // Reseed whenever a different preset opens, so edits to the last one never
    // leak into the next.
    useEffect(() => {
        setEntries(preset ? entriesFromPreset(preset.items) : []);
        setBusy(false);
        setSwapping(null);
        setFailure(null);
        setMealType(preset?.meal_type ?? 'snack');
        setSessionReady(false);
        setSessionChecked(false);
        expectedToken.current = null;
        saving.current = false;
        const current = ++generation.current;
        if (preset) getAuthToken().then(token => {
            if (generation.current === current) {
                expectedToken.current = token;
                setSessionReady(Boolean(token));
                setSessionChecked(true);
            }
        }).catch(() => { if (generation.current === current) setSessionChecked(true); });
        return () => { generation.current = current + 1; };
    }, [preset]);

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
        if (saving.current || allRemoved || !expectedToken.current) return;
        saving.current = true;
        setBusy(true);
        setFailure(null);
        const current = generation.current;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await nutritionAPI.logBulk(toLogPayload(entries), mealType, expectedToken.current);
            if (generation.current !== current) return;
            onLogged(preset, result?.totals?.calories ?? totals.calories);
            onClose();
        } catch (err: any) {
            // Surface the server's reason rather than a generic string — the
            // API client's interceptor has already put it on error.message.
            if (generation.current !== current) return;
            const message = err?.message || `Could not log ${preset.name}. Please try again.`;
            setFailure(message);
            onError(message);
            saving.current = false;
            setBusy(false);
        }
    };

    return (
        <Modal visible transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
            <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
            <View style={styles.sheet}>
                <View style={styles.grabber} />

                <View style={styles.header}>
                    <Text style={styles.emoji}>{preset.emoji}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{preset.name}</Text>
                        <Text style={styles.subtitle}>Adjust portions before logging</Text>
                    </View>
                    <Pressable
                        onPress={busy ? undefined : onClose}
                        disabled={busy}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                    >
                        <MaterialIcons name="close" size={22} color={colors.text.secondary} />
                    </Pressable>
                </View>

                <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                    {preset.description && <Text style={styles.description}>{preset.description}</Text>}
                    <Text style={styles.description}>Ready-to-eat portions. Calories are estimates; recipes and oil vary. A swap changes the totals.</Text>
                    <View style={styles.mealTypes}>
                        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(type => (
                            <Pressable key={type} disabled={busy} onPress={() => setMealType(type)} style={[styles.mealType, mealType === type && styles.selectedType]} accessibilityRole="button" accessibilityState={{ selected: mealType === type, disabled: busy }} aria-pressed={mealType === type} accessibilityLabel={`Log as ${type}`}>
                                <Text style={[styles.itemMeta, mealType === type && { color: colors.text.dark }]}>{type === 'snack' ? 'Snacks' : type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                            </Pressable>
                        ))}
                    </View>
                    {!sessionReady && <Text style={styles.description}>{sessionChecked ? 'Sign in again to log this meal. Your portions are kept.' : 'Connecting to your account…'}</Text>}
                    {failure && <Text style={styles.description} accessibilityRole="alert">{failure} Your portions and swaps are kept.</Text>}
                    {entries.map(e => {
                        const atMin = e.quantity <= MIN_QUANTITY;
                        const atMax = e.quantity >= MAX_QUANTITY;
                        return (
                            <View key={e.key} style={styles.row}>
                                <View style={styles.itemHeader}>
                                <View style={{ minWidth: 0, paddingRight: 40 }}>
                                    <Text style={styles.itemName}>{e.meal_name}</Text>
                                    <Text style={styles.portion}>{portionLabel(e)}</Text>
                                    <Text style={styles.itemMeta}>
                                        {Math.round((e.calories || 0) * e.quantity)} kcal
                                        {e.protein ? ` · ${Math.round((e.protein || 0) * e.quantity * 10) / 10}g protein` : ''}
                                    </Text>
                                </View>

                                <View style={styles.controls}>
                                <View style={styles.stepper}>
                                    <Pressable
                                        onPress={() => bump(e.key, e.quantity, -QUANTITY_STEP)}
                                        disabled={atMin || busy}
                                        hitSlop={8}
                                        style={[styles.stepBtn, atMin && styles.stepBtnDisabled]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Decrease ${e.meal_name}`}
                                    >
                                        <MaterialIcons name="remove" size={18} color={atMin ? colors.text.muted : colors.text.primary} />
                                    </Pressable>

                                    <Text style={styles.qty}>{e.quantity}×</Text>

                                    <Pressable
                                        onPress={() => bump(e.key, e.quantity, QUANTITY_STEP)}
                                        disabled={atMax || busy}
                                        hitSlop={8}
                                        style={[styles.stepBtn, atMax && styles.stepBtnDisabled]}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Increase ${e.meal_name}`}
                                    >
                                        <MaterialIcons name="add" size={18} color={atMax ? colors.text.muted : colors.text.primary} />
                                    </Pressable>
                                </View>
                                {!!e.alternatives?.length && (
                                    <Pressable disabled={busy} onPress={() => setSwapping(swapping === e.key ? null : e.key)} style={styles.swapButton} accessibilityRole="button" accessibilityLabel={`Swap ${e.meal_name}`} accessibilityState={{ expanded: swapping === e.key }}>
                                        <Text style={styles.swapText}>{swapping === e.key ? 'Keep food' : 'Swap food'}</Text>
                                    </Pressable>
                                )}
                                </View>

                                <Pressable
                                    onPress={() => drop(e.key)}
                                    disabled={busy}
                                    hitSlop={10}
                                    style={styles.removeBtn}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remove ${e.meal_name}`}
                                >
                                    <MaterialIcons name="close" size={16} color={colors.text.muted} />
                                </Pressable>
                                </View>
                                {swapping === e.key && e.alternatives?.map(choice => (
                                    <Pressable key={choice.meal_name} disabled={busy} style={styles.choice} accessibilityRole="button" accessibilityLabel={`Use ${choice.meal_name}`} onPress={() => { setEntries(prev => substituteEntry(prev, e.key, choice)); setSwapping(null); }}>
                                        <Text style={styles.itemName}>{choice.meal_name}</Text>
                                        <Text style={styles.portion}>{portionLabel({ ...choice, key: '', quantity: 1 })} · ~{choice.calories} kcal</Text>
                                    </Pressable>
                                ))}
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
                        <Text style={styles.totalKcal}>~{totals.calories} kcal</Text>
                        <Text style={styles.totalMacros}>
                            Protein <Text style={{ color: colors.macro.protein }}>{totals.protein}g</Text> · Carbs <Text style={{ color: colors.macro.carbs }}>{totals.carbs}g</Text> · Fat <Text style={{ color: colors.macro.fat }}>{totals.fat}g</Text>
                        </Text>
                    </View>

                    <Pressable
                        onPress={log}
                        disabled={busy || allRemoved || !sessionReady}
                        style={[styles.logBtn, (busy || allRemoved || !sessionReady) && styles.logBtnDisabled]}
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
        paddingVertical: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.glass.border,
    },
    itemHeader: { gap: spacing.sm },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
    description: { color: colors.text.secondary, fontSize: typography.sizes.sm, lineHeight: 20, marginBottom: spacing.sm },
    portion: { color: colors.text.secondary, fontSize: typography.sizes.sm, lineHeight: 20, marginTop: 4 },
    mealTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    mealType: { minHeight: 44, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.glass.border },
    selectedType: { borderColor: colors.primary, backgroundColor: colors.primary },
    swapButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
    swapText: { color: colors.primary, fontSize: typography.sizes.sm },
    choice: { padding: spacing.sm, minHeight: 44, marginBottom: spacing.xs, borderRadius: borderRadius.md, backgroundColor: colors.glass.surface },
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
        alignSelf: 'flex-start',
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.full,
        borderWidth: 1, borderColor: colors.glass.border,
        paddingHorizontal: spacing.xs, paddingVertical: 2,
    },
    stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    stepBtnDisabled: { opacity: 0.4 },
    qty: {
        minWidth: 26, textAlign: 'center',
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    removeBtn: { padding: spacing.xs, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'absolute', right: 0, top: 0 },
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
        flexWrap: 'wrap',
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
