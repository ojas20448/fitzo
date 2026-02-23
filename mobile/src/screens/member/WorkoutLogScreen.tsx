import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    TextInput,
    Pressable,
    Modal,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { workoutsAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import ExerciseList from '../../components/ExerciseList';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';

interface ExerciseSet {
    id: string; // unique within session
    weight_kg?: number | string;
    reps?: number | string;
    rir?: number | string; // Reps In Reserve
    completed: boolean;
    previous?: string; // e.g., "100kg x 10"
}

interface UserExercise {
    id: string; // from DB
    name: string;
    gifUrl?: string;
    target?: string;
    sets: ExerciseSet[];
}

const WorkoutLogScreen: React.FC = () => {
    const toast = useToast();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(false);

    // Initial Intent Data (if any)
    const initialIntent = params.intent ? JSON.parse(params.intent as string) : null;
    
    // Map common intent labels to valid workout types
    const mapIntentToType = (label: string) => {
        const lower = label?.toLowerCase() || '';
        if (lower.includes('leg')) return 'legs';
        if (lower.includes('chest') || lower.includes('push')) return 'chest';
        if (lower.includes('back') || lower.includes('pull')) return 'back';
        if (lower.includes('shoulder')) return 'shoulders';
        if (lower.includes('arm')) return 'arms';
        if (lower.includes('cardio')) return 'cardio';
        return 'chest'; // Default to chest if unclear
    };

    const [workoutType, setWorkoutType] = useState(
        mapIntentToType(initialIntent?.session_label || '')
    );

    // Main State
    const [userExercises, setUserExercises] = useState<UserExercise[]>([]);
    const [startTime] = useState(new Date());

    // Exercise Picker Modal
    const [showPicker, setShowPicker] = useState(false);

    // Smart Pre-fill
    useEffect(() => {
        if (workoutType) {
            fetchLatestWorkout();
        }
    }, [workoutType]);

    const fetchLatestWorkout = async () => {
        // Only fetch if we have a type (e.g. "Push" or "Legs")
        // If it's generic "Workout", maybe skip pre-fill unless user selects a type?
        try {
            const res = await workoutsAPI.getLatest(workoutType);
            if (res.found && res.workout) {
                const prevExercises = res.workout.exercises; // Ensure this is parsed if stored as JSON
                // Map previous exercises to current format, but reset completed status
                if (Array.isArray(prevExercises)) {
                    const prefilled = prevExercises.map((ex: any) => ({
                        ...ex,
                        sets: ex.sets.map((s: any) => ({
                            ...s,
                            id: Math.random().toString(), // new IDs for new session
                            completed: false, // reset completion
                            previous: `${s.weight_kg}kg x ${s.reps}` // store history
                        }))
                    }));
                    // We could ask user if they want to load it, but "Smart Pre-fill" implies auto
                    // However, usually we might ghost it. For now, let's pre-fill values.
                    setUserExercises(prefilled);
                    toast.success('Smart Load', `Loaded your last ${workoutType} session!`);
                }
            }
        } catch (error) {
        }
    };

    const handleAddExercise = (exercise: any) => {
        const newExercise: UserExercise = {
            id: exercise.id,
            name: exercise.name,
            gifUrl: exercise.gifUrl,
            target: exercise.target,
            sets: [
                { id: Math.random().toString(), weight_kg: '', reps: '', rir: '', completed: false }
            ]
        };
        setUserExercises([...userExercises, newExercise]);
        setShowPicker(false);
    };

    const addSet = (exerciseIndex: number) => {
        const updated = [...userExercises];
        const prevSet = updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1];

        updated[exerciseIndex].sets.push({
            id: Math.random().toString(),
            weight_kg: prevSet ? prevSet.weight_kg : '', // copy previous weight for convenience
            reps: prevSet ? prevSet.reps : '',
            rir: '',
            completed: false
        });
        setUserExercises(updated);
    };

    const removeSet = (exerciseIndex: number, setIndex: number) => {
        const updated = [...userExercises];
        updated[exerciseIndex].sets.splice(setIndex, 1);
        setUserExercises(updated);
    };

    const updateSet = (exerciseIndex: number, setIndex: number, field: keyof ExerciseSet, value: any) => {
        const updated = [...userExercises];
        updated[exerciseIndex].sets[setIndex] = {
            ...updated[exerciseIndex].sets[setIndex],
            [field]: value
        };
        setUserExercises(updated);
    };

    const removeExercise = (index: number) => {
        Alert.alert(
            'Remove Exercise',
            'Are you sure you want to remove this exercise?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        const updated = [...userExercises];
                        updated.splice(index, 1);
                        setUserExercises(updated);
                    }
                }
            ]
        );
    };

    const handleFinish = async () => {
        if (userExercises.length === 0) {
            toast.error('Empty Workout', 'Add at least one exercise to log.');
            return;
        }

        setLoading(true);
        try {
            const durationMinutes = Math.round((new Date().getTime() - startTime.getTime()) / 60000);

            const result = await workoutsAPI.log({
                workout_type: workoutType,
                exercises: JSON.stringify(userExercises),
                notes: `Logged via Smart Log`,
                visibility: 'friends',
            });

            // Calculate volume & sets from local data
            let totalVolume = 0;
            let totalSets = 0;
            for (const ex of userExercises) {
                for (const s of ex.sets) {
                    const w = parseFloat(String(s.weight_kg || 0));
                    const r = parseFloat(String(s.reps || 0));
                    if (w > 0 && r > 0) {
                        totalVolume += w * r;
                        totalSets++;
                    }
                }
            }

            // Build recap and navigate to showoff card
            const recap = {
                duration: Math.max(durationMinutes, 1),
                volume: Math.round(totalVolume),
                sets: totalSets,
                prs: result.prs || [],
            };

            router.replace({
                pathname: '/member/workout-recap',
                params: {
                    recap: JSON.stringify(recap),
                    session: JSON.stringify({
                        name: workoutType.charAt(0).toUpperCase() + workoutType.slice(1),
                        day_name: workoutType,
                        emphasis: [workoutType],
                    }),
                },
            });
        } catch (error: any) {
            toast.error('Error', error.message || 'Failed to save workout');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
                    <MaterialIcons name="close" size={24} color={colors.text.muted} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>LOG WORKOUT</Text>
                    <Text style={styles.headerSubtitle}>
                        {workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}
                    </Text>
                </View>
                <TouchableOpacity onPress={handleFinish} disabled={loading}>
                    <Text style={[styles.finishText, loading && { opacity: 0.5 }]}>FINISH</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
                {/* Workout Type Selector */}
                <View style={styles.typeSelector}>
                    <Text style={styles.typeSelectorLabel}>Workout Type</Text>
                    <View style={styles.typeOptions}>
                        {['legs', 'chest', 'back', 'shoulders', 'arms', 'cardio'].map((type) => (
                            <TouchableOpacity
                                key={type}
                                onPress={() => setWorkoutType(type)}
                                style={[
                                    styles.typeOption,
                                    workoutType === type && styles.typeOptionActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.typeOptionText,
                                        workoutType === type && styles.typeOptionTextActive,
                                    ]}
                                >
                                    {type.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {userExercises.map((exercise, exIndex) => (
                    <GlassCard key={exercise.id + exIndex} style={styles.exerciseCard}>
                        {/* Exercise Header */}
                        <View style={styles.cardHeader}>
                            <View style={styles.exerciseHeaderInfo}>
                                {exercise.gifUrl && (
                                    <Image
                                        source={{ uri: exercise.gifUrl }}
                                        style={styles.exerciseHeaderGif}
                                        resizeMode="cover"
                                    />
                                )}
                                <View>
                                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                                    <Text style={styles.exerciseTarget}>{exercise.target}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => removeExercise(exIndex)} style={styles.moreBtn}>
                                <MaterialIcons name="delete-outline" size={20} color={colors.text.muted} />
                            </TouchableOpacity>
                        </View>

                        {/* Sets Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.colText, styles.colSet]}>SET</Text>
                            <Text style={[styles.colText, styles.colPrev]}>PREVIOUS</Text>
                            <Text style={[styles.colText, styles.colKg]}>KG</Text>
                            <Text style={[styles.colText, styles.colReps]}>REPS</Text>
                            <Text style={[styles.colText, styles.colRir]}>RIR</Text>
                            <View style={[styles.colView, styles.colCheck]}></View>
                        </View>

                        {/* Sets Rows */}
                        {exercise.sets.map((set, setIndex) => (
                            <View
                                key={set.id}
                                style={[
                                    styles.setRow,
                                    set.completed ? styles.setRowCompleted : undefined
                                ]}
                            >
                                <View style={[styles.colView, styles.colSet]}>
                                    <View style={styles.setBadge}>
                                        <Text style={styles.setNumber}>{setIndex + 1}</Text>
                                    </View>
                                </View>

                                <View style={[styles.colView, styles.colPrev]}>
                                    <Text style={styles.prevText}>{set.previous || '-'}</Text>
                                </View>

                                <View style={[styles.colView, styles.colKg]}>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="decimal-pad"
                                        placeholder="-"
                                        placeholderTextColor={colors.text.subtle}
                                        value={set.weight_kg?.toString()}
                                        onChangeText={(v) => updateSet(exIndex, setIndex, 'weight_kg', v)}
                                        selectTextOnFocus
                                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                    />
                                </View>

                                <View style={[styles.colView, styles.colReps]}>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="number-pad"
                                        placeholder="-"
                                        placeholderTextColor={colors.text.subtle}
                                        value={set.reps?.toString()}
                                        onChangeText={(v) => updateSet(exIndex, setIndex, 'reps', v)}
                                        selectTextOnFocus
                                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                    />
                                </View>

                                <View style={[styles.colView, styles.colRir]}>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="decimal-pad"
                                        placeholder="-"
                                        placeholderTextColor={colors.text.subtle}
                                        value={set.rir?.toString()}
                                        onChangeText={(v) => updateSet(exIndex, setIndex, 'rir', v)}
                                        selectTextOnFocus
                                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[styles.colView, styles.colCheck]}
                                    onPress={() => updateSet(exIndex, setIndex, 'completed', !set.completed)}
                                >
                                    <View style={[styles.checkbox, set.completed && styles.checked]}>
                                        {set.completed && <MaterialIcons name="check" size={16} color={colors.background} />}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        ))}

                        {/* Add Set Button */}
                        <TouchableOpacity
                            style={styles.addSetBtn}
                            onPress={() => addSet(exIndex)}
                        >
                            <Text style={styles.addSetText}>+ Add Set</Text>
                        </TouchableOpacity>
                    </GlassCard>
                ))}

                {/* Add Exercise Button */}
                <TouchableOpacity
                    style={styles.addExerciseBtn}
                    onPress={() => setShowPicker(true)}
                >
                    <MaterialIcons name="add" size={24} color={colors.primary} />
                    <Text style={styles.addExerciseText}>ADD EXERCISE</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Exercise Picker Modal */}
            <Modal
                visible={showPicker}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowPicker(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Select Exercise</Text>
                        <TouchableOpacity onPress={() => setShowPicker(false)}>
                            <MaterialIcons name="close" size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                    </View>
                    <ExerciseList
                        mode="select"
                        onSelect={handleAddExercise}
                        initialFilter={workoutType !== 'Workout' ? workoutType : undefined}
                    />
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    closeBtn: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 1,
    },
    headerSubtitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    finishText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.md,
        gap: spacing.md,
    },
    exerciseCard: {
        padding: 0, // Reset default padding
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.glass.surfaceLight,
    },
    exerciseHeaderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
    },
    exerciseHeaderGif: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.glass.surface,
    },
    exerciseName: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.primary,
        textTransform: 'capitalize',
    },
    exerciseTarget: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        textTransform: 'capitalize',
    },
    moreBtn: {
        padding: spacing.xs,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    colText: {
        textAlign: 'center',
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
    },
    colView: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    colSet: { width: 30 },
    colPrev: { flex: 1 },
    colKg: { width: 72 },
    colReps: { width: 68 },
    colRir: { width: 56 },
    colCheck: { width: 40 },

    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
        minHeight: 52,
    },
    setRowCompleted: {
        backgroundColor: colors.primary + '10',
    },
    setBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
    },
    setNumber: {
        fontSize: 10,
        color: colors.text.secondary,
        fontFamily: typography.fontFamily.medium,
    },
    prevText: {
        fontSize: 12,
        color: colors.text.muted,
        textAlign: 'center',
    },
    input: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.sm,
        textAlign: 'center',
        color: colors.text.primary,
        fontSize: 16,
        fontFamily: typography.fontFamily.semiBold,
        paddingVertical: 8,
        paddingHorizontal: 4,
        marginHorizontal: 2,
        minHeight: 40,
        width: '100%',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.text.muted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    addSetBtn: {
        padding: spacing.md,
        alignItems: 'center',
    },
    addSetText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.primary,
        letterSpacing: 1,
    },
    addExerciseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        marginTop: spacing.md,
    },
    addExerciseText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        letterSpacing: 1,
    },

    // Workout Type Selector
    typeSelector: {
        marginBottom: spacing.lg,
    },
    typeSelectorLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 1,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
    },
    typeOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    typeOption: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    typeOptionActive: {
        backgroundColor: colors.primary + '20',
        borderColor: colors.primary,
    },
    typeOptionText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
    },
    typeOptionTextActive: {
        color: colors.primary,
    },

    // Modal
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    modalTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
});

export default WorkoutLogScreen;
