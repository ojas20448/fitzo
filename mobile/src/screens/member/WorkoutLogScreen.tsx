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
    KeyboardAvoidingView,
    LayoutAnimation,
    TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from '../../utils/haptics';
import { workoutsAPI, settingsAPI, aiAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import ExerciseList from '../../components/ExerciseList';
import { WorkoutDraftSheet } from '../../components/WorkoutDraftSheet';
import { useToast } from '../../components/Toast';
import VoiceCaptureSheet from '../../components/VoiceCaptureSheet';
import { hasSeenTip, markTipSeen, TIP_KEYS } from '../../utils/firstRun';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import {
    ScrollWheelPicker,
    RestTimerPill,
    ExerciseCard,
    WorkoutPrefsSheet,
    WarmUpCard,
    PICKER_HEIGHT,
    WEIGHT_VALUES,
    REPS_VALUES,
    RIR_VALUES,
    REST_PRESETS,
} from '../../components/workout';
import type { ExerciseSet, UserExercise, PickerConfig } from '../../components/workout';
import { useLastSessionStore } from '../../stores/lastSessionStore';
import { normalizePrs } from '../../utils/normalizePr';
import { buildShareExercises } from '../../utils/buildShareExercises';

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

    const getAllowedBodyParts = (type: string, sessionLabel?: string) => {
        const label = (sessionLabel || type || '').toLowerCase();
        if (label.includes('push')) return ['chest', 'shoulders', 'arms'];
        if (label.includes('pull')) return ['back', 'arms'];
        if (label.includes('leg')) return ['legs', 'core'];
        if (label.includes('chest')) return ['chest', 'shoulders', 'arms'];
        if (label.includes('back')) return ['back', 'arms'];
        if (label.includes('shoulder')) return ['shoulders', 'arms'];
        if (label.includes('arm')) return ['arms'];
        if (label.includes('upper')) return ['chest', 'back', 'shoulders', 'arms'];
        if (label.includes('lower')) return ['legs', 'core'];
        if (label.includes('cardio')) return ['cardio'];
        return undefined;
    };

    // workoutType is still the value persisted to the API and used to look up the
    // previous session, but it is now derived only — never chosen by hand.
    const [workoutType, setWorkoutType] = useState(
        mapIntentToType(initialIntent?.session_label || ''),
    );

    // What the user actually declared ("Push"), not the muscle it collapses to.
    // mapIntentToType has to fold push -> chest because WORKOUT_TYPES has no
    // push/pull concept, which is why the header used to read "Chest" on a push
    // day. Show the intent's own words when we have them.
    const sessionLabel = (initialIntent?.session_label || initialIntent?.display || '').trim();
    const sessionTitle = sessionLabel
        ? sessionLabel.charAt(0).toUpperCase() + sessionLabel.slice(1)
        : workoutType.charAt(0).toUpperCase() + workoutType.slice(1);

    // Muscles this session trains, used both as the header subtitle and to filter
    // the exercise picker.
    const sessionMuscles = useMemo(
        () => getAllowedBodyParts(workoutType, sessionLabel) ?? [],
        [workoutType, sessionLabel],
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
    // Opt-in. The pill fired after every set and floated over the log, which
    // read as nagging mid-session. Rest intervals still matter for strength
    // work, so the feature stays — you just have to ask for it.
    const [restTimerEnabled, setRestTimerEnabled] = useState(false);
    const [showWarmUp, setShowWarmUp] = useState(false);
    const [restActive, setRestActive] = useState(false);
    const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Optional RIR logging — opt-in via Settings
    const [showRir, setShowRir] = useState(false);
    const [showPrefsSheet, setShowPrefsSheet] = useState(false);

    const [showDraftSheet, setShowDraftSheet] = useState(false);
    const [draftItems, setDraftItems] = useState<any[]>([]);
    const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);

    const voice = useVoiceCapture({
        mode: 'workout',
        onResult: (items) => {
            setVoiceSheetOpen(false);
            setDraftItems(items);
            setShowDraftSheet(true);
        },
        onError: (title, message) => {
            setVoiceSheetOpen(false);
            toast.error(title, message);
        },
    });

    const openVoice = async () => {
        setVoiceSheetOpen(true);
        await voice.start();
    };

    const cancelVoice = async () => {
        await voice.cancel();
        setVoiceSheetOpen(false);
    };

    // A previous session must not survive into a new one. This is the primary
    // guard; the store's staleness window only covers a crash between screens.
    useEffect(() => { useLastSessionStore.getState().clearSession(); }, []);

    // First visit only: point out that the whole workout can be dictated. The
    // mic is otherwise just another icon in a busy header.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (await hasSeenTip(TIP_KEYS.voiceWorkout)) return;
            if (cancelled) return;
            await markTipSeen(TIP_KEYS.voiceWorkout);
            Alert.alert(
                'Log with your voice',
                'Tap the mic and just say it — "bench press 3 sets of 8 at 60 kilos". Fitzo fills in the sets for you.',
                [{ text: 'Got it' }],
            );
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        loadSharingPreference();
        settingsAPI.getWorkoutPreferences()
            .then((p) => {
                setShowRir(!!p.log_rir_enabled);
                setRestTimerEnabled(!!p.rest_timer_enabled);
                setShowWarmUp(p.warmup_card_enabled !== false);
                if (!p.workout_prefs_seen) setShowPrefsSheet(true);
            })
            .catch(() => {
                // Offline or a pre-migration backend. Match the column defaults:
                // rest timer off (it was the complaint), warm-up shown.
                setShowRir(false);
                setRestTimerEnabled(false);
                setShowWarmUp(true);
            });
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

    const restTargetTimeRef = useRef<number | null>(null);

    const startRestTimer = useCallback(() => {
        if (restIntervalRef.current) clearInterval(restIntervalRef.current);

        const targetTime = Date.now() + restDuration * 1000;
        restTargetTimeRef.current = targetTime;
        setRestSeconds(restDuration);
        setRestActive(true);

        restIntervalRef.current = setInterval(() => {
            if (!restTargetTimeRef.current) return;
            const diff = Math.max(0, Math.ceil((restTargetTimeRef.current - Date.now()) / 1000));
            setRestSeconds(diff);

            if (diff <= 0) {
                clearInterval(restIntervalRef.current!);
                restIntervalRef.current = null;
                restTargetTimeRef.current = null;
                setRestActive(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        }, 500);
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
                    // Auto-fill exercises into current log if user has no exercises set yet
                    if (!params.curatedExercises) {
                        setUserExercises((prev) => (prev.length === 0 ? prefilled : prev));
                    }
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

    // "60kg → Bar + 20 · 2.5 per side" — standard 20kg bar, standard plates
    const plateBreakdown = (total: number): string => {
        const BAR = 20;
        if (!total || total <= BAR) return total === BAR ? 'Empty bar (20 kg)' : ' ';
        const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
        let perSide = (total - BAR) / 2;
        const used: string[] = [];
        for (const p of PLATES) {
            while (perSide >= p - 0.001) {
                used.push(p % 1 === 0 ? String(p) : String(p));
                perSide -= p;
            }
        }
        if (used.length === 0) return ' ';
        const rem = perSide > 0.001 ? ` (+${perSide.toFixed(2)})` : '';
        return `Bar + ${used.join(' · ')} per side${rem}`;
    };

    const handleAddExercise = useCallback(
        (exercise: any) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Previous-set ghosting: if this exercise appeared in the last
            // workout of this type, pre-create the same number of sets, each
            // showing last session's numbers as a hint (values stay empty).
            const prevExercise = lastWorkoutPreview?.find(
                (e) => e.name.toLowerCase() === String(exercise.name).toLowerCase(),
            );
            const ghostSets =
                prevExercise && prevExercise.sets.length > 0
                    ? prevExercise.sets.map((s) => ({
                          id: Math.random().toString(),
                          weight_kg: '',
                          reps: '',
                          rir: '',
                          completed: false,
                          previous: s.previous,
                      }))
                    : [
                          {
                              id: Math.random().toString(),
                              weight_kg: '',
                              reps: '',
                              rir: '',
                              completed: false,
                          },
                      ];

            const newExercise: UserExercise = {
                id: exercise.id,
                name: exercise.name,
                gifUrl: exercise.gifUrl,
                target: exercise.target,
                sets: ghostSets,
            };
            setUserExercises((prev) => [...prev, newExercise]);
            setShowPicker(false);
        },
        [lastWorkoutPreview],
    );

    const addSet = useCallback((exerciseIndex: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
                        previous: prevSet?.previous,
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
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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

                // Layered double-pulse haptics when a set becomes completed.
                if (field === 'completed' && value === true && !wasCompleted) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setTimeout(() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }, 80);
                    // The rest timer is opt-in, so completing a set no longer
                    // pops a countdown unless it was asked for.
                    if (restTimerEnabled) {
                        // setTimeout avoids setState-in-setState.
                        setTimeout(() => startRestTimer(), 0);
                    }
                }

                return updated;
            });
        },
        [startRestTimer, restTimerEnabled],
    );

    const handleToggleUnilateral = useCallback((eIdx: number) => {
        setUserExercises((prev) =>
            prev.map((ex, i) => (i === eIdx ? { ...ex, is_unilateral: !ex.is_unilateral } : ex)),
        );
    }, []);

    const removeExercise = useCallback((index: number) => {
        Alert.alert('Remove Exercise', 'Are you sure you want to remove this exercise?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
        (exerciseIndex: number, setIndex: number, type: 'weight' | 'reps' | 'rir') => {
            const set = userExercises[exerciseIndex]?.sets[setIndex];
            if (!set) return;

            const raw = type === 'weight' ? set.weight_kg : type === 'rir' ? set.rir : set.reps;
            const numVal = parseFloat(String(raw || 0)) || 0;

            setTypingValue(null); // always open on the wheel
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

    // Measured, not guessed: the footer's height changes with the safe-area inset
    // and with whether the visibility bar is shown, so the list's bottom padding
    // has to follow it or the last exercise hides underneath.
    const [footerHeight, setFooterHeight] = useState(140);

    // null = wheel mode; a string = keyboard mode holding the in-progress text.
    // Kept as a string so a half-typed "9." doesn't get coerced to a number.
    const [typingValue, setTypingValue] = useState<string | null>(null);

    const toggleTyping = useCallback(() => {
        setTypingValue((prev) => {
            if (prev !== null) {
                // Leaving keyboard mode: carry what was typed back to the wheel.
                const parsed = parseFloat(prev);
                if (Number.isFinite(parsed)) {
                    setPickerConfig((cfg) => ({ ...cfg, currentValue: parsed }));
                }
                return null;
            }
            const v = pickerConfig.currentValue;
            // Number.isFinite, not truthiness: 0 is a real value. For RIR it
            // means "went to failure", so blanking it here would read back as
            // "not recorded" — a different thing entirely.
            return Number.isFinite(v) ? String(v % 1 === 0 ? v : Number(v.toFixed(2))) : '';
        });
    }, [pickerConfig.currentValue]);

    const closePicker = useCallback(() => {
        Animated.timing(pickerSlideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
        }).start(() => {
            setPickerConfig((prev) => ({ ...prev, visible: false }));
            setTypingValue(null);
        });
    }, [pickerSlideAnim]);

    const handlePickerConfirm = useCallback(
        (value: number) => {
            const field =
                pickerConfig.type === 'weight' ? 'weight_kg' : pickerConfig.type === 'rir' ? 'rir' : 'reps';
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

            const sessionLabel = initialIntent?.session_label || workoutType;
            const result = await workoutsAPI.log({
                workout_type: workoutType,
                day_name: sessionLabel,
                exercises: JSON.stringify(userExercises),
                notes: 'Logged via Smart Log',
                visibility: visibility,
                duration_minutes: Math.max(durationMinutes, 1),
            });

            let totalVolume = 0;
            let totalSets = 0;
            for (const ex of userExercises) {
                for (const s of ex.sets) {
                    const w = parseFloat(String(s.weight_kg || 0));
                    const r = parseFloat(String(s.reps || 0));
                    if (w > 0 && r > 0) {
                        // Same rule as backend/src/utils/volume.js — unilateral
                        // reps are per side, so both sides count.
                        totalVolume += w * r * (ex.is_unilateral ? 2 : 1);
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

            useLastSessionStore.getState().setSession({
                completedAt: Date.now(),
                title: sessionTitle || workoutType || 'Workout',
                durationMin: Math.max(durationMinutes, 1),
                volumeKg: Math.round(totalVolume),
                setCount: totalSets,
                prs: normalizePrs(result.prs),
                exercises: buildShareExercises(userExercises),
            });

            router.replace({
                pathname: '/member/workout-recap',
                params: {
                    recap: JSON.stringify(recap),
                    session: JSON.stringify({
                        // Match the header: the recap should say "Push", not "Chest".
                        name: sessionTitle,
                        day_name: workoutType,
                        emphasis: sessionMuscles.length ? sessionMuscles : [workoutType],
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
                showRir={showRir}
                onUpdateSet={updateSet}
                onAddSet={addSet}
                onRemoveExercise={removeExercise}
                onRemoveSet={removeSet}
                onToggleUnilateral={handleToggleUnilateral}
                onOpenPicker={openPicker}
            />
        ),
        [showRir, updateSet, addSet, removeExercise, removeSet, handleToggleUnilateral, openPicker],
    );

    // Header component for FlatList
    const ListHeader = useMemo(
        () => (
            <View>
                {/* Warm-up sits above the exercises: read it, tick it off, or
                    skip it. It never blocks getting to the first set. */}
                {showWarmUp && (
                    <WarmUpCard
                        workoutType={workoutType}
                        onDismiss={() => setShowWarmUp(false)}
                        onNeverShowAgain={() => {
                            setShowWarmUp(false);
                            settingsAPI
                                .updateWorkoutPreferences({ warmup_card_enabled: false })
                                .catch(() => {});
                        }}
                    />
                )}
                {/* The manual WORKOUT TYPE pill row lived here. It was removed:
                    the session is already declared as an intent (e.g. "Push"),
                    and the row could only express single muscles, so a push day
                    had to be mislabelled as "Chest". The session now takes its
                    name from the intent, and the exercise picker filters to the
                    muscles that session actually trains via getAllowedBodyParts. */}
                {sessionMuscles.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>TRAINING TODAY</Text>
                        <Text style={styles.sessionMuscles}>
                            {sessionMuscles.map((m) => m.toUpperCase()).join(' · ')}
                        </Text>
                    </View>
                )}

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
        // showWarmUp must be here — without it the memo holds the old header and
        // dismissing the warm-up card does nothing on screen.
        [workoutType, sessionMuscles, lastWorkoutPreview, userExercises.length, showWarmUp],
    );

    // Footer component for FlatList
    const ListFooter = useMemo(
        () => (
            <View style={{ paddingBottom: footerHeight + spacing.lg }}>
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

                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                    <TouchableOpacity
                        style={[styles.addExerciseBtn, { flex: 1, marginTop: 0 }]}
                        onPress={() => setShowPicker(true)}
                        activeOpacity={0.7}
                    >
                        <MaterialIcons name="add" size={20} color={colors.text.muted} />
                        <Text style={styles.addExerciseText}>Add Exercise</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.addExerciseBtn, { width: 60, marginTop: 0 }]}
                        onPress={openVoice}
                        disabled={voice.isBusy}
                        activeOpacity={0.7}
                        accessibilityLabel="Log exercises by voice"
                    >
                        {voice.isBusy ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <MaterialIcons name="mic" size={20} color={colors.text.muted} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        ),
        // footerHeight must be here: it is measured after first layout, and
        // without it the memo keeps the initial 140 forever and the last
        // exercise stays hidden behind the footer.
        [workoutType, footerHeight],
    );

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
            <VoiceCaptureSheet
                visible={voiceSheetOpen}
                stage={voice.stage}
                durationLabel={voice.durationLabel}
                durationProgress={voice.durationProgress}
                hint={'Say it like you would to a friend — "3 sets of bench press at 60 kilos, 10 reps"'}
                onCancel={cancelVoice}
                onDone={voice.stopAndProcess}
            />

            <WorkoutDraftSheet
                visible={showDraftSheet}
                onClose={() => setShowDraftSheet(false)}
                items={draftItems}
                onConfirm={(added) => {
                    const enhanced = added.map(ex => ({
                        ...ex,
                        id: Math.random().toString(),
                        sets: ex.sets.map(s => ({...s, id: Math.random().toString(), completed: false}))
                    }));
                    setUserExercises(prev => [...prev, ...enhanced as any]);
                    setShowDraftSheet(false);
                }}
            />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
                    <MaterialIcons name="close" size={22} color={colors.text.muted} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerLabel}>LOG WORKOUT</Text>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {sessionTitle}
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
                    onAddSeconds={(secs) => setRestSeconds((prev) => prev + secs)}
                />
            )}

            {/* Fixed footer: visibility + finish.
                These used to be two separately-positioned absolute bars, with the
                visibility bar pinned at a hardcoded `bottom: 72` that guessed the
                finish bar's height. The real height is
                paddingTop + button + insets.bottom + paddingBottom, so on any
                device with a home indicator (insets.bottom = 34) the finish bar
                grew to ~110 and covered the visibility options. Stacking them in
                one container removes the guess entirely. */}
            <View
                style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}
                onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            >
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

            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.finishBtn, loading && { opacity: 0.5 }]}
                    onPress={handleFinish}
                    disabled={loading}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Finish workout"
                >
                    {loading ? (
                        <ActivityIndicator color={colors.background} size="small" />
                    ) : (
                        <Text style={styles.finishBtnText}>Finish Workout</Text>
                    )}
                </TouchableOpacity>
            </View>
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
                        allowedBodyParts={getAllowedBodyParts(workoutType, initialIntent?.session_label)}
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
                        <Text style={styles.restConfigSubtitle}>
                            {restTimerEnabled
                                ? 'A countdown appears after each completed set'
                                : 'Off — completing a set will not interrupt you'}
                        </Text>

                        <Pressable
                            style={styles.restToggleRow}
                            onPress={() => {
                                const next = !restTimerEnabled;
                                setRestTimerEnabled(next);
                                Haptics.selectionAsync();
                                if (!next) dismissRestTimer();
                                // Fire-and-forget: the toggle already applies
                                // locally, so a failed sync must not block it.
                                settingsAPI
                                    .updateWorkoutPreferences({ rest_timer_enabled: next })
                                    .catch(() => {});
                            }}
                        >
                            <Text style={styles.restToggleLabel}>Show rest timer</Text>
                            <View style={[styles.restToggle, restTimerEnabled && styles.restToggleActive]}>
                                <View
                                    style={[
                                        styles.restToggleKnob,
                                        restTimerEnabled && styles.restToggleKnobActive,
                                    ]}
                                />
                            </View>
                        </Pressable>

                        <View style={[styles.restOptions, !restTimerEnabled && { opacity: 0.4 }]}
                            pointerEvents={restTimerEnabled ? 'auto' : 'none'}
                        >
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
                            <TouchableOpacity onPress={closePicker} hitSlop={12}>
                                <Text style={styles.pickerCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.pickerTitle}>
                                {pickerConfig.type === 'weight'
                                    ? 'Weight (kg)'
                                    : pickerConfig.type === 'rir'
                                        ? 'RIR'
                                        : 'Reps'}
                            </Text>
                            <TouchableOpacity
                                onPress={() => handlePickerConfirm(typingValue !== null
                                    ? (parseFloat(typingValue) || 0)
                                    : pickerConfig.currentValue)}
                                hitSlop={12}
                            >
                                <Text style={styles.pickerDoneText}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Type / wheel toggle. Scrolling is fine for nudging a
                            weight, but hopeless for jumping to an exact number. */}
                        <TouchableOpacity
                            style={styles.pickerModeToggle}
                            onPress={toggleTyping}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={typingValue !== null ? 'Use scroll wheel' : 'Type a value'}
                        >
                            <MaterialIcons
                                name={typingValue !== null ? 'toll' : 'keyboard'}
                                size={16}
                                color={colors.text.secondary}
                            />
                            <Text style={styles.pickerModeToggleText}>
                                {typingValue !== null ? 'USE WHEEL' : 'TYPE A NUMBER'}
                            </Text>
                        </TouchableOpacity>

                        {typingValue !== null ? (
                            <View style={styles.pickerTypeWrap}>
                                <TextInput
                                    style={styles.pickerTypeInput}
                                    value={typingValue}
                                    onChangeText={setTypingValue}
                                    keyboardType="decimal-pad"
                                    autoFocus
                                    selectTextOnFocus
                                    placeholder="0"
                                    placeholderTextColor={colors.text.subtle}
                                    returnKeyType="done"
                                    onSubmitEditing={() =>
                                        handlePickerConfirm(parseFloat(typingValue) || 0)
                                    }
                                />
                                <Text style={styles.pickerTypeUnit}>
                                    {pickerConfig.type === 'weight'
                                        ? 'kg'
                                        : pickerConfig.type === 'rir'
                                            ? 'rir'
                                            : 'reps'}
                                </Text>
                            </View>
                        ) : (
                            <ScrollWheelPicker
                                values={
                                    pickerConfig.type === 'weight'
                                        ? WEIGHT_VALUES
                                        : pickerConfig.type === 'rir'
                                            ? RIR_VALUES
                                            : REPS_VALUES
                                }
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
                        )}

                        {/* Live plate calculator (barbell math: 20kg bar, per side) */}
                        {pickerConfig.type === 'weight' && (
                            <Text style={styles.plateHint}>{plateBreakdown(pickerConfig.currentValue)}</Text>
                        )}
                    </Animated.View>
                </View>
            )}

            <WorkoutPrefsSheet
                visible={showPrefsSheet}
                rirEnabled={showRir}
                onChangeRir={(enabled) => {
                    setShowRir(enabled);
                    settingsAPI.updateWorkoutPreferences({ log_rir_enabled: enabled }).catch(() => {});
                }}
                onDismiss={() => {
                    setShowPrefsSheet(false);
                    settingsAPI.updateWorkoutPreferences({ workout_prefs_seen: true }).catch(() => {});
                }}
            />
            </KeyboardAvoidingView>
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

    // Muscles trained in this session, derived from the intent
    sessionMuscles: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
        letterSpacing: 1,
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
    // The only positioned element. Its children stack in normal flow, so the
    // finish button can never overlap the visibility options regardless of
    // safe-area inset or whether the visibility bar is shown at all.
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    bottomBar: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
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
    restToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        marginTop: spacing.md,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.glass.border,
    },
    restToggleLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    restToggle: {
        width: 44,
        height: 26,
        borderRadius: 13,
        backgroundColor: colors.glass.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.border,
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    restToggleActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    restToggleKnob: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.text.muted,
        alignSelf: 'flex-start',
    },
    restToggleKnobActive: {
        backgroundColor: colors.background,
        alignSelf: 'flex-end',
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
    pickerModeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.glass.border,
        backgroundColor: colors.glass.surface,
    },
    pickerModeToggleText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.secondary,
        letterSpacing: 1,
    },
    pickerTypeWrap: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: spacing.sm,
        // Matches ScrollWheelPicker's height (48 * 5) so swapping modes does not
        // make the sheet jump.
        height: 240,
        paddingTop: spacing['3xl'],
    },
    pickerTypeInput: {
        minWidth: 140,
        textAlign: 'center',
        fontSize: 52,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        paddingVertical: spacing.sm,
        borderBottomWidth: 2,
        borderBottomColor: colors.glass.borderLight,
    },
    pickerTypeUnit: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    plateHint: {
        textAlign: 'center',
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        paddingVertical: spacing.sm,
        minHeight: 34,
    },
    pickerDoneText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    visibilityBar: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        gap: spacing.md,
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
