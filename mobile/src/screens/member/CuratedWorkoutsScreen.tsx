import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ScrollView,
    Modal,
    Dimensions,
    Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius, shadows, commonStyles } from '../../styles/theme';
import {
    curatedWorkouts,
    CuratedWorkout,
    CuratedExercise,
    WorkoutType,
    Difficulty,
} from '../../data/curatedWorkouts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_FILTERS: Array<{ label: string; value: WorkoutType | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Chest', value: 'chest' },
    { label: 'Back', value: 'back' },
    { label: 'Legs', value: 'legs' },
    { label: 'Shoulders', value: 'shoulders' },
    { label: 'Arms', value: 'arms' },
    { label: 'Cardio', value: 'cardio' },
];

const DIFFICULTY_FILTERS: Array<{ label: string; value: Difficulty | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Beginner', value: 'beginner' },
    { label: 'Intermediate', value: 'intermediate' },
    { label: 'Advanced', value: 'advanced' },
];

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
    beginner: '#22C55E',
    intermediate: '#F59E0B',
    advanced: '#EF4444',
};

const TYPE_ICONS: Record<WorkoutType, string> = {
    chest: 'fitness-center',
    back: 'accessibility-new',
    legs: 'directions-run',
    shoulders: 'emoji-people',
    arms: 'sports-gymnastics',
    cardio: 'monitor-heart',
};

// ---------------------------------------------------------------------------
// Workout Card Component
// ---------------------------------------------------------------------------

interface WorkoutCardProps {
    workout: CuratedWorkout;
    onPress: () => void;
}

const WorkoutCard: React.FC<WorkoutCardProps> = React.memo(({ workout, onPress }) => {
    const diffColor = DIFFICULTY_COLORS[workout.difficulty];
    const iconName = TYPE_ICONS[workout.type] || 'fitness-center';

    return (
        <TouchableOpacity
            style={styles.workoutCard}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* Top row: icon + name + difficulty badge */}
            <View style={styles.cardTopRow}>
                <View style={styles.cardIconWrap}>
                    <MaterialIcons
                        name={iconName as any}
                        size={20}
                        color={colors.text.secondary}
                    />
                </View>
                <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardName} numberOfLines={1}>
                        {workout.name}
                    </Text>
                    <Text style={styles.cardType}>
                        {workout.type.toUpperCase()}
                    </Text>
                </View>
                <View style={[styles.diffBadge, { borderColor: diffColor }]}>
                    <Text style={[styles.diffBadgeText, { color: diffColor }]}>
                        {workout.difficulty.charAt(0).toUpperCase() + workout.difficulty.slice(1)}
                    </Text>
                </View>
            </View>

            {/* Bottom row: meta info */}
            <View style={styles.cardMetaRow}>
                <View style={styles.cardMeta}>
                    <MaterialIcons name="schedule" size={14} color={colors.text.muted} />
                    <Text style={styles.cardMetaText}>
                        {workout.estimatedMinutes} min
                    </Text>
                </View>
                <View style={styles.cardMeta}>
                    <MaterialIcons name="format-list-numbered" size={14} color={colors.text.muted} />
                    <Text style={styles.cardMetaText}>
                        {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
                    </Text>
                </View>
                <View style={styles.cardMeta}>
                    <MaterialIcons name="repeat" size={14} color={colors.text.muted} />
                    <Text style={styles.cardMetaText}>
                        {workout.exercises.reduce((sum, e) => sum + e.sets, 0)} sets
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
});

// ---------------------------------------------------------------------------
// Preview Modal Component
// ---------------------------------------------------------------------------

interface PreviewModalProps {
    visible: boolean;
    workout: CuratedWorkout | null;
    onClose: () => void;
    onStart: (workout: CuratedWorkout) => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ visible, workout, onClose, onStart }) => {
    if (!workout) return null;

    const diffColor = DIFFICULTY_COLORS[workout.difficulty];
    const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets, 0);

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Modal header */}
                    <View style={styles.modalHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.modalTitle}>{workout.name}</Text>
                            <View style={styles.modalMeta}>
                                <View style={[styles.diffBadge, { borderColor: diffColor }]}>
                                    <Text style={[styles.diffBadgeText, { color: diffColor }]}>
                                        {workout.difficulty.charAt(0).toUpperCase() + workout.difficulty.slice(1)}
                                    </Text>
                                </View>
                                <Text style={styles.modalMetaText}>
                                    {workout.estimatedMinutes} min
                                </Text>
                                <Text style={styles.modalMetaText}>
                                    {totalSets} sets
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={12}>
                            <MaterialIcons name="close" size={22} color={colors.text.muted} />
                        </TouchableOpacity>
                    </View>

                    {/* Exercises list */}
                    <Text style={styles.modalSectionLabel}>EXERCISES</Text>
                    <ScrollView
                        style={styles.modalExerciseList}
                        showsVerticalScrollIndicator={false}
                    >
                        {workout.exercises.map((ex, idx) => (
                            <View key={idx} style={styles.modalExerciseRow}>
                                <View style={styles.exerciseNumWrap}>
                                    <Text style={styles.exerciseNum}>{idx + 1}</Text>
                                </View>
                                <View style={styles.exerciseInfo}>
                                    <Text style={styles.exerciseName}>{ex.name}</Text>
                                    <Text style={styles.exerciseDetail}>
                                        {ex.sets} sets x {ex.reps} &middot; {ex.restSeconds}s rest
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Start button */}
                    <TouchableOpacity
                        style={styles.startBtn}
                        onPress={() => onStart(workout)}
                        activeOpacity={0.8}
                    >
                        <MaterialIcons name="play-arrow" size={20} color={colors.text.dark} />
                        <Text style={styles.startBtnText}>Start This Workout</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

const CuratedWorkoutsScreen: React.FC = () => {
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();

    // Pre-select type if passed from WorkoutLogScreen
    const initialType = (params.workoutType as WorkoutType) || 'all';

    const [typeFilter, setTypeFilter] = useState<WorkoutType | 'all'>(initialType);
    const [diffFilter, setDiffFilter] = useState<Difficulty | 'all'>('all');
    const [previewWorkout, setPreviewWorkout] = useState<CuratedWorkout | null>(null);

    // Filtered workouts
    const filtered = useMemo(() => {
        return curatedWorkouts.filter((w) => {
            if (typeFilter !== 'all' && w.type !== typeFilter) return false;
            if (diffFilter !== 'all' && w.difficulty !== diffFilter) return false;
            return true;
        });
    }, [typeFilter, diffFilter]);

    // Navigate back to WorkoutLogScreen with exercises pre-loaded
    const handleStartWorkout = useCallback((workout: CuratedWorkout) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPreviewWorkout(null);

        // Convert curated exercises into the format WorkoutLogScreen expects.
        // We serialize via JSON and pass as a search param.
        const exercises = workout.exercises.map((ex, idx) => ({
            id: `curated_${workout.id}_${idx}`,
            name: ex.name,
            sets: Array.from({ length: ex.sets }, (_, sIdx) => ({
                id: `${Date.now()}_${idx}_${sIdx}`,
                weight_kg: '',
                reps: '',
                rir: '',
                completed: false,
            })),
        }));

        router.replace({
            pathname: '/log/workout',
            params: {
                intent: JSON.stringify({ session_label: workout.type }),
                curatedExercises: JSON.stringify(exercises),
                curatedName: workout.name,
            },
        });
    }, []);

    const renderWorkoutCard = useCallback(
        ({ item }: { item: CuratedWorkout }) => (
            <WorkoutCard
                workout={item}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPreviewWorkout(item);
                }}
            />
        ),
        [],
    );

    const keyExtractor = useCallback((item: CuratedWorkout) => item.id, []);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    hitSlop={12}
                    style={styles.backBtn}
                >
                    <MaterialIcons name="arrow-back" size={22} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>WORKOUT LIBRARY</Text>
                <View style={styles.backBtn} />
            </View>

            {/* Type filter pills */}
            <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>TYPE</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                >
                    {TYPE_FILTERS.map((f) => {
                        const active = typeFilter === f.value;
                        return (
                            <TouchableOpacity
                                key={f.value}
                                style={[styles.filterPill, active && styles.filterPillActive]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setTypeFilter(f.value);
                                }}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.filterPillText,
                                        active && styles.filterPillTextActive,
                                    ]}
                                >
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Difficulty filter pills */}
            <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>DIFFICULTY</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                >
                    {DIFFICULTY_FILTERS.map((f) => {
                        const active = diffFilter === f.value;
                        return (
                            <TouchableOpacity
                                key={f.value}
                                style={[styles.filterPill, active && styles.filterPillActive]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setDiffFilter(f.value);
                                }}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.filterPillText,
                                        active && styles.filterPillTextActive,
                                    ]}
                                >
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Results count */}
            <Text style={styles.resultsCount}>
                {filtered.length} workout{filtered.length !== 1 ? 's' : ''}
            </Text>

            {/* Workout list */}
            <FlatList
                data={filtered}
                keyExtractor={keyExtractor}
                renderItem={renderWorkoutCard}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={Platform.OS === 'android'}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialIcons name="search-off" size={40} color={colors.text.muted} />
                        <Text style={styles.emptyText}>No workouts match your filters</Text>
                    </View>
                }
            />

            {/* Preview modal */}
            <PreviewModal
                visible={!!previewWorkout}
                workout={previewWorkout}
                onClose={() => setPreviewWorkout(null)}
                onStart={handleStartWorkout}
            />
        </SafeAreaView>
    );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        letterSpacing: 2,
        color: colors.text.primary,
    },

    // Filters
    filterSection: {
        paddingLeft: spacing.lg,
        marginBottom: spacing.md,
    },
    filterLabel: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        letterSpacing: 2,
        color: colors.text.muted,
        marginBottom: spacing.sm,
    },
    filterRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingRight: spacing.lg,
    },
    filterPill: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs + 2,
    },
    filterPillActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterPillText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    filterPillTextActive: {
        color: colors.text.dark,
    },

    // Results count
    resultsCount: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.sm,
    },

    // List
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 100,
    },

    // Workout card
    workoutCard: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    cardTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    cardIconWrap: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.glass.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitleWrap: {
        flex: 1,
    },
    cardName: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    cardType: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.medium,
        letterSpacing: 1.5,
        color: colors.text.muted,
        marginTop: 2,
    },
    diffBadge: {
        borderWidth: 1,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 3,
    },
    diffBadgeText: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        letterSpacing: 0.5,
    },
    cardMetaRow: {
        flexDirection: 'row',
        gap: spacing.lg,
    },
    cardMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    cardMetaText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },

    // Empty state
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing['5xl'],
        gap: spacing.md,
    },
    emptyText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },

    // Preview modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        width: '100%',
        maxHeight: '80%',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    modalMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    modalMetaText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    modalSectionLabel: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        letterSpacing: 2,
        color: colors.text.muted,
        marginBottom: spacing.md,
    },
    modalExerciseList: {
        marginBottom: spacing.lg,
    },
    modalExerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    exerciseNumWrap: {
        width: 28,
        height: 28,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    exerciseNum: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    exerciseDetail: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },

    // Start button
    startBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.lg,
        ...shadows.glow,
    },
    startBtnText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.dark,
    },
});

export default CuratedWorkoutsScreen;
