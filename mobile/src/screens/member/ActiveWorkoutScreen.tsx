import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { workoutsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import ExercisePicker from '../../components/ExercisePicker';

export default function ActiveWorkoutScreen() {
    const { sessionId } = useLocalSearchParams();
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [pickerVisible, setPickerVisible] = useState(false);
    const toast = useToast();

    // Track completed sets (local UI state mainly, but could sync)
    const [completedSets, setCompletedSets] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadSession();
    }, [sessionId]);

    const loadSession = async () => {
        try {
            const data = await workoutsAPI.getSession(sessionId as string);
            setSession(data.session);

            // Pre-fill completed sets based on data if needed
            // currently API doesn't store "completed" bool, just data
        } catch (error) {
            toast.error('Error', 'Failed to load workout');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleAddExercise = async (exercise: any) => {
        setPickerVisible(false);
        try {
            await workoutsAPI.addExerciseToSession(sessionId as string, exercise.id);
            // Refresh
            loadSession();
        } catch (error) {
            toast.error('Error', 'Failed to add exercise');
        }
    };

    const handleAddSet = async (exerciseLogId: string, lastSet: any) => {
        try {
            // Copy previous set values or default
            const weight = lastSet?.weight_kg || 0;
            const reps = lastSet?.reps || 0;

            await workoutsAPI.addSet(exerciseLogId, {
                reps,
                weight_kg: weight,
                rpe: 8
            });
            loadSession();
        } catch (error) {
            toast.error('Error', 'Failed to add set');
        }
    };

    const handleUpdateSet = async (setId: string, field: 'weight_kg' | 'reps' | 'rpe', value: string) => {
        // Optimistic update locally? 
        // For now, let's just update local state session object to reflect input
        // Then debounce api call?
        // Simpler: Just update API onBlur. But for React state controlling inputs, we need local update.

        const numVal = parseFloat(value) || 0;

        // Update local session state deeply
        const newSession = { ...session };
        for (const ex of newSession.exercises) {
            const set = ex.sets.find((s: any) => s.id === setId);
            if (set) {
                set[field] = numVal;
                break;
            }
        }
        setSession(newSession);

        // Call API (maybe debounce this in real app)
        try {
            await workoutsAPI.updateSet(setId, { [field]: numVal });
        } catch (error) {
            console.error('Failed to update set');
        }
    };

    const toggleSet = (setId: string) => {
        const next = new Set(completedSets);
        if (next.has(setId)) next.delete(setId);
        else next.add(setId);
        setCompletedSets(next);
    };

    const handleComplete = async () => {
        Alert.alert(
            'Finish Workout?',
            'Are you sure you want to finish?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Finish',
                    style: 'default',
                    onPress: async () => {
                        try {
                            const res = await workoutsAPI.completeSession(sessionId as string, { notes: 'Great workout!' });

                            // Navigate to Recap with data
                            router.replace({
                                pathname: '/member/workout-recap',
                                params: {
                                    recap: JSON.stringify(res.recap),
                                    session: JSON.stringify(res.session)
                                }
                            });
                        } catch (error) {
                            toast.error('Error', 'Failed to complete session');
                        }
                    }
                }
            ]
        );
    };

    if (loading || !session) return <View style={styles.container}><Text style={{ color: 'white', padding: 20 }}>Loading workout...</Text></View>;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <MaterialIcons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Active Workout</Text>
                <TouchableOpacity style={styles.finishBtn} onPress={handleComplete}>
                    <Text style={styles.finishText}>FINISH</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {session.exercises?.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No exercises added yet.</Text>
                        <Text style={styles.emptySub}>Start by adding an exercise below.</Text>
                    </View>
                )}

                {session.exercises?.map((ex: any, i: number) => (
                    <View key={i} style={styles.exerciseCard}>
                        <Text style={styles.exerciseName}>{ex.name}</Text>

                        <View style={styles.setsContainer}>
                            <View style={styles.setRowHeader}>
                                <Text style={styles.colHeader}>SET</Text>
                                <Text style={styles.colHeader}>KG</Text>
                                <Text style={styles.colHeader}>REPS</Text>
                                <Text style={styles.colHeader}>RPE</Text>
                                <Text style={styles.colHeader}>DONE</Text>
                            </View>

                            {ex.sets?.map((set: any, j: number) => (
                                <View key={set.id || j} style={[styles.setRow, completedSets.has(set.id) && styles.setRowDone]}>
                                    <View style={styles.setNumBadge}>
                                        <Text style={styles.setNum}>{j + 1}</Text>
                                    </View>

                                    <TextInput
                                        style={styles.input}
                                        keyboardType="numeric"
                                        defaultValue={set.weight_kg?.toString()}
                                        onEndEditing={(e) => handleUpdateSet(set.id, 'weight_kg', e.nativeEvent.text)}
                                        placeholder="0"
                                        placeholderTextColor={colors.text.subtle}
                                    />

                                    <TextInput
                                        style={styles.input}
                                        keyboardType="numeric"
                                        defaultValue={set.reps?.toString()}
                                        onEndEditing={(e) => handleUpdateSet(set.id, 'reps', e.nativeEvent.text)}
                                        placeholder="0"
                                        placeholderTextColor={colors.text.subtle}
                                    />

                                    <TextInput
                                        style={styles.input}
                                        keyboardType="numeric"
                                        defaultValue={set.rpe?.toString()}
                                        onEndEditing={(e) => handleUpdateSet(set.id, 'rpe', e.nativeEvent.text)}
                                        placeholder="-"
                                        placeholderTextColor={colors.text.subtle}
                                    />

                                    <TouchableOpacity
                                        style={[styles.checkBox, completedSets.has(set.id) && styles.checkBoxChecked]}
                                        onPress={() => toggleSet(set.id)}
                                    >
                                        {completedSets.has(set.id) && <MaterialIcons name="check" size={16} color="black" />}
                                    </TouchableOpacity>
                                </View>
                            ))}

                            <TouchableOpacity
                                style={styles.addSetBtn}
                                onPress={() => handleAddSet(ex.id, ex.sets?.[ex.sets.length - 1])}
                            >
                                <Text style={styles.addSetText}>+ Add Set</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}

                <TouchableOpacity
                    style={styles.addExerciseBtn}
                    onPress={() => setPickerVisible(true)}
                >
                    <MaterialIcons name="add" size={24} color={colors.primary} />
                    <Text style={styles.addExerciseText}>Add Exercise</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>

            <ExercisePicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                onSelect={handleAddExercise}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    headerTitle: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.lg,
    },
    finishBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: borderRadius.md,
    },
    finishText: {
        color: 'black',
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.sm,
    },
    content: {
        padding: spacing.md,
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.xl,
        marginTop: spacing.xl,
    },
    emptyText: {
        color: colors.text.muted,
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
    },
    emptySub: {
        color: colors.text.subtle,
        fontSize: typography.sizes.sm,
        marginTop: spacing.sm,
    },
    exerciseCard: {
        marginBottom: spacing.xl,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    exerciseName: {
        color: colors.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.lg,
        marginBottom: spacing.md,
    },
    setsContainer: {
        gap: spacing.sm,
    },
    setRowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xs,
        marginBottom: 4,
    },
    colHeader: {
        color: colors.text.muted,
        fontSize: 10,
        width: 50,
        textAlign: 'center',
    },
    setRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        padding: spacing.sm,
        borderRadius: borderRadius.md,
    },
    setRowDone: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)', // Green tint
    },
    setNumBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.glass.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    setNum: {
        color: colors.text.muted,
        fontSize: 10,
    },
    input: {
        width: 50,
        backgroundColor: colors.glass.surface,
        color: colors.text.primary,
        textAlign: 'center',
        borderRadius: 4,
        paddingVertical: 2,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
    },
    checkBox: {
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.text.muted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkBoxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    addSetBtn: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
        marginTop: spacing.xs,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
    },
    addSetText: {
        color: colors.primary,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
    },
    addExerciseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glass.surface,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        gap: spacing.sm,
    },
    addExerciseText: {
        color: colors.primary,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
    },
});
