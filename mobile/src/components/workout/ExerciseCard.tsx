import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import GlassCard from '../GlassCard';
import ExerciseDetailsModal from '../ExerciseDetailsModal';
import ExercisePreview from '../ExercisePreview';
import { ExerciseSet, UserExercise } from './types';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { useExerciseHistory } from '../../hooks/useExerciseHistory';
import { exerciseHistoryDate, latestExerciseSession } from '../../utils/exerciseHistory';
import { workoutNumber } from '../../utils/workoutNumber';

type EntryField = 'weight' | 'reps' | 'rir';
function entryError(set: ExerciseSet, field: EntryField) {
    const raw = field === 'weight' ? set.weight_kg : field === 'reps' ? set.reps : set.rir;
    if (field === 'rir' && (raw == null || String(raw).trim() === '')) return '';
    const value = workoutNumber(raw);
    if (field === 'weight') return Number.isFinite(value) && value >= 0 ? '' : 'Enter a weight. Use 0 kg for bodyweight.';
    if (field === 'reps') return Number.isInteger(value) && value > 0 ? '' : 'Enter a whole number of reps greater than 0.';
    return Number.isInteger(value) && value >= 0 && value <= 5 ? '' : 'RIR must be 0–5, or left empty.';
}

interface ExerciseCardProps {
    exercise: UserExercise;
    exerciseIndex: number;
    /** When false the RIR column is hidden entirely — it is opt-in. */
    showRir: boolean;
    onUpdateSet: (eIdx: number, sIdx: number, field: keyof ExerciseSet, value: any) => void;
    onAddSet: (eIdx: number) => void;
    onRemoveExercise: (eIdx: number) => void;
    onRemoveSet: (eIdx: number, sIdx: number) => void;
    onToggleUnilateral: (eIdx: number) => void;
    onOpenPicker: (eIdx: number, sIdx: number, type: 'weight' | 'reps' | 'rir') => void;
}

const ExerciseCard = React.memo<ExerciseCardProps>(
    ({
        exercise,
        exerciseIndex,
        showRir,
        onUpdateSet,
        onAddSet,
        onRemoveExercise,
        onRemoveSet,
        onToggleUnilateral,
        onOpenPicker,
    }) => {
        const [showDetails, setShowDetails] = useState(false);
        const [editingSets, setEditingSets] = useState(false);
        const inputs = useRef<Record<string, TextInput | null>>({});
        const [focused, setFocused] = useState('');
        const [validated, setValidated] = useState<Record<string, boolean>>({});
        const history = useExerciseHistory(exercise.name);
        const lastSession = latestExerciseSession(history.sessions);
        const handleToggleComplete = (setIndex: number, currentVal: boolean) => {
                const set = exercise.sets[setIndex];
                if (!currentVal) {
                    const fields: EntryField[] = showRir ? ['weight', 'reps', 'rir'] : ['weight', 'reps'];
                    const invalid = fields.find(field => entryError(set, field));
                    if (invalid) {
                        setValidated(current => ({ ...current, [`${set.id}:${invalid}`]: true }));
                        inputs.current[`${set.id}:${invalid}`]?.focus();
                        return;
                    }
                }
                onUpdateSet(exerciseIndex, setIndex, 'completed', !currentVal);
        };
        const blur = (id: string, field: EntryField) => { setFocused(''); setValidated(current => ({ ...current, [`${id}:${field}`]: true })); };
        const focus = (id: string, field: EntryField) => {
            const key = `${id}:${field}`;
            setFocused(key);
            // Web focus can leave the bottom of a field clipped by the scroll viewport.
            if (Platform.OS === 'web') requestAnimationFrame(() => {
                (inputs.current[key] as unknown as { scrollIntoView?: (options: object) => void })?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
            });
        };

        return (
            <GlassCard style={styles.exerciseCard}>
                {/* Exercise Header */}
                <View style={styles.cardHeader}>
                    <TouchableOpacity style={styles.exerciseHeaderInfo} onPress={() => setShowDetails(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`View ${exercise.name} demo and guide`}>
                        <ExercisePreview exercise={exercise} style={styles.exerciseThumb} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.exerciseName} numberOfLines={2}>
                                {exercise.name}
                            </Text>
                            <Text style={styles.guideLink}>Guide & history ›</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => onRemoveExercise(exerciseIndex)}
                        style={styles.removeBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${exercise.name}`}
                    >
                        <Ionicons name="trash-outline" size={19} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>

                {showDetails && <ExerciseDetailsModal exercise={exercise} onClose={() => setShowDetails(false)} onToggleUnilateral={() => onToggleUnilateral(exerciseIndex)} />}
                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={[styles.colLabel, { width: 44 }]}>SET</Text>
                    <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>{exercise.is_unilateral ? 'KG / SIDE' : 'KG'}</Text>
                    <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>{exercise.is_unilateral ? 'REPS / SIDE' : 'REPS'}</Text>
                    {showRir && <Text style={[styles.colLabel, { width: 44 }]}>RIR</Text>}
                    <Text style={[styles.colLabel, { width: 44, textAlign: 'center', letterSpacing: editingSets ? 0 : 1.5 }]}>{editingSets ? 'REMOVE' : 'DONE'}</Text>
                </View>

                {/* Set rows */}
                {exercise.sets.map((set, setIndex) => (
                    <View key={set.id}>
                    <View
                        style={[
                            styles.setRow,
                            set.completed && styles.setRowCompleted,
                            setIndex === exercise.sets.length - 1 && { borderBottomWidth: 0 },
                        ]}
                    >
                        {/* Set number */}
                        <TouchableOpacity style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => onOpenPicker(exerciseIndex, setIndex, 'weight')} accessibilityRole="button" accessibilityLabel={`Edit ${exercise.name} set ${setIndex + 1}`}>
                            <View style={styles.setBadge}>
                                <Text style={styles.setNumber}>{setIndex + 1}</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Weight cell */}
                        <TextInput ref={node => { inputs.current[`${set.id}:weight`] = node; }}
                            style={[styles.valueCell, styles.inlineInput, focused === `${set.id}:weight` && styles.inputFocused, validated[`${set.id}:weight`] && !!entryError(set, 'weight') && styles.inputError]}
                            value={set.weight_kg == null ? '' : String(set.weight_kg)}
                            onChangeText={value => onUpdateSet(exerciseIndex, setIndex, 'weight_kg', value.replace(',', '.'))}
                            keyboardType="decimal-pad" selectTextOnFocus returnKeyType="next" submitBehavior="submit"
                            placeholder="—" placeholderTextColor={colors.text.subtle}
                            onFocus={() => focus(set.id, 'weight')} onBlur={() => blur(set.id, 'weight')}
                            onSubmitEditing={() => inputs.current[`${set.id}:reps`]?.focus()}
                            accessibilityLabel={`Weight for ${exercise.name}, set ${setIndex + 1}${exercise.is_unilateral ? ' per side' : ''}`} />

                        {/* Reps cell */}
                        <TextInput ref={node => { inputs.current[`${set.id}:reps`] = node; }}
                            style={[styles.valueCell, styles.inlineInput, focused === `${set.id}:reps` && styles.inputFocused, validated[`${set.id}:reps`] && !!entryError(set, 'reps') && styles.inputError]}
                            value={set.reps == null ? '' : String(set.reps)}
                            onChangeText={value => onUpdateSet(exerciseIndex, setIndex, 'reps', value)}
                            keyboardType="number-pad" selectTextOnFocus returnKeyType={showRir || setIndex < exercise.sets.length - 1 ? 'next' : 'done'}
                            submitBehavior={showRir || setIndex < exercise.sets.length - 1 ? 'submit' : 'blurAndSubmit'}
                            placeholder="—" placeholderTextColor={colors.text.subtle}
                            onFocus={() => focus(set.id, 'reps')} onBlur={() => blur(set.id, 'reps')}
                            onSubmitEditing={() => { if (showRir) inputs.current[`${set.id}:rir`]?.focus(); else if (exercise.sets[setIndex + 1]) inputs.current[`${exercise.sets[setIndex + 1].id}:weight`]?.focus(); }}
                            accessibilityLabel={`Reps for ${exercise.name}, set ${setIndex + 1}${exercise.is_unilateral ? ' per side' : ''}`} />

                        {/* RIR cell */}
                        {showRir && (
                            <TextInput ref={node => { inputs.current[`${set.id}:rir`] = node; }}
                                style={[styles.valueCell, styles.inlineInput, focused === `${set.id}:rir` && styles.inputFocused, validated[`${set.id}:rir`] && !!entryError(set, 'rir') && styles.inputError]}
                                value={set.rir == null ? '' : String(set.rir)} onChangeText={value => onUpdateSet(exerciseIndex, setIndex, 'rir', value)}
                                keyboardType="number-pad" selectTextOnFocus placeholder="—" placeholderTextColor={colors.text.subtle}
                                accessibilityLabel={`Reps in reserve for ${exercise.name}, set ${setIndex + 1}`} accessibilityHint="Optional. Enter 0 to 5 reps left in reserve. Zero means none left."
                                returnKeyType={setIndex < exercise.sets.length - 1 ? 'next' : 'done'} submitBehavior={setIndex < exercise.sets.length - 1 ? 'submit' : 'blurAndSubmit'}
                                onFocus={() => focus(set.id, 'rir')} onBlur={() => blur(set.id, 'rir')}
                                onSubmitEditing={() => { if (exercise.sets[setIndex + 1]) inputs.current[`${exercise.sets[setIndex + 1].id}:weight`]?.focus(); }} />
                        )}

                        {/* Checkmark */}
                        {editingSets ? <TouchableOpacity
                            style={styles.setAction}
                            onPress={() => onRemoveSet(exerciseIndex, setIndex)}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${exercise.name} set ${setIndex + 1}`}
                        >
                            <Ionicons name="trash-outline" size={20} color={colors.text.secondary} />
                        </TouchableOpacity> : <TouchableOpacity
                            style={styles.setAction}
                            onPress={() => handleToggleComplete(setIndex, set.completed)}
                            accessibilityRole="checkbox"
                            accessibilityLabel={`Complete ${exercise.name} set ${setIndex + 1}`}
                            accessibilityState={{ checked: set.completed }}
                            aria-checked={set.completed}
                        >
                            <View style={[styles.checkbox, set.completed && styles.checkboxChecked]}>
                                {set.completed && (
                                    <MaterialIcons name="check" size={14} color={colors.background} />
                                )}
                            </View>
                        </TouchableOpacity>}
                    </View>
                    {(['weight', 'reps', ...(showRir ? ['rir'] : [])] as EntryField[]).map(field => validated[`${set.id}:${field}`] && entryError(set, field)
                        ? <Text key={field} style={styles.entryError} accessibilityRole="alert" accessibilityLiveRegion="polite">{entryError(set, field)}</Text> : null)}
                    {(lastSession?.sets[setIndex] || set.previous) && <View style={styles.lastSession}>
                        <Text style={styles.lastText}>{lastSession?.sets[setIndex]
                            ? `Last session: ${lastSession.sets[setIndex].weight_kg} kg × ${lastSession.sets[setIndex].reps}${lastSession.isUnilateral ? ' / side' : ''} · ${exerciseHistoryDate(lastSession.date)}`
                            : `Last session: ${set.previous}`}</Text>
                        {lastSession?.sets[setIndex] && <TouchableOpacity style={styles.useLast} disabled={set.completed || lastSession.isUnilateral !== !!exercise.is_unilateral} accessibilityRole="button" accessibilityLabel={`Use last session for ${exercise.name} set ${setIndex + 1}`} accessibilityState={{ disabled: set.completed || lastSession.isUnilateral !== !!exercise.is_unilateral }} onPress={() => {
                            onUpdateSet(exerciseIndex, setIndex, 'weight_kg', lastSession.sets[setIndex].weight_kg);
                            onUpdateSet(exerciseIndex, setIndex, 'reps', lastSession.sets[setIndex].reps);
                        }}><Text style={[styles.useText, (set.completed || lastSession.isUnilateral !== !!exercise.is_unilateral) && { opacity: 0.35 }]}>{lastSession.isUnilateral !== !!exercise.is_unilateral ? 'Different mode' : 'Use'}</Text></TouchableOpacity>}
                    </View>}
                    </View>
                ))}

                {/* Add Set */}
                <View style={styles.setTools}>
                <TouchableOpacity
                    style={styles.addSetRow}
                    onPress={() => onAddSet(exerciseIndex)}
                    activeOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={`Add set for ${exercise.name}`}
                >
                    <MaterialIcons name="add" size={16} color={colors.text.muted} />
                    <Text style={styles.addSetText}>Add Set</Text>
                </TouchableOpacity>
                {(exercise.sets.length > 0 || editingSets) && <TouchableOpacity style={styles.addSetRow} onPress={() => setEditingSets(current => !current)} accessibilityRole="button" accessibilityLabel={`${editingSets ? 'Done editing' : 'Edit sets for'} ${exercise.name}`} accessibilityState={{ expanded: editingSets }}>
                    <Ionicons name={editingSets ? 'checkmark' : 'create-outline'} size={16} color={colors.text.secondary} />
                    <Text style={styles.addSetText}>{editingSets ? 'Done editing' : 'Edit sets'}</Text>
                </TouchableOpacity>}
                </View>
            </GlassCard>
        );
    },
);

const styles = StyleSheet.create({
    inlineInput: { minWidth: 0, flexShrink: 1, color: colors.text.primary, fontFamily: typography.fontFamily.semiBold, fontSize: 16, textAlign: 'center', paddingHorizontal: spacing.xs, borderWidth: 1, borderColor: 'transparent' },
    inputFocused: { borderColor: colors.text.secondary },
    inputError: { borderColor: colors.error },
    entryError: { color: colors.error, fontFamily: typography.fontFamily.regular, fontSize: 11, lineHeight: 17, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
    guideLink: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 11, marginTop: spacing.xs },
    lastSession: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.glass.border },
    lastText: { flex: 1, fontFamily: typography.fontFamily.regular, fontSize: 10, lineHeight: 16, paddingVertical: spacing.sm, color: colors.text.muted },
    useLast: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    useText: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: 12 },
    exerciseCard: {
        padding: 0,
        marginBottom: spacing.md,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    exerciseHeaderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
    },
    exerciseThumb: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.glass.surface,
    },
    exerciseThumbPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    exerciseName: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        textTransform: 'capitalize',
    },
    targetTag: {
        alignSelf: 'flex-start',
        backgroundColor: colors.glass.surfaceHover,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 1,
        marginTop: 3,
    },
    targetTagText: {
        fontSize: 9,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    removeBtn: {
        padding: spacing.xs,
        minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    },
    unilateralPill: {
        minWidth: 44, minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.glass.border,
        marginLeft: spacing.xs,
    },
    unilateralPillActive: {
        borderColor: colors.primary,
        backgroundColor: colors.glass.surfaceLight,
    },
    unilateralPillText: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted,
        letterSpacing: 0.8,
    },
    unilateralPillTextActive: {
        color: colors.text.primary,
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    instructions: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    colLabel: {
        fontSize: 9,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.subtle,
        letterSpacing: 1.5,
    },
    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
        minHeight: 52,
    },
    setRowCompleted: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    setBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    setNumber: {
        fontSize: 10,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted,
    },
    valueCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xs,
        marginHorizontal: spacing.xs,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.sm,
        minHeight: 44,
    },
    valueCellText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    valueCellPlaceholder: {
        color: colors.text.subtle,
    },
    previousHint: {
        fontSize: 9,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.subtle,
        marginTop: 1,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: colors.text.subtle,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    addSetRow: {
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
    },
    setTools: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.glass.border },
    setAction: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    addSetText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});

export default ExerciseCard;
