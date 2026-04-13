import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    FlatList,
    Pressable,
    Modal,
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { workoutsAPI, settingsAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import ExerciseList from '../../components/ExerciseList';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import {
    ScrollWheelPicker,
    RestTimerPill,
    ExerciseCard,
    PICKER_HEIGHT,
    WEIGHT_VALUES,
    REPS_VALUES,
    WORKOUT_TYPES,
    REST_PRESETS,
} from '../../components/workout';
import type { ExerciseSet, UserExercise, PickerConfig } from '../../components/workout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');



const WorkoutLogScreen: React.FC = () => {
    const toast = useToast();
    const params = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);

    // Intent parsing
    const initialIntent = params.intent ? JSON.parse(params.intent as string) : null;

    const mapIntentToType = (label: string) => {
        const lower = label?.toLowerCase() || '';
        if (lower.includes('leg')) return 'legs';
        if (lower.includes('chest') || lower.includes('push')) return 'chest';
        if (lower.includes('back') || lower.includes('pull')) return 'back';
        if (lower.includes('shoulder')) return 'shoulders';
        if (lower.includes('arm')) return 'arms';
        if (lower.includes('cardio')) return 'cardio';
        return 'chest';
    };

    const [workoutType, setWorkoutType] = useState(
        mapIntentToType(initialIntent?.session_label || ''),
    );

    // Core state
    const [userExercises, setUserExercises] = useState<UserExercise[]>([]);
    const [startTime] = useState(new Date());
    const [showPicker, setShowPicker] = useState(false);

    // Repeat-last preview state
    const [lastWorkoutPreview, setLastWorkoutPreview] = useState<UserExercise[] | null>(null);
    const [showRepeatPreview, setShowRepeatPreview] = useState(false);
    const [fetchingLastWorkout, setFetchingLastWorkout] = useState(false);

    // Rest timer state
    const [restSeconds, setRestSeconds] = useState(0);
    const [restDuration, setRestDuration] = useState(90);
    const [restActive, setRestActive] = useState(false);
    const restIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Number picker bottom sheet state
    const [pickerConfig, setPickerConfig] = useState<PickerConfig>({
        visible: false,
        type: 'weight',
        exerciseIndex: 0,
        setIndex: 0,
        currentValue: 0,
    });
    const pickerSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Rest duration selector modal
    const [showRestConfig, setShowRestConfig] = useState(false);

    // Visibility/Privacy
    const [visibility, setVisibility] = useState<'friends' | 'private'>('friends');
    const [shareLogs, setShareLogs] = useState(true);

    useEffect(() => {
        loadSharingPreference();
    }, []);

    const loadSharingPreference = async () => {
        try {
            const data = await settingsAPI.getSharingPreference();
            setShareLogs(data.share_logs_default);
            setVisibility(data.share_logs_default ? 'friends' : 'private');
        } catch (error) {
            setShareLogs(true);
            setVisibility('friends');
        }
    };

    // -----------------------------------------------------------------------
    // Rest Timer Logic
    // -----------------------------------------------------------------------

    const startRestTimer = useCallback(() => {
        // Clear any running timer
        if (restIntervalRef.current) clearInterval(restIntervalRef.current);

        setRestSeconds(restDuration);
        setRestActive(true);

        restIntervalRef.current = setInterval(() => {
            setRestSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(restIntervalRef.current!);
                    restIntervalRef.current = null;
                    setRestActive(false);
                    // Haptic pulse on zero
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [restDuration]);

    const dismissRestTimer = useCallback(() => {
        if (restIntervalRef.current) clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
        setRestActive(false);
        setRestSeconds(0);
    }, []);

    useEffect(() => {
        return () => {
            if (restIntervalRef.current) clearInterval(restIntervalRef.current);
        };
    }, []);

    // -----------------------------------------------------------------------
    // Smart Pre-fill / Repeat Last
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (workoutType) {
            fetchLatestWorkout();
        }
    }, [workoutType]);

    const fetchLatestWorkout = async () => {
        setFetchingLastWorkout(true);
        try {
            const res = await workoutsAPI.getLatest(workoutType);
            if (res.found && res.workout) {
                const prevExercises = res.workout.exercises;
                if (Array.isArray(prevExercises)) {
                    const prefilled: UserExercise[] = prevExercises.map((ex: any) => ({
                        ...ex,
                        sets: ex.sets.map((s: any) => ({
                            ...s,
                            id: Math.random().toString(),
                            completed: false,
                            previous: `${s.weight_kg}kg x ${s.reps}`,
                        })),
                    }));
                    setLastWorkoutPreview(prefilled);
                }
            } else {
                setLastWorkoutPreview(null);
            }
        } catch {
            setLastWorkoutPreview(null);
        } finally {
            setFetchingLastWorkout(false);
        }
    };

    const handleRepeatLast = useCallback(() => {
        if (!lastWorkoutPreview) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setUserExercises(lastWorkoutPreview);
        setShowRepeatPreview(false);
        toast.success('Loaded', `Pre-filled from your last ${workoutType} workout`);
    }, [lastWorkoutPreview, workoutType, toast]);

    // -----------------------------------------------------------------------
    // Load Curated Workout (from library)
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (params.curatedExercises) {
            try {
                const parsed = JSON.parse(params.curatedExercises as string) as UserExercise[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setUserExercises(parsed);
                    const label = params.curatedName ? (params.curatedName as string) : 'template';
                    toast.success('Template Loaded', `Loaded "${label}" — fill in your weights!`);
                }
            } catch {
                // silently ignore bad data
            }
        }
    }, []); // only on mount

    // -----------------------------------------------------------------------
    // Exercise CRUD
    // -----------------------------------------------------------------------

    const handleAddExercise = useCallback(
        (exercise: any) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const newExercise: UserExercise = {
                id: exercise.id,
                name: exercise.name,
                gifUrl: exercise.gifUrl,
                target: exercise.target,
                sets: [
                    {
                        id: Math.random().toString(),
                        weight_kg: '',
                        reps: '',
                        rir: '',
                        completed: false,
                    },
                ],
            };
            setUserExercises((prev) => [...prev, newExercise]);
            setShowPicker(false);
        },
        [],
    );

    const addSet = useCallback((exerciseIndex: number) => {
        setUserExercises((prev) => {
            const updated = [...prev];
            const sets = updated[exerciseIndex].sets;
            const prevSet = sets[sets.length - 1];
            updated[exerciseIndex] = {
                ...updated[exerciseIndex],
                sets: [
                    ...sets,
                    {
                        id: Math.random().toString(),
                        weight_kg: prevSet ? prevSet.weight_kg : '',
                        reps: prevSet ? prevSet.reps : '',
                        rir: '',
                        completed: false,
                    },
                ],
            };
            return updated;
        });
    }, []);

    const removeSet = useCallback((exerciseIndex: number, setIndex: number) => {
        Alert.alert('Remove Set', 'Delete this set?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setUserExercises((prev) => {
                        const updated = [...prev];
                        const sets = [...updated[exerciseIndex].sets];
                        sets.splice(setIndex, 1);
                        updated[exerciseIndex] = { ...updated[exerciseIndex], sets };
                        return updated;
                    });
                },
            },
        ]);
    }, []);

    const updateSet = useCallback(
        (exerciseIndex: number, setIndex: number, field: keyof ExerciseSet, value: any) => {
            setUserExercises((prev) => {
                const updated = [...prev];
                const sets = [...updated[exerciseIndex].sets];
                const wasCompleted = sets[setIndex].completed;
                sets[setIndex] = { ...sets[setIndex], [field]: value };
                updated[exerciseIndex] = { ...updated[exerciseIndex], sets };

                // Trigger rest timer when a set becomes completed
                if (field === 'completed' && value === true && !wasCompleted) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Start rest timer (via setTimeout to avoid setState-in-setState)
                    setTimeout(() => startRestTimer(), 0);
                }

                return updated;
            });
        },
        [startRestTimer],
    );

    const removeExercise = useCallback((index: number) => {
        Alert.alert('Remove Exercise', 'Are you sure you want to remove this exercise?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setUserExercises((prev) => {
                        const updated = [...prev];
                        updated.splice(index, 1);
                        return updated;
                    });
                },
            },
        ]);
    }, []);

    // -----------------------------------------------------------------------
    // Number Picker Bottom Sheet
    // -----------------------------------------------------------------------

    const openPicker = useCallback(
        (exerciseIndex: number, setIndex: number, type: 'weight' | 'reps') => {
            const set = userExercises[exerciseIndex]?.sets[setIndex];
            if (!set) return;

            const raw = type === 'weight' ? set.weight_kg : set.reps;
            const numVal = parseFloat(String(raw || 0)) || 0;

            setPickerConfig({
                visible: true,
                type,
                exerciseIndex,
                setIndex,
                currentValue: numVal,
            });

            Animated.spring(pickerSlideAnim, {
                toValue: 0,
                useNativeDriver: true,
                speed: 14,
                bounciness: 4,
            }).start();
        },
        [userExercises, pickerSlideAnim],
    );

    const closePicker = useCallback(() => {
        Animated.timing(pickerSlideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setPickerConfig((prev) => ({ ...prev, visible: false }));
        });
    }, [pickerSlideAnim]);

    const handlePickerConfirm = useCallback(
        (value: number) => {
            const field = pickerConfig.type === 'weight' ? 'weight_kg' : 'reps';
            updateSet(pickerConfig.exerciseIndex, pickerConfig.setIndex, field, value);
            closePicker();
        },
        [pickerConfig, updateSet, closePicker],
    );

    // -----------------------------------------------------------------------
    // Finish Workout
    // -----------------------------------------------------------------------

    const handleFinish = async () => {
        if (userExercises.length === 0) {
            toast.error('Empty Workout', 'Add at least one exercise to log.');
            return;
        }

        setLoading(true);
        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const durationMinutes = Math.round(
                (new Date().getTime() - startTime.getTime()) / 60000,
            );

            const result = await workoutsAPI.log({
                workout_type: workoutType,
                exercises: JSON.stringify(userExercises),
                notes: 'Logged via Smart Log',
                visibility: visibility,
            });

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

    // -----------------------------------------------------------------------
    // FlatList helpers
    // -----------------------------------------------------------------------

    const keyExtractor = useCallback((item: UserExercise, index: number) => `${item.id}-${index}`, []);

    const renderExercise = useCallback(
        ({ item, index }: { item: UserExercise; index: number }) => (
            <ExerciseCard
                exercise={item}
                exerciseIndex={index}
                onUpdateSet={updateSet}
                onAddSet={addSet}
                onRemoveExercise={removeExercise}
                onRemoveSet={removeSet}
                onOpenPicker={openPicker}
            />
        ),
        [updateSet, addSet, removeExercise, removeSet, openPicker],
    );

    // Header component for FlatList
    const ListHeader = useMemo(
        () => (
            <View>
                {/* Workout Type Selector */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>WORKOUT TYPE</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.typeRow}
                    >
                        {WORKOUT_TYPES.map((type) => (
                            <TouchableOpacity
                                key={type}
                                onPress={() => setWorkoutType(type)}
                                style={[
                                    styles.typePill,
                                    workoutType === type && styles.typePillActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.typePillText,
                                        workoutType === type && styles.typePillTextActive,
                                    ]}
                                >
                                    {type.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Repeat Last Banner - Loading */}
                {fetchingLastWorkout && !lastWorkoutPreview && userExercises.length === 0 && (
                    <View style={[styles.repeatBanner, { opacity: 0.5 }]}>
                        <View style={styles.repeatBannerLeft}>
                            <ActivityIndicator size="small" color={colors.text.muted} />
                            <View>
                                <Text style={styles.repeatSubtitle}>Loading previous workout...</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Repeat Last Banner */}
                {lastWorkoutPreview && lastWorkoutPreview.length > 0 && userExercises.length === 0 && (
                    <TouchableOpacity
                        style={styles.repeatBanner}
                        onPress={() => setShowRepeatPreview(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.repeatBannerLeft}>
                            <MaterialIcons name="replay" size={18} color={colors.text.primary} />
                            <View>
                                <Text style={styles.repeatTitle}>Repeat Last Workout</Text>
                                <Text style={styles.repeatSubtitle}>
                                    {lastWorkoutPreview.length} exercise{lastWorkoutPreview.length !== 1 ? 's' : ''} from your previous {workoutType} session
                                </Text>
                            </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color={colors.text.muted} />
                    </TouchableOpacity>
                )}

                {/* Exercises section label */}
                {userExercises.length > 0 && (
                    <Text style={[styles.sectionLabel, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>
                        EXERCISES
                    </Text>
                )}
            </View>
        ),
        [workoutType, lastWorkoutPreview, userExercises.length],
    );

    // Footer component for FlatList
    const ListFooter = useMemo(
        () => (
            <View style={{ paddingBottom: 140 }}>
                {/* Browse Templates Button */}
                <TouchableOpacity
                    style={styles.browseTemplatesBtn}
                    onPress={() =>
                        router.push({
                            pathname: '/member/curated-workouts',
                            params: { workoutType },
                        })
                    }
                    activeOpacity={0.7}
                >
                    <MaterialIcons name="library-books" size={18} color={colors.text.secondary} />
                    <Text style={styles.browseTemplatesText}>Browse Templates</Text>
                    <MaterialIcons name="chevron-right" size={18} color={colors.text.muted} />
                </TouchableOpacity>

                {/* Add Exercise Ghost Button */}
                <TouchableOpacity
                    style={styles.addExerciseBtn}
                    onPress={() => setShowPicker(true)}
                    activeOpacity={0.7}
                >
                    <MaterialIcons name="add" size={20} color={colors.text.muted} />
                    <Text style={styles.addExerciseText}>Add Exercise</Text>
                </TouchableOpacity>
            </View>
        ),
        [workoutType],
    );

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
                    <MaterialIcons name="close" size={22} color={colors.text.muted} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerLabel}>LOG WORKOUT</Text>
                    <Text style={styles.headerTitle}>
                        {workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}
                    </Text>
                </View>
                <View style={styles.headerBtn} />
            </View>

            {/* Exercise List */}
            <FlatList
                data={userExercises}
                keyExtractor={keyExtractor}
                renderItem={renderExercise}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={Platform.OS === 'android'}
            />

            {/* Floating Rest Timer */}
            {restActive && restSeconds > 0 && (
                <RestTimerPill
                    seconds={restSeconds}
                    onDismiss={dismissRestTimer}
                    onChangeDuration={() => setShowRestConfig(true)}
                />
            )}

            {/* Visibility Picker */}
            {shareLogs && (
                <View style={styles.visibilityBar}>
                    <Text style={styles.visibilityLabel}>Who sees this workout?</Text>
                    <View style={styles.visibilityOptions}>
                        <TouchableOpacity
                            style={[
                                styles.visibilityOption,
                                visibility === 'friends' && styles.visibilityOptionActive
                            ]}
                            onPress={() => setVisibility('friends')}
                        >
                            <MaterialIcons
                                name="people"
                                size={16}
                                color={visibility === 'friends' ? colors.primary : colors.text.muted}
                            />
                            <Text style={[
                                styles.visibilityOptionText,
                                visibility === 'friends' && { color: colors.primary }
                            ]}>Friends</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.visibilityOption,
                                visibility === 'private' && styles.visibilityOptionActive
                            ]}
                            onPress={() => setVisibility('private')}
                        >
                            <MaterialIcons
                                name="lock"
                                size={16}
                                color={visibility === 'private' ? colors.primary : colors.text.muted}
                            />
                            <Text style={[
                                styles.visibilityOptionText,
                                visibility === 'private' && { color: colors.primary }
                            ]}>Only Me</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Fixed Bottom: Finish Workout */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
                <TouchableOpacity
                    style={[styles.finishBtn, loading && { opacity: 0.5 }]}
                    onPress={handleFinish}
                    disabled={loading}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.background} size="small" />
                    ) : (
                        <Text style={styles.finishBtnText}>Finish Workout</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* -------- MODALS -------- */}

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
                        <TouchableOpacity onPress={() => setShowPicker(false)} hitSlop={12}>
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

            {/* Repeat Last Preview Modal */}
            <Modal
                visible={showRepeatPreview}
                animationType="fade"
                transparent
                onRequestClose={() => setShowRepeatPreview(false)}
            >
                <Pressable
                    style={styles.overlay}
                    onPress={() => setShowRepeatPreview(false)}
                >
                    <Pressable style={styles.previewSheet} onPress={() => {}}>
                        <Text style={styles.previewTitle}>Previous {workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Workout</Text>
                        <Text style={styles.previewSubtitle}>
                            {lastWorkoutPreview?.length || 0} exercises will be loaded
                        </Text>

                        <ScrollView style={styles.previewList} showsVerticalScrollIndicator={false}>
                            {lastWorkoutPreview?.map((ex, i) => (
                                <View key={`${ex.id}-${i}`} style={styles.previewItem}>
                                    <Text style={styles.previewExName}>{ex.name}</Text>
                                    <Text style={styles.previewExSets}>
                                        {ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}
                                        {ex.sets[0]?.weight_kg ? ` @ ${ex.sets[0].weight_kg}kg` : ''}
                                    </Text>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.previewActions}>
                            <TouchableOpacity
                                style={styles.previewCancelBtn}
                                onPress={() => setShowRepeatPreview(false)}
                            >
                                <Text style={styles.previewCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.previewLoadBtn}
                                onPress={handleRepeatLast}
                            >
                                <Text style={styles.previewLoadText}>Load Workout</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Rest Duration Config Modal */}
            <Modal
                visible={showRestConfig}
                animationType="fade"
                transparent
                onRequestClose={() => setShowRestConfig(false)}
            >
                <Pressable
                    style={styles.overlay}
                    onPress={() => setShowRestConfig(false)}
                >
                    <Pressable style={styles.restConfigSheet} onPress={() => {}}>
                        <Text style={styles.restConfigTitle}>Rest Timer</Text>
                        <Text style={styles.restConfigSubtitle}>Choose your rest duration</Text>

                        <View style={styles.restOptions}>
                            {REST_PRESETS.map((dur) => (
                                <TouchableOpacity
                                    key={dur}
                                    style={[
                                        styles.restOptionPill,
                                        restDuration === dur && styles.restOptionPillActive,
                                    ]}
                                    onPress={() => {
                                        setRestDuration(dur);
                                        Haptics.selectionAsync();
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.restOptionText,
                                            restDuration === dur && styles.restOptionTextActive,
                                        ]}
                                    >
                                        {dur >= 60 ? `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, '0')}` : `${dur}s`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.restConfigDone}
                            onPress={() => {
                                setShowRestConfig(false);
                                // Restart with new duration if active
                                if (restActive) startRestTimer();
                            }}
                        >
                            <Text style={styles.restConfigDoneText}>Done</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Number Picker Bottom Sheet */}
            {pickerConfig.visible && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    {/* Backdrop */}
                    <Pressable style={styles.pickerBackdrop} onPress={closePicker} />

                    <Animated.View
                        style={[
                            styles.pickerSheet,
                            {
                                transform: [{ translateY: pickerSlideAnim }],
                                paddingBottom: insets.bottom + spacing.md,
                            },
                        ]}
                    >
                        {/* Picker header */}
                        <View style={styles.pickerHeader}>
                            <TouchableOpacity onPress={closePicker}>
                                <Text style={styles.pickerCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.pickerTitle}>
                                {pickerConfig.type === 'weight' ? 'Weight (kg)' : 'Reps'}
                            </Text>
                            <TouchableOpacity
                                onPress={() => handlePickerConfirm(pickerConfig.currentValue)}
                            >
                                <Text style={styles.pickerDoneText}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Scroll wheel */}
                        <ScrollWheelPicker
                            values={pickerConfig.type === 'weight' ? WEIGHT_VALUES : REPS_VALUES}
                            selectedValue={pickerConfig.currentValue}
                            onValueChange={(v) =>
                                setPickerConfig((prev) => ({ ...prev, currentValue: v }))
                            }
                            formatLabel={
                                pickerConfig.type === 'weight'
                                    ? (v) => (v % 1 === 0 ? v.toString() : v.toFixed(1))
                                    : undefined
                            }
                        />
                    </Animated.View>
                </View>
            )}
        </SafeAreaView>
    );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
    // Layout
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    listContainer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    headerBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerLabel: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginTop: 2,
    },

    // Section
    section: {
        marginBottom: spacing.lg,
    },
    sectionLabel: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.sm,
    },

    // Type pills
    typeRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    typePill: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    typePillActive: {
        backgroundColor: colors.primary + '18',
        borderColor: colors.primary,
    },
    typePillText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
    },
    typePillTextActive: {
        color: colors.primary,
    },

    // Repeat Last Banner
    repeatBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.lg,
    },
    repeatBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flex: 1,
    },
    repeatTitle: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    repeatSubtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },

    // Browse templates button
    browseTemplatesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        marginBottom: spacing.sm,
    },
    browseTemplatesText: {
        flex: 1,
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },

    // Add exercise ghost button
    addExerciseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        borderStyle: 'dashed',
        marginTop: spacing.sm,
    },
    addExerciseText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },

    // Bottom bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    finishBtn: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.glow,
    },
    finishBtnText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
    },

    // Modals
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

    // Overlay / backdrop
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },

    // Repeat-last preview sheet
    previewSheet: {
        width: '100%',
        maxHeight: SCREEN_HEIGHT * 0.6,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    previewTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: 4,
    },
    previewSubtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginBottom: spacing.lg,
    },
    previewList: {
        maxHeight: SCREEN_HEIGHT * 0.3,
        marginBottom: spacing.lg,
    },
    previewItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    previewExName: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        textTransform: 'capitalize',
        flex: 1,
    },
    previewExSets: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    previewActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    previewCancelBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
    },
    previewCancelText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
    },
    previewLoadBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.primary,
    },
    previewLoadText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
    },

    // Rest config modal
    restConfigSheet: {
        width: '100%',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
        alignItems: 'center',
    },
    restConfigTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: 4,
    },
    restConfigSubtitle: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginBottom: spacing.xl,
    },
    restOptions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    restOptionPill: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    restOptionPillActive: {
        backgroundColor: colors.primary + '18',
        borderColor: colors.primary,
    },
    restOptionText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
    },
    restOptionTextActive: {
        color: colors.primary,
    },
    restConfigDone: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.primary,
    },
    restConfigDoneText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
    },

    // Number picker bottom sheet
    pickerBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    pickerSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: colors.glass.borderLight,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    pickerCancelText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    pickerTitle: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    pickerDoneText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    visibilityBar: {
        position: 'absolute',
        bottom: 72,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        backgroundColor: colors.background,
    },
    visibilityLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    visibilityOptions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    visibilityOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    visibilityOptionActive: {
        backgroundColor: colors.primary + '20',
        borderColor: colors.primary,
    },
    visibilityOptionText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
});

export default WorkoutLogScreen;
