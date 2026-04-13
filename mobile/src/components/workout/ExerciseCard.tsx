import React, { useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import GlassCard from '../GlassCard';
import { ExerciseSet, UserExercise } from './types';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

interface ExerciseCardProps {
    exercise: UserExercise;
    exerciseIndex: number;
    onUpdateSet: (eIdx: number, sIdx: number, field: keyof ExerciseSet, value: any) => void;
    onAddSet: (eIdx: number) => void;
    onRemoveExercise: (eIdx: number) => void;
    onRemoveSet: (eIdx: number, sIdx: number) => void;
    onOpenPicker: (eIdx: number, sIdx: number, type: 'weight' | 'reps') => void;
}

const ExerciseCard = React.memo<ExerciseCardProps>(
    ({
        exercise,
        exerciseIndex,
        onUpdateSet,
        onAddSet,
        onRemoveExercise,
        onRemoveSet,
        onOpenPicker,
    }) => {
        const handleToggleComplete = useCallback(
            (setIndex: number, currentVal: boolean) => {
                onUpdateSet(exerciseIndex, setIndex, 'completed', !currentVal);
            },
            [exerciseIndex, onUpdateSet],
        );

        return (
            <GlassCard style={styles.exerciseCard}>
                {/* Exercise Header */}
                <View style={styles.cardHeader}>
                    <View style={styles.exerciseHeaderInfo}>
                        {exercise.gifUrl ? (
                            <Image
                                source={{ uri: exercise.gifUrl }}
                                style={styles.exerciseThumb}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.exerciseThumbPlaceholder}>
                                <MaterialIcons name="fitness-center" size={18} color={colors.text.muted} />
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.exerciseName} numberOfLines={1}>
                                {exercise.name}
                            </Text>
                            {exercise.target ? (
                                <View style={styles.targetTag}>
                                    <Text style={styles.targetTagText}>{exercise.target}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => onRemoveExercise(exerciseIndex)}
                        hitSlop={12}
                        style={styles.removeBtn}
                    >
                        <MaterialIcons name="delete-outline" size={18} color={colors.text.subtle} />
                    </TouchableOpacity>
                </View>

                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={[styles.colLabel, { width: 32 }]}>SET</Text>
                    <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>KG</Text>
                    <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>REPS</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Set rows */}
                {exercise.sets.map((set, setIndex) => (
                    <Pressable
                        key={set.id}
                        onLongPress={() => onRemoveSet(exerciseIndex, setIndex)}
                        delayLongPress={600}
                        style={[
                            styles.setRow,
                            set.completed && styles.setRowCompleted,
                            setIndex === exercise.sets.length - 1 && { borderBottomWidth: 0 },
                        ]}
                    >
                        {/* Set number */}
                        <View style={{ width: 32, alignItems: 'center' }}>
                            <View style={styles.setBadge}>
                                <Text style={styles.setNumber}>{setIndex + 1}</Text>
                            </View>
                        </View>

                        {/* Weight cell */}
                        <TouchableOpacity
                            style={styles.valueCell}
                            onPress={() => onOpenPicker(exerciseIndex, setIndex, 'weight')}
                            activeOpacity={0.6}
                        >
                            <Text style={[styles.valueCellText, !set.weight_kg && styles.valueCellPlaceholder]}>
                                {set.weight_kg ? `${set.weight_kg}` : '-'}
                            </Text>
                            {set.previous && (
                                <Text style={styles.previousHint}>{set.previous}</Text>
                            )}
                        </TouchableOpacity>

                        {/* Reps cell */}
                        <TouchableOpacity
                            style={styles.valueCell}
                            onPress={() => onOpenPicker(exerciseIndex, setIndex, 'reps')}
                            activeOpacity={0.6}
                        >
                            <Text style={[styles.valueCellText, !set.reps && styles.valueCellPlaceholder]}>
                                {set.reps ? `${set.reps}` : '-'}
                            </Text>
                        </TouchableOpacity>

                        {/* Checkmark */}
                        <TouchableOpacity
                            style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}
                            onPress={() => handleToggleComplete(setIndex, set.completed)}
                            hitSlop={8}
                        >
                            <View style={[styles.checkbox, set.completed && styles.checkboxChecked]}>
                                {set.completed && (
                                    <MaterialIcons name="check" size={14} color={colors.background} />
                                )}
                            </View>
                        </TouchableOpacity>
                    </Pressable>
                ))}

                {/* Add Set */}
                <TouchableOpacity
                    style={styles.addSetRow}
                    onPress={() => onAddSet(exerciseIndex)}
                    activeOpacity={0.6}
                >
                    <MaterialIcons name="add" size={16} color={colors.text.muted} />
                    <Text style={styles.addSetText}>Add Set</Text>
                </TouchableOpacity>
            </GlassCard>
        );
    },
);

const styles = StyleSheet.create({
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
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
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
        minHeight: 40,
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
    },
    addSetText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});

export default ExerciseCard;
