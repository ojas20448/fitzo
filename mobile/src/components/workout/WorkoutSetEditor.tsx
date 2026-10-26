import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../Button';
import ScrollWheelPicker from './ScrollWheelPicker';
import { ExerciseSet, REPS_VALUES, RIR_VALUES, WEIGHT_VALUES, SetEntryField } from './types';
import { cardioEntryError, cardioSetSummary } from '../../utils/cardio';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';
import { workoutNumber as numberValue } from '../../utils/workoutNumber';

type Field = SetEntryField;
type Values = Pick<ExerciseSet, 'weight_kg' | 'reps' | 'rir' | 'duration_minutes' | 'rpe'>;
const DURATION_VALUES = Array.from({ length: 180 }, (_, index) => index + 1);
const EFFORT_VALUES = Array.from({ length: 10 }, (_, index) => index + 1);
interface Props {
    exerciseName: string;
    setIndex: number;
    set: ExerciseSet;
    previousSet?: ExerciseSet;
    initialField: Field;
    showRir: boolean;
    isUnilateral?: boolean;
    isCardio?: boolean;
    inputMode: 'typing' | 'wheel';
    onSelectMode: (mode: 'typing' | 'wheel') => void;
    onSave: (values: Values, complete: boolean) => void;
    onClose: () => void;
}

const textValue = (value: unknown) => value == null ? '' : String(value);

export default function WorkoutSetEditor({ exerciseName, setIndex, set, previousSet, initialField, showRir, isUnilateral, isCardio, inputMode, onSelectMode, onSave, onClose }: Props) {
    const insets = useSafeAreaInsets();
    const [draft, setDraft] = useState({ weight: textValue(set.weight_kg), reps: textValue(set.reps), rir: textValue(set.rir), duration: textValue(set.duration_minutes), effort: textValue(set.rpe) });
    const [activeField, setActiveField] = useState<Field>(initialField);
    const [error, setError] = useState('');
    const inputs = useRef<Partial<Record<Field, TextInput | null>>>({});
    const saved = useRef(false);
    const fields: Field[] = isCardio ? ['duration', 'effort'] : showRir ? ['weight', 'reps', 'rir'] : ['weight', 'reps'];
    const labels = { weight: isUnilateral ? 'KG / SIDE' : 'WEIGHT · KG', reps: isUnilateral ? 'REPS / SIDE' : 'REPS', rir: 'RIR', duration: 'DURATION · MIN', effort: 'EFFORT · 1–10' };
    const inputLabels = { weight: 'Weight value', reps: 'Reps value', rir: 'Reps in reserve value', duration: 'Duration in minutes', effort: 'Effort out of 10' };
    const previousWeight = numberValue(textValue(previousSet?.weight_kg));
    const previousReps = numberValue(textValue(previousSet?.reps));
    const canCopy = isCardio ? !!previousSet && !cardioEntryError(previousSet, 'duration') : Number.isFinite(previousWeight) && previousWeight >= 0 && Number.isInteger(previousReps) && previousReps > 0;

    const edit = (field: Field, value: string) => {
        setDraft(current => ({ ...current, [field]: value }));
        setError('');
    };
    const save = (complete: boolean) => {
        if (saved.current) return;
        if (isCardio) {
            const values = { duration_minutes: draft.duration, rpe: draft.effort };
            const invalid = (['duration', 'effort'] as const).find(field => cardioEntryError(values, field));
            if (invalid) { setError(cardioEntryError(values, invalid)); setActiveField(invalid); inputs.current[invalid]?.focus(); return; }
            saved.current = true;
            onSave({ duration_minutes: numberValue(draft.duration), rpe: draft.effort.trim() === '' ? '' : numberValue(draft.effort) }, complete);
            return;
        }
        const weight = numberValue(draft.weight);
        const reps = numberValue(draft.reps);
        const rir = draft.rir.trim() === '' ? '' : numberValue(draft.rir);
        let invalid: Field | undefined;
        if (!Number.isFinite(weight) || weight < 0) { invalid = 'weight'; setError('Enter a weight. Use 0 kg for bodyweight.'); }
        else if (!Number.isInteger(reps) || reps <= 0) { invalid = 'reps'; setError('Enter a whole number of reps greater than 0.'); }
        else if (showRir && rir !== '' && (!Number.isInteger(rir) || rir < 0 || rir > 5)) { invalid = 'rir'; setError('RIR must be a whole number from 0 to 5, or left empty.'); }
        if (invalid) { setActiveField(invalid); inputs.current[invalid]?.focus(); return; }
        saved.current = true;
        onSave({ weight_kg: weight, reps, ...(showRir ? { rir } : {}) }, complete);
    };

    return (
        <Modal transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancel set editing" />
                <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} accessibilityViewIsModal>
                    <View style={styles.header}>
                        <View style={styles.heading}>
                            <Text style={styles.eyebrow}>{isCardio ? 'CARDIO · INTERVAL' : 'SET'} {setIndex + 1}{set.completed ? ' · COMPLETED' : ''}</Text>
                            <Text style={styles.title} accessibilityRole="header">{exerciseName}</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close set editor">
                            <Ionicons name="close" size={23} color={colors.text.secondary} />
                        </Pressable>
                    </View>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
                        <Text style={styles.hint}>{isCardio ? 'Log your time in minutes. Effort is optional: 1 is very easy, 10 is maximum effort.' : isUnilateral ? 'Enter weight and reps for one side. Volume counts both sides.' : 'Enter what you lifted. Use 0 kg for bodyweight.'}</Text>
                        <View style={styles.fields}>
                            {fields.map(field => (
                                <View key={field} style={styles.field}>
                                    {inputMode === 'typing' ? <>
                                        <Text style={styles.label}>{labels[field]}</Text>
                                        <TextInput
                                            ref={node => { inputs.current[field] = node; }}
                                            style={[styles.input, activeField === field && styles.inputActive]}
                                            value={draft[field]}
                                            onChangeText={value => edit(field, value)}
                                            onFocus={() => setActiveField(field)}
                                            autoFocus={field === initialField}
                                            selectTextOnFocus
                                            keyboardType={field === 'weight' || field === 'duration' ? 'decimal-pad' : 'number-pad'}
                                            accessibilityLabel={inputLabels[field]}
                                            placeholder={field === 'rir' || field === 'effort' ? '—' : '0'}
                                            placeholderTextColor={colors.text.subtle}
                                            returnKeyType={field === fields[fields.length - 1] ? 'done' : 'next'}
                                            submitBehavior={field === fields[fields.length - 1] ? 'blurAndSubmit' : 'submit'}
                                            onSubmitEditing={() => {
                                                const next = fields[fields.indexOf(field) + 1];
                                                if (next) inputs.current[next]?.focus(); else save(false);
                                            }}
                                        />
                                    </> : <Pressable style={[styles.wheelTab, activeField === field && styles.inputActive]} onPress={() => setActiveField(field)} accessibilityRole="tab" accessibilityLabel={inputLabels[field]} accessibilityState={{ selected: activeField === field }}>
                                        <Text style={styles.label}>{labels[field]}</Text>
                                        <Text style={styles.wheelValue}>{draft[field] || '—'}</Text>
                                    </Pressable>}
                                </View>
                            ))}
                        </View>
                        {inputMode === 'wheel' && <ScrollWheelPicker values={activeField === 'duration' ? DURATION_VALUES : activeField === 'effort' ? EFFORT_VALUES : activeField === 'weight' ? WEIGHT_VALUES : activeField === 'rir' ? RIR_VALUES : REPS_VALUES}
                            selectedValue={Number.isFinite(numberValue(draft[activeField])) ? numberValue(draft[activeField]) : 0}
                            onValueChange={value => edit(activeField, String(value))} />}
                        <View style={styles.tools}>
                            {canCopy && <Pressable style={styles.tool} onPress={() => { setDraft(current => ({ ...current, ...(isCardio ? { duration: textValue(previousSet!.duration_minutes) } : { weight: textValue(previousSet!.weight_kg), reps: textValue(previousSet!.reps) }) })); setError(''); }} accessibilityRole="button" accessibilityLabel="Copy previous set">
                                <Ionicons name="copy-outline" size={17} color={colors.text.secondary} />
                                <View style={styles.heading}>
                                    <Text style={styles.toolText}>Copy previous set</Text>
                                    <Text style={styles.copyHint}>{isCardio ? cardioSetSummary({ duration_minutes: previousSet!.duration_minutes }) : `${previousWeight} kg × ${previousReps}${isUnilateral ? ' / side' : ''}`}</Text>
                                </View>
                            </Pressable>}
                            <Pressable style={styles.tool} onPress={() => onSelectMode(inputMode === 'typing' ? 'wheel' : 'typing')} accessibilityRole="button" accessibilityLabel={inputMode === 'typing' ? 'Use scroll wheel' : 'Type a value'}>
                                <Ionicons name={inputMode === 'typing' ? 'swap-vertical-outline' : 'keypad-outline'} size={17} color={colors.text.secondary} />
                                <Text style={styles.toolText}>{inputMode === 'typing' ? 'Use wheel' : 'Type values'}</Text>
                            </Pressable>
                        </View>
                        {showRir && !isCardio && <Text style={styles.hint}>RIR is optional: 0 means no reps left in reserve.</Text>}
                        {!!error && <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text>}
                    </ScrollView>
                    <View style={styles.footer}>
                        <Button title={set.completed ? 'Save changes' : 'Mark set complete'} onPress={() => save(!set.completed)} fullWidth />
                        {!set.completed && <Button title="Save without completing" variant="ghost" onPress={() => save(false)} fullWidth />}
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.glass.border, paddingTop: spacing.lg },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    heading: { flex: 1, minWidth: 0 },
    eyebrow: { fontFamily: typography.fontFamily.medium, fontSize: 10, color: colors.text.muted, letterSpacing: 1, marginBottom: spacing.xs },
    title: { fontFamily: typography.fontFamily.semiBold, fontSize: 18, color: colors.text.primary },
    close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    body: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
    hint: { fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 18, color: colors.text.muted },
    fields: { flexDirection: 'row', gap: spacing.sm },
    field: { flex: 1, minWidth: 0 },
    label: { fontFamily: typography.fontFamily.medium, fontSize: 9, letterSpacing: 0.6, color: colors.text.muted, marginBottom: spacing.sm },
    input: { minWidth: 0, minHeight: 60, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.md, backgroundColor: colors.glass.surface, padding: spacing.sm, color: colors.text.primary, fontFamily: typography.fontFamily.semiBold, fontSize: 28, textAlign: 'center' },
    inputActive: { borderColor: colors.text.secondary },
    wheelTab: { minHeight: 80, padding: spacing.sm, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
    wheelValue: { fontFamily: typography.fontFamily.semiBold, fontSize: 22, color: colors.text.primary },
    tools: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: spacing.lg },
    tool: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingVertical: spacing.xs },
    toolText: { fontFamily: typography.fontFamily.medium, fontSize: 12, color: colors.text.secondary },
    copyHint: { fontFamily: typography.fontFamily.regular, fontSize: 11, color: colors.text.muted, marginTop: 2 },
    error: { fontFamily: typography.fontFamily.medium, fontSize: 12, lineHeight: 18, color: colors.error },
    footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.glass.border },
});
