import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../styles/theme';
import Button from './Button';
import { defaultExercises } from '../data/defaultExercises';
import techniqueGuides from '../data/exerciseTechniqueGuides.json';
import ExercisePreview from './ExercisePreview';
import { useExerciseHistory } from '../hooks/useExerciseHistory';
import { exerciseHistoryDate } from '../utils/exerciseHistory';
import { cardioSetSummary, isCardioExercise } from '../utils/cardio';

interface Props {
    exercise: { id?: string; name: string; gifUrl?: string | null; instructions?: string | string[]; description?: string; is_unilateral?: boolean; bodyPart?: string; target?: string; equipment?: string };
    onClose: () => void;
    onToggleUnilateral?: () => void;
    onAdd?: () => void;
    addLabel?: string;
}

export default function ExerciseDetailsModal({ exercise, onClose, onToggleUnilateral, onAdd, addLabel = 'Add to workout' }: Props) {
    const [tab, setTab] = useState<'guide' | 'history'>('guide');
    const history = useExerciseHistory(exercise.name, tab === 'history');
    const local = defaultExercises.find(item => item.id === exercise.id || item.name.toLowerCase() === exercise.name.toLowerCase());
    const catalogGuide = (techniqueGuides as Record<string, string[]>)[local?.id || exercise.id || '']?.join('\n\n');
    const fallbackGuide = local?.instructions || catalogGuide;
    const instructions = Array.isArray(exercise.instructions) ? exercise.instructions.join('\n\n') : exercise.instructions || exercise.description;
    const prescriptionOnly = !!instructions && /working sets|tempo\s+\d/i.test(instructions);
    const workoutNotes = instructions ? [...new Set(instructions.split(/\.\s+/))].join('. ') : '';
    const guide = prescriptionOnly ? fallbackGuide : instructions || fallbackGuide;
    const steps = guide?.split(/\n\s*\n|\n(?=\d+[.)])/).map(step => step.trim()).filter(Boolean) || [];
    return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title} accessibilityRole="header">{exercise.name}</Text>
                <TouchableOpacity style={styles.close} accessibilityRole="button" accessibilityLabel="Close exercise details" onPress={onClose}>
                    <Ionicons name="close-outline" size={24} color={colors.text.primary} />
                </TouchableOpacity>
            </View>
            <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel="Exercise details">
                {(['guide', 'history'] as const).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityLabel={item === 'guide' ? 'Guide' : 'History'} accessibilityState={{ selected: tab === item }} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabSelected]}><Text style={[styles.tabText, tab === item && styles.tabTextSelected]}>{item === 'guide' ? 'Guide' : 'History'}</Text></Pressable>)}
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {tab === 'history' ? <>
                    <Text style={styles.sectionTitle}>Your recent sets</Text>
                    <Text style={styles.body}>{isCardioExercise(exercise) ? 'From your last 90 logged days. Time and effort are shown as recorded.' : 'From your last 90 logged days. Weight and reps are shown exactly as recorded.'}</Text>
                    {history.loading ? <ActivityIndicator accessibilityLabel="Loading exercise history" color={colors.text.secondary} />
                        : history.error ? <View style={styles.notes}><Text style={styles.body}>Could not load your history. Your current workout is safe.</Text><Button title="Retry history" variant="secondary" onPress={history.retry} /></View>
                        : history.sessions.length === 0 ? <View style={styles.notes}><Text style={styles.trackingTitle}>No recent sets yet</Text><Text style={styles.body}>Complete and save this exercise to see it here. Older sets may be outside this history window.</Text></View>
                        : history.sessions.map(session => <View key={session.id} style={styles.historyCard}>
                            <View style={styles.historyHeading}><Text style={styles.trackingTitle}>{exerciseHistoryDate(session.date)}</Text><Text style={styles.body}>{session.workout}</Text></View>
                            <Text style={styles.body}>{session.isCardio ? 'Cardio' : session.isUnilateral ? 'Weight and reps per side' : 'Whole movement'}</Text>
                            {session.sets.map((set, index) => <View key={index} style={styles.historySet}><Text style={styles.body}>Set {index + 1}</Text><Text style={styles.historyValue}>{set.duration_minutes != null ? cardioSetSummary(set) : `${set.weight_kg} kg × ${set.reps}${set.rir !== undefined ? ` · ${set.rir} RIR` : ''}`}</Text></View>)}
                        </View>)}
                </> : <>
                <ExercisePreview exercise={exercise} large />
                <View style={styles.guide}>
                    <View style={styles.sectionHeading}><Ionicons name="book-outline" size={20} color={colors.text.secondary} /><Text style={styles.sectionTitle}>Exercise guide</Text></View>
                    {[exercise.bodyPart || local?.bodyPart, exercise.target || local?.target, exercise.equipment || local?.equipment].some(Boolean) && <View style={styles.tags}>{[...new Set([exercise.bodyPart || local?.bodyPart, exercise.target || local?.target, exercise.equipment || local?.equipment].filter(Boolean))].map(tag => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>}
                    {steps.length ? steps.map((step, index) => <View key={index} style={styles.step}>{steps.length > 1 && <Text style={styles.stepNumber}>{index + 1}</Text>}<Text style={[styles.body, { flex: 1 }]}>{step}</Text></View>) : <Text style={styles.body}>A technique guide has not been added for this exercise yet.</Text>}
                    {prescriptionOnly && <View style={styles.notes}><Text style={styles.trackingTitle}>Workout notes</Text><Text style={styles.body}>{workoutNotes}</Text></View>}
                </View>
                {onToggleUnilateral && !isCardioExercise(exercise) && <View style={styles.tracking}>
                    <Text style={styles.trackingTitle}>How do you log it?</Text>
                    <View accessibilityRole="radiogroup" accessibilityLabel="Exercise logging mode" style={styles.segment}>
                        {[{ label: 'Whole movement', value: false }, { label: 'Each side', value: true }].map(option => <Pressable key={option.label} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: !!exercise.is_unilateral === option.value }} aria-checked={!!exercise.is_unilateral === option.value} onPress={() => { if (!!exercise.is_unilateral !== option.value) onToggleUnilateral(); }} style={[styles.choice, !!exercise.is_unilateral === option.value && styles.choiceSelected]}>
                            <Text style={[styles.choiceText, !!exercise.is_unilateral === option.value && styles.choiceTextSelected]}>{option.label}</Text>
                        </Pressable>)}
                    </View>
                    <Text style={styles.body}>{exercise.is_unilateral
                        ? 'Enter weight and reps for one side. Workout volume includes both sides.'
                        : 'Enter the total weight and reps for the movement.'}</Text>
                </View>}
                </>}
            </ScrollView>
            {onAdd && <View style={styles.actionFooter}><Button title={addLabel} onPress={onAdd} fullWidth /></View>}
        </SafeAreaView>
    </Modal>;
}

const styles = StyleSheet.create({
    tabs: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.glass.border },
    tab: { minHeight: 48, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabSelected: { borderBottomColor: colors.text.primary },
    tabText: { fontFamily: typography.fontFamily.medium, fontSize: 14, color: colors.text.muted },
    tabTextSelected: { color: colors.text.primary },
    historyCard: { padding: spacing.lg, gap: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.glass.border, backgroundColor: colors.glass.surface },
    historyHeading: { gap: spacing.xs },
    historySet: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
    historyValue: { color: colors.text.primary, fontSize: 14, lineHeight: 22, fontFamily: typography.fontFamily.medium },
    container: { flex: 1, backgroundColor: colors.background },
    actionFooter: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.glass.border },
    header: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.glass.border },
    title: { flex: 1, color: colors.text.primary, fontSize: typography.sizes.xl, lineHeight: 28, fontFamily: typography.fontFamily.semiBold, textTransform: 'capitalize' },
    close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    content: { padding: spacing.xl, paddingBottom: spacing['3xl'], gap: spacing['2xl'] },
    preview: { width: '100%', height: 240, borderRadius: borderRadius.lg, overflow: 'hidden', backgroundColor: colors.surfaceLight },
    previewLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    loadingLabel: { fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.sm, color: colors.text.secondary },
    body: { color: colors.text.secondary, fontSize: 14, lineHeight: 22, fontFamily: typography.fontFamily.regular },
    guide: { gap: spacing.lg },
    step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    stepNumber: { fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.sm, color: colors.text.secondary, paddingTop: 3, width: 20 },
    notes: { padding: spacing.lg, backgroundColor: colors.surfaceLight, borderRadius: borderRadius.lg, gap: spacing.sm },
    sectionHeading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    sectionTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.lg },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tag: { borderWidth: 1, borderColor: colors.glass.borderLight, borderRadius: borderRadius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    tagText: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.sm, textTransform: 'capitalize' },
    mediaNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: borderRadius.lg, backgroundColor: colors.surfaceLight },
    tracking: { gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.glass.surface, borderWidth: 1, borderColor: colors.glass.border, borderRadius: borderRadius.lg },
    trackingTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.lg },
    segment: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.xs, borderRadius: borderRadius.xl, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.glass.border },
    choice: { flex: 1, flexBasis: 120, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderRadius: borderRadius.full },
    choiceSelected: { backgroundColor: colors.primary },
    choiceText: { color: colors.text.secondary, fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.sm },
    choiceTextSelected: { color: colors.text.dark },
});
