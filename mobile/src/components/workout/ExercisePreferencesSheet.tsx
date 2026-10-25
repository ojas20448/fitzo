import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ExercisePreference } from '../../services/api';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';
import { REST_PRESETS } from './types';
import Button from '../Button';

interface Props {
    exercise: { name: string } | null;
    preference?: ExercisePreference;
    loading: boolean;
    error: boolean;
    onRetry: () => void;
    onSave: (preference: ExercisePreference) => Promise<void>;
    onClose: () => void;
}

export default function ExercisePreferencesSheet({ exercise, preference, loading, error, onRetry, onSave, onClose }: Props) {
    const [note, setNote] = useState('');
    const [rest, setRest] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState('');
    const saving = useRef(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { setNote(preference?.note ?? ''); setRest(preference?.rest_seconds ?? null); setFailure(''); }, [exercise?.name, preference?.note, preference?.rest_seconds]);
    if (!exercise) return null;
    const close = () => { if (!saving.current) onClose(); };
    const save = async () => {
        if (saving.current || loading || error) return;
        saving.current = true; setBusy(true); setFailure('');
        try {
            await onSave({ exercise_name: exercise.name.trim().toLowerCase(), note, rest_seconds: rest });
            if (mounted.current) onClose();
        } catch (cause: any) { if (mounted.current) setFailure(cause.message || 'Could not save. Your changes are kept; try again.'); }
        finally { saving.current = false; if (mounted.current) setBusy(false); }
    };
    const disabled = busy || loading || error;
    return <Modal transparent visible animationType="slide" onRequestClose={close}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={{ flex: 1 }} accessibilityLabel="Close exercise settings" onPress={close} />
            <View style={styles.sheet} accessibilityViewIsModal><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
                <Text style={styles.title}>{exercise.name}</Text>
                <Text style={styles.detail}>Saved for this exercise across your workouts. Only you can see these settings.</Text>
                {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Loading exercise settings" />}
                {error && <View><Text style={styles.detail}>Could not load your saved settings. Retry before editing.</Text><Button variant="ghost" title="Retry" onPress={onRetry} /></View>}
                <Text style={styles.label}>Reminder</Text>
                <TextInput style={styles.input} accessibilityLabel="Exercise reminder" placeholder="Seat 4, neutral grip…" placeholderTextColor={colors.text.subtle} multiline maxLength={300} value={note} editable={!disabled} onChangeText={setNote} />
                <Text style={styles.label}>Rest after each set</Text>
                <Text style={styles.detail}>Default follows your workout rest setting. Choose a time to enable a timer for this exercise.</Text>
                <View style={styles.options}>{[null, 0, ...REST_PRESETS].map(value => <Pressable key={value ?? 'default'} style={[styles.option, rest === value && styles.selected]} accessibilityRole="radio" accessibilityLabel={value === null ? 'Use workout default' : value === 0 ? 'Rest off' : `Rest ${value} seconds`} accessibilityState={{ checked: rest === value, disabled }} disabled={disabled} onPress={() => setRest(value)}><Text style={styles.text}>{value === null ? 'Default' : value === 0 ? 'Off' : `${value}s`}</Text></Pressable>)}</View>
                {!!failure && <Text style={styles.detail} accessibilityRole="alert">{failure}</Text>}
                <Button title="Save exercise settings" loading={busy} disabled={disabled} onPress={() => void save()} />
                <Button variant="ghost" title="Cancel" disabled={busy} onPress={close} />
            </ScrollView></View>
        </KeyboardAvoidingView>
    </Modal>;
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    sheet: { maxHeight: '85%', backgroundColor: colors.background, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.glass.border },
    content: { padding: spacing.xl, paddingBottom: spacing.xl * 2, gap: spacing.md },
    title: { color: colors.text.primary, fontFamily: typography.fontFamily.semiBold, fontSize: 20 },
    label: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 14 },
    detail: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 18 },
    input: { minHeight: 88, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.md, color: colors.text.primary, fontFamily: typography.fontFamily.regular, padding: spacing.md, textAlignVertical: 'top' },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    option: { minHeight: 44, minWidth: 52, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.md },
    selected: { borderColor: colors.primary, backgroundColor: colors.glass.surfaceLight },
    text: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 13 },
});
