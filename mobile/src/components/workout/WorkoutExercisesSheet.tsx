import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UserExercise } from './types';
import Button from '../Button';
import ExercisePreview from '../ExercisePreview';
import { borderRadius, colors, spacing, typography } from '../../styles/theme';

export default function WorkoutExercisesSheet({ visible, exercises, onClose, onAdd, onReplace, onRemove, onMove }: {
    visible: boolean; exercises: UserExercise[]; onClose: () => void; onAdd: () => void;
    onReplace: (index: number) => void; onRemove: (index: number) => void; onMove: (index: number, direction: -1 | 1) => void;
}) {
    const insets = useSafeAreaInsets();
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} accessibilityViewIsModal>
                <View style={styles.handle} />
                <View style={styles.header}><Text accessibilityRole="header" style={styles.heading}>Edit exercises</Text><Pressable accessibilityRole="button" accessibilityLabel="Close exercise editor" onPress={onClose} style={styles.iconButton}><Ionicons name="close-outline" size={24} color={colors.text.primary} /></Pressable></View>
                <Text style={styles.summary}>{exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} · {exercises.reduce((count, exercise) => count + exercise.sets.length, 0)} sets</Text>
                <Text style={styles.detail}>Changes apply to this workout. Your saved routine stays the same.</Text>
                <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                    {exercises.map((exercise, index) => <View key={`${exercise.id}-${index}`} style={styles.exercise}>
                        <View style={styles.nameRow}><Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text><ExercisePreview exercise={exercise} style={styles.preview} /><View style={styles.grow}><Text style={styles.name}>{exercise.name}</Text><Text style={styles.meta}>{exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}{exercise.sets.some(set => set.completed) ? ` · ${exercise.sets.filter(set => set.completed).length} done` : ''}</Text></View></View>
                        <View style={styles.controls}>
                            <Pressable accessibilityRole="button" accessibilityLabel={`Replace ${exercise.name}`} onPress={() => onReplace(index)} style={styles.textButton}><Ionicons name="swap-horizontal-outline" size={18} color={colors.text.primary} /><Text style={styles.buttonText}>Replace</Text></Pressable>
                            <View style={styles.grow} />
                            <View style={styles.moveControls}><Pressable accessibilityRole="button" accessibilityLabel={`Move ${exercise.name} up`} accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => onMove(index, -1)} style={styles.iconButton}><Ionicons name="arrow-up-outline" size={19} color={index === 0 ? colors.inactive : colors.text.secondary} /></Pressable>
                            <Pressable accessibilityRole="button" accessibilityLabel={`Move ${exercise.name} down`} accessibilityState={{ disabled: index === exercises.length - 1 }} disabled={index === exercises.length - 1} onPress={() => onMove(index, 1)} style={styles.iconButton}><Ionicons name="arrow-down-outline" size={19} color={index === exercises.length - 1 ? colors.inactive : colors.text.secondary} /></Pressable></View>
                            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${exercise.name} from workout`} onPress={() => onRemove(index)} style={styles.iconButton}><Ionicons name="trash-outline" size={19} color={colors.text.secondary} /></Pressable>
                        </View>
                    </View>)}
                    {exercises.length === 0 && <Text style={styles.empty}>Add your first exercise to build this session.</Text>}
                </ScrollView>
                <Button title="Add exercise" variant="secondary" icon={<Ionicons name="add-outline" size={20} color={colors.text.primary} />} onPress={onAdd} style={styles.add} />
                <Button title="Done" onPress={onClose} />
            </View>
        </View>
    </Modal>;
}
const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
    handle: { width: 32, height: 4, borderRadius: 2, backgroundColor: colors.glass.borderHover, alignSelf: 'center', marginBottom: spacing.lg },
    sheet: { maxHeight: '90%', width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: borderRadius['2xl'], borderTopRightRadius: borderRadius['2xl'], borderWidth: 1, borderColor: colors.glass.borderLight, padding: spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    heading: { flex: 1, fontFamily: typography.fontFamily.semiBold, fontSize: typography.sizes['2xl'], color: colors.text.primary },
    detail: { fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 20, color: colors.text.secondary, marginVertical: spacing.md },
    summary: { fontFamily: typography.fontFamily.medium, fontSize: 12, color: colors.text.secondary, marginTop: spacing.sm },
    list: { flexShrink: 1 },
    exercise: { padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderRadius: borderRadius.lg, borderColor: colors.glass.border, backgroundColor: colors.glass.surface },
    nameRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    preview: { width: 44, height: 44, borderRadius: borderRadius.md },
    meta: { fontFamily: typography.fontFamily.regular, fontSize: 11, lineHeight: 18, color: colors.text.secondary, marginTop: spacing.xs },
    number: { fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.sm, color: colors.text.muted },
    name: { fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.md, lineHeight: 21, color: colors.text.primary },
    controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
    grow: { flex: 1 },
    moveControls: { flexDirection: 'row', borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.full },
    iconButton: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
    textButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.glass.surfaceLight },
    buttonText: { fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.sm, color: colors.text.primary },
    empty: { fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.md, lineHeight: 22, color: colors.text.secondary, marginVertical: spacing['2xl'] },
    add: { marginVertical: spacing.lg },
});
