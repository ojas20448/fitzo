import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { caloriesAPI, CalorieEntry } from '../services/api';
import { useToast } from './Toast';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import { MEAL_TYPES, isMealType } from '../utils/foodPortion';

interface FoodEntrySheetProps {
    entry: CalorieEntry | null;
    onClose: () => void;
    onChanged: () => void;
}

const MACROS = [
    { key: 'calories' as const, label: 'Calories', unit: 'kcal' },
    { key: 'protein' as const, label: 'Protein', unit: 'g' },
    { key: 'carbs' as const, label: 'Carbs', unit: 'g' },
    { key: 'fat' as const, label: 'Fat', unit: 'g' },
];

const FoodEntrySheet: React.FC<FoodEntrySheetProps> = ({ entry, onClose, onChanged }) => {
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState<Record<string, string>>({});
    const saving = useRef(false);

    // Reset whenever a different entry opens, so a previous edit never leaks
    // into the next entry the member taps.
    useEffect(() => {
        setEditing(false);
        setDraft(
            entry
                ? {
                      calories: String(entry.calories ?? 0),
                      protein: String(entry.protein ?? 0),
                      carbs: String(entry.carbs ?? 0),
                      fat: String(entry.fat ?? 0),
                      portion: '1',
                      serving_size: entry.serving_size || '',
                      meal_type: entry.meal_type || 'snack',
                  }
                : {},
        );
    }, [entry?.id]);

    if (!entry) return null;

    const save = async () => {
        if (saving.current) return;
        if (!Number.isFinite(Number(draft.portion)) || Number(draft.portion) <= 0) {
            toast.error('Check the portion', 'The portion multiplier must be greater than zero.'); return;
        }
        const patch: Parameters<typeof caloriesAPI.update>[1] = {};
        for (const m of MACROS) {
            const n = Number(draft[m.key]);
            if (!draft[m.key]?.trim() || !Number.isFinite(n) || n < 0) {
                toast.error('Check the numbers', `${m.label} must be 0 or more`);
                return;
            }
            patch[m.key] = Math.round(n);
        }
        if (!isMealType(draft.meal_type)) { toast.error('Choose a meal', 'Select a meal for this entry.'); return; }
        patch.meal_type = draft.meal_type;
        patch.serving_size = draft.serving_size.trim();
        saving.current = true;
        setBusy(true);
        try {
            await caloriesAPI.update(entry.id, patch);
            toast.success('Updated', entry.food_name || 'Entry saved');
            onChanged();
            onClose();
        } catch (e: any) {
            // Leave the sheet open with what they typed — never discard input.
            toast.error('Could not save', e?.message || 'Please try again');
        } finally {
            saving.current = false;
            setBusy(false);
        }
    };

    const confirmDelete = () => {
        Alert.alert('Delete entry', `Remove ${entry.food_name || 'this entry'} from your log?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    if (saving.current) return;
                    saving.current = true;
                    setBusy(true);
                    try {
                        await caloriesAPI.delete(entry.id);
                        toast.success('Deleted', 'Entry removed');
                        onChanged();
                        onClose();
                    } catch (e: any) {
                        toast.error('Could not delete', e?.message || 'Please try again');
                    } finally {
                        saving.current = false;
                        setBusy(false);
                    }
                },
            },
        ]);
    };

    return (
        <Modal visible transparent animationType="slide" onRequestClose={() => { if (!saving.current) onClose(); }}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.backdrop} onPress={() => { if (!saving.current) onClose(); }}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                    <Text style={styles.name} numberOfLines={2}>{entry.food_name || 'Entry'}</Text>
                    {!!entry.serving_size && <Text style={styles.serving}>{entry.serving_size}</Text>}

                    {editing && <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                        <Text style={styles.macroLabel}>Portion multiplier</Text>
                        <TextInput style={styles.macroInput} value={draft.portion} accessibilityLabel="Portion multiplier" keyboardType="decimal-pad" editable={!busy}
                            onChangeText={value => {
                                const ratio = Number(value);
                                setDraft(current => ({ ...current, portion: value,
                                    ...(Number.isFinite(ratio) && ratio > 0 ? {
                                        ...Object.fromEntries(MACROS.map(macro => [macro.key, String(Math.round(Number(entry[macro.key] || 0) * ratio))])),
                                        serving_size: ratio === 1 ? entry.serving_size || '' : `${ratio} × ${entry.serving_size || 'original portion'}`,
                                    } : {}),
                                }));
                            }} />
                        <Text style={styles.macroLabel}>Portion description</Text>
                        <TextInput style={styles.macroInput} value={draft.serving_size} accessibilityLabel="Portion description" editable={!busy} onChangeText={value => setDraft(current => ({ ...current, serving_size: value }))} />
                        <Text style={styles.macroLabel}>Meal</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{MEAL_TYPES.map(meal => <Pressable key={meal} accessibilityRole="radio" accessibilityLabel={meal} accessibilityState={{ checked: draft.meal_type === meal }} disabled={busy} style={[styles.secondary, { flex: 0, paddingHorizontal: spacing.md, backgroundColor: draft.meal_type === meal ? colors.glass.surfaceLight : 'transparent' }]} onPress={() => setDraft(current => ({ ...current, meal_type: meal }))}><Text style={styles.secondaryText}>{meal}</Text></Pressable>)}</View>
                    </View>}
                    <View style={styles.macros}>
                        {MACROS.map((m) => (
                            <View key={m.key} style={styles.macroRow}>
                                <Text style={styles.macroLabel}>{m.label}</Text>
                                {editing ? (
                                    <TextInput
                                        style={styles.macroInput}
                                        value={draft[m.key]}
                                        onChangeText={(v) => setDraft((d) => ({ ...d, [m.key]: v }))}
                                        keyboardType="numeric"
                                        selectTextOnFocus
                                        editable={!busy}
                                        accessibilityLabel={`${m.label} in ${m.unit}`}
                                    />
                                ) : (
                                    <Text style={[styles.macroValue, { color: m.key === 'calories' ? colors.accent.orange : colors.macro[m.key] }]}>
                                        {/* protein/carbs/fat are nullable in the
                                            DB. Without `?? 0` a null renders as
                                            an empty string here while edit mode
                                            shows 0 — the same entry appearing to
                                            hold two different values. */}
                                        {entry[m.key] ?? 0} {m.unit}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>

                    <View style={styles.actions}>
                        {editing ? (
                            <>
                                <Pressable accessibilityRole="button" accessibilityLabel="Cancel food edits" style={styles.secondary} onPress={() => setEditing(false)} disabled={busy}>
                                    <Text style={styles.secondaryText}>CANCEL</Text>
                                </Pressable>
                                <Pressable accessibilityRole="button" accessibilityLabel="Save food entry" style={styles.primary} onPress={save} disabled={busy}>
                                    {busy ? <ActivityIndicator color={colors.text.primary} /> : <Text style={styles.primaryText}>SAVE</Text>}
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <Pressable accessibilityRole="button" accessibilityLabel="Delete food entry" style={styles.danger} onPress={confirmDelete} disabled={busy}>
                                    <Text style={styles.dangerText}>DELETE</Text>
                                </Pressable>
                                <Pressable accessibilityRole="button" accessibilityLabel="Edit food entry" style={styles.primary} onPress={() => setEditing(true)} disabled={busy}>
                                    <Text style={styles.primaryText}>EDIT</Text>
                                </Pressable>
                            </>
                        )}
                    </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.xl,
        borderTopWidth: 1,
        borderColor: colors.glass.border,
        maxHeight: '90%',
    },
    name: { fontSize: typography.sizes.xl, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary },
    serving: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.regular, color: colors.text.muted, marginTop: spacing.xs },
    macros: { marginTop: spacing.lg },
    macroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
    macroLabel: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.regular, color: colors.text.secondary },
    macroValue: { fontSize: typography.sizes.md, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary },
    macroInput: {
        minWidth: 90,
        textAlign: 'right',
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        borderBottomWidth: 1,
        borderColor: colors.glass.borderLight,
        paddingVertical: 2,
    },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    primary: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.glass.surfaceLight, alignItems: 'center' },
    primaryText: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.semiBold, color: colors.text.primary, letterSpacing: 1 },
    secondary: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.glass.border, alignItems: 'center' },
    secondaryText: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.semiBold, color: colors.text.muted, letterSpacing: 1 },
    danger: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.error, alignItems: 'center' },
    dangerText: { fontSize: typography.sizes.sm, fontFamily: typography.fontFamily.semiBold, color: colors.error, letterSpacing: 1 },
});

export default FoodEntrySheet;
