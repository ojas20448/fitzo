import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { caloriesAPI, CalorieEntry } from '../services/api';
import { useToast } from './Toast';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

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
                  }
                : {},
        );
    }, [entry?.id]);

    if (!entry) return null;

    const save = async () => {
        const patch: Record<string, number> = {};
        for (const m of MACROS) {
            const n = Number(draft[m.key]);
            if (!Number.isFinite(n) || n < 0) {
                toast.error('Check the numbers', `${m.label} must be 0 or more`);
                return;
            }
            patch[m.key] = Math.round(n);
        }
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
                    setBusy(true);
                    try {
                        await caloriesAPI.delete(entry.id);
                        toast.success('Deleted', 'Entry removed');
                        onChanged();
                        onClose();
                    } catch (e: any) {
                        toast.error('Could not delete', e?.message || 'Please try again');
                    } finally {
                        setBusy(false);
                    }
                },
            },
        ]);
    };

    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    <Text style={styles.name} numberOfLines={2}>{entry.food_name || 'Entry'}</Text>
                    {!!entry.serving_size && <Text style={styles.serving}>{entry.serving_size}</Text>}

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
                                        accessibilityLabel={`${m.label} in ${m.unit}`}
                                    />
                                ) : (
                                    <Text style={styles.macroValue}>
                                        {entry[m.key]} {m.unit}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>

                    <View style={styles.actions}>
                        {editing ? (
                            <>
                                <Pressable style={styles.secondary} onPress={() => setEditing(false)} disabled={busy}>
                                    <Text style={styles.secondaryText}>CANCEL</Text>
                                </Pressable>
                                <Pressable style={styles.primary} onPress={save} disabled={busy}>
                                    {busy ? <ActivityIndicator color={colors.text.primary} /> : <Text style={styles.primaryText}>SAVE</Text>}
                                </Pressable>
                            </>
                        ) : (
                            <>
                                <Pressable style={styles.danger} onPress={confirmDelete} disabled={busy}>
                                    <Text style={styles.dangerText}>DELETE</Text>
                                </Pressable>
                                <Pressable style={styles.primary} onPress={() => setEditing(true)} disabled={busy}>
                                    <Text style={styles.primaryText}>EDIT</Text>
                                </Pressable>
                            </>
                        )}
                    </View>
                </Pressable>
            </Pressable>
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
