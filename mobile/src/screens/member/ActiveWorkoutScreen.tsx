import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import { workoutsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../components/GlassCard';
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
        const hasExercises = session?.exercises && session.exercises.length > 0;
        const confirmMessage = hasExercises
            ? 'Are you sure you want to finish?'
            : 'Mark as done without logging? You still get streak credit!';

        Alert.alert(
            'Finish Workout?',
            confirmMessage,
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

    if (loading || !session) return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Immersive Background */}
            <LinearGradient
                colors={['#000000', '#111111']}
                style={StyleSheet.absoluteFill}
            />

            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* HUD Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                        <MaterialIcons name="close" size={24} color={colors.text.muted} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>ACTIVE SESSION</Text>
                        <Text style={styles.headerSubtitle}>{session.day_name || 'Workout'}</Text>
                    </View>
                    <TouchableOpacity style={styles.finishBtn} onPress={handleComplete}>
                        <Text style={styles.finishText}>FINISH</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {session.exercises?.length === 0 && (
                        <GlassCard style={styles.emptyState}>
                            <MaterialIcons name="fitness-center" size={48} color={colors.text.subtle} style={{ marginBottom: spacing.md }} />
                            <Text style={styles.emptyText}>READY TO LIFT?</Text>
                            <Text style={styles.emptySub}>Add your first exercise to start tracking.</Text>
                        </GlassCard>
                    )}

                    {session.exercises?.map((ex: any, i: number) => (
                        <GlassCard key={i} style={styles.exerciseCard}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.exerciseName}>{ex.name}</Text>
                                <TouchableOpacity>
                                    <MaterialIcons name="more-horiz" size={24} color={colors.text.subtle} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.setsHeader}>
                                <Text style={[styles.colHeader, { flex: 0.5 }]}>SET</Text>
                                <Text style={[styles.colHeader, { flex: 1 }]}>KG</Text>
                                <Text style={[styles.colHeader, { flex: 1 }]}>REPS</Text>
                                <Text style={[styles.colHeader, { flex: 0.8 }]}>RPE</Text>
                                <Text style={[styles.colHeader, { flex: 0.5 }]}>✓</Text>
                            </View>

                            {ex.sets?.map((set: any, j: number) => {
                                const isDone = completedSets.has(set.id);
                                return (
                                    <View
                                        key={set.id || j}
                                        style={[styles.setRow, isDone && styles.setRowDone]}
                                    >
                                        <View style={styles.setNumCol}>
                                            <View style={[styles.setBadge, isDone && styles.setBadgeDone]}>
                                                <Text style={[styles.setNumText, isDone && styles.setNumTextDone]}>{j + 1}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.inputCol}>
                                            <TextInput
                                                style={[styles.input, isDone && styles.inputDone]}
                                                keyboardType="numeric"
                                                defaultValue={set.weight_kg?.toString()}
                                                onEndEditing={(e) => handleUpdateSet(set.id, 'weight_kg', e.nativeEvent.text)}
                                                placeholder="0"
                                                placeholderTextColor={colors.text.subtle}
                                                selectTextOnFocus
                                            />
                                        </View>

                                        <View style={styles.inputCol}>
                                            <TextInput
                                                style={[styles.input, isDone && styles.inputDone]}
                                                keyboardType="numeric"
                                                defaultValue={set.reps?.toString()}
                                                onEndEditing={(e) => handleUpdateSet(set.id, 'reps', e.nativeEvent.text)}
                                                placeholder="0"
                                                placeholderTextColor={colors.text.subtle}
                                                selectTextOnFocus
                                            />
                                        </View>

                                        <View style={styles.inputCol}>
                                            <TextInput
                                                style={[styles.input, styles.rpeInput, isDone && styles.inputDone]}
                                                keyboardType="numeric"
                                                defaultValue={set.rpe?.toString()}
                                                onEndEditing={(e) => handleUpdateSet(set.id, 'rpe', e.nativeEvent.text)}
                                                placeholder="-"
                                                placeholderTextColor={colors.text.subtle}
                                                selectTextOnFocus
                                            />
                                        </View>

                                        <TouchableOpacity
                                            style={styles.checkCol}
                                            onPress={() => toggleSet(set.id)}
                                        >
                                            <View style={[styles.checkBox, isDone && styles.checkBoxChecked]}>
                                                <MaterialIcons name="check" size={14} color={isDone ? "#000" : "transparent"} />
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}

                            <TouchableOpacity
                                style={styles.addSetBtn}
                                onPress={() => handleAddSet(ex.id, ex.sets?.[ex.sets.length - 1])}
                            >
                                <Text style={styles.addSetText}>+ ADD SET</Text>
                            </TouchableOpacity>
                        </GlassCard>
                    ))}

                    <TouchableOpacity
                        style={styles.addExerciseBtn}
                        onPress={() => setPickerVisible(true)}
                    >
                        <LinearGradient
                            colors={[colors.primary + '20', colors.primary + '05']}
                            style={styles.addExerciseGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <MaterialIcons name="add" size={24} color={colors.primary} />
                            <Text style={styles.addExerciseText}>ADD EXERCISE</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </SafeAreaView>

            <ExercisePicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                onSelect={handleAddExercise}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    safeArea: {
        flex: 1,
    },
    loadingText: {
        color: colors.text.muted,
        marginTop: spacing.md,
        fontFamily: typography.fontFamily.medium,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        color: colors.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: 10,
        letterSpacing: 2,
    },
    headerSubtitle: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.lg,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    iconBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    finishBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.lg,
        paddingVertical: 8,
        borderRadius: borderRadius.full,
        ...shadows.glow,
    },
    finishText: {
        color: '#000000',
        fontFamily: typography.fontFamily.extraBold,
        fontSize: 10,
        letterSpacing: 1,
    },
    content: {
        padding: spacing.md,
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing['2xl'],
        marginTop: spacing.xl,
    },
    emptyText: {
        color: colors.text.primary,
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
        marginBottom: spacing.xs,
    },
    emptySub: {
        color: colors.text.muted,
        fontSize: typography.sizes.sm,
    },
    exerciseCard: {
        marginBottom: spacing.lg,
        padding: 0, // Reset default padding
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    exerciseName: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.lg,
        letterSpacing: 0.5,
    },
    setsHeader: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.03)',
    },
    colHeader: {
        color: colors.text.subtle,
        fontSize: 9,
        fontFamily: typography.fontFamily.bold,
        textAlign: 'center',
        letterSpacing: 1,
    },
    setRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.03)',
    },
    setRowDone: {
        backgroundColor: 'rgba(34, 197, 94, 0.05)',
    },
    setNumCol: {
        flex: 0.5,
        alignItems: 'center',
    },
    setBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    setBadgeDone: {
        backgroundColor: colors.primary,
    },
    setNumText: {
        color: colors.text.subtle,
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
    },
    setNumTextDone: {
        color: '#000',
    },
    inputCol: {
        flex: 1,
        alignItems: 'center',
    },
    checkCol: {
        flex: 0.5,
        alignItems: 'center',
    },
    input: {
        width: '80%',
        backgroundColor: 'rgba(0,0,0,0.3)',
        color: colors.text.primary,
        textAlign: 'center',
        borderRadius: 6,
        paddingVertical: 8,
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inputDone: {
        color: colors.primary,
        opacity: 0.8,
    },
    rpeInput: {
        flex: 0.8,
    },
    checkBox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
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
        paddingVertical: spacing.md,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    addSetText: {
        color: colors.text.secondary,
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
    },
    addExerciseBtn: {
        marginTop: spacing.md,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
    },
    addExerciseGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.primary + '30',
        borderRadius: borderRadius.xl,
        borderStyle: 'dashed',
    },
    addExerciseText: {
        color: colors.primary,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.extraBold,
        letterSpacing: 2,
    },
});
