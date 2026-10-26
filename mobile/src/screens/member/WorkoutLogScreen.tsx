import ScreenBackdrop from '../../components/ScreenBackdrop';
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
    Dimensions,
    Platform,
    KeyboardAvoidingView,
    LayoutAnimation,
    Keyboard,
    AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Haptics from '../../utils/haptics';
import { workoutsAPI, settingsAPI, aiAPI, exerciseAPI } from '../../services/api';
import GlassCard from '../../components/GlassCard';
import ExerciseList from '../../components/ExerciseList';
import { isExerciseSelected } from '../../utils/exerciseSearch';
import { WorkoutDraftSheet } from '../../components/WorkoutDraftSheet';
import { useToast } from '../../components/Toast';
import VoiceCaptureSheet from '../../components/VoiceCaptureSheet';
import AIConsentModal from '../../components/AIConsentModal';
import { hasSeenTip, markTipSeen, TIP_KEYS } from '../../utils/firstRun';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import {
    RestTimerPill,
    ExerciseCard,
    WorkoutPrefsSheet,
    WarmUpCard,
    REST_PRESETS,
} from '../../components/workout';
import type { ExerciseSet, UserExercise, PickerConfig } from '../../components/workout';
import { useLastSessionStore } from '../../stores/lastSessionStore';
import { normalizePrs } from '../../utils/normalizePr';
import { buildShareExercises } from '../../utils/buildShareExercises';
import { finalizeWorkout } from '../../utils/finalizeWorkout';
import { cardioEntryError, isCardioExercise } from '../../utils/cardio';
import type { SetEntryField } from '../../components/workout/types';
import { useAuth } from '../../context/AuthContext';
import { useWorkoutInputMode } from '../../hooks/useWorkoutInputMode';
import { chooseWorkoutDraft, parseWorkoutIntent, previousWorkoutDraft } from '../../utils/workoutSetup';
import { loadActiveWorkoutDraft, saveActiveWorkoutDraft, clearActiveWorkoutDraft } from '../../utils/activeWorkoutDraft';
import type { ActiveWorkoutDraft } from '../../utils/activeWorkoutDraft';
import { syncWorkoutActivity } from '../../services/workoutActivity';
import WorkoutCategorySheet from '../../components/workout/WorkoutCategorySheet';
import Button from '../../components/Button';
import ConfirmationSheet, { type ConfirmationAction } from '../../components/ConfirmationSheet';
import WorkoutExercisesSheet from '../../components/workout/WorkoutExercisesSheet';
import WorkoutSetEditor from '../../components/workout/WorkoutSetEditor';
import { invalidateExerciseHistory } from '../../hooks/useExerciseHistory';
import { routineUpdate } from '../../utils/routineUpdate';
import { workoutNumber } from '../../utils/workoutNumber';
import { useExercisePreferences } from '../../hooks/useExercisePreferences';
import ExercisePreferencesSheet from '../../components/workout/ExercisePreferencesSheet';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');



const WorkoutLogScreen: React.FC = () => {
    const toast = useToast();
    const params = useLocalSearchParams();
    const { user, token } = useAuth();
    const exercisePreferences = useExercisePreferences(user?.id);
    const [exerciseSettings, setExerciseSettings] = useState<{ owner: string; exercise: UserExercise } | null>(null);
    const settingsExercise = exerciseSettings?.owner === user?.id ? exerciseSettings?.exercise : null;
    const editExercisePreferences = useCallback((exercise: UserExercise) => {
        if (!user?.id) return;
        void exercisePreferences.reload();
        setExerciseSettings({ owner: user.id, exercise });
    }, [user?.id, exercisePreferences.reload]);
    useEffect(() => { setExerciseSettings(null); }, [user?.id]);
    const { inputMode, selectMode } = useWorkoutInputMode(user?.id);
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    const [confirmation, setConfirmation] = useState<ConfirmationAction | null>(null);
    const discardPending = useRef(false);
    const finishPending = useRef(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showExerciseEditor, setShowExerciseEditor] = useState(false);
    const replacingExercise = useRef<number | null>(null);

    // Intent parsing
    const routedIntent = useMemo(() => parseWorkoutIntent(params.intent), [params.intent]);
    const [selectedIntent, setSelectedIntent] = useState<{ session_label: string; training_pattern?: string } | null>(null);
    const initialIntent = selectedIntent || routedIntent;
    const [savedSplit, setSavedSplit] = useState<{ split_id: string; days: string[]; scheduleOnly: boolean } | null>(null);
    const [savedRoutine, setSavedRoutine] = useState<{ id: string; name: string; training_plan: unknown } | null>(null);
    const [routinePrompt, setRoutinePrompt] = useState<{ focus?: string } | null>(null);
    const savedDays = useMemo(() => Array.from(new Set(savedSplit?.days.filter(day => !/^(rest|rest day|off|recovery)$/i.test(day.trim())) || [])), [savedSplit]);
    useEffect(() => { setSelectedIntent(null); }, [params.intent]);

    const mapIntentToType = (label: string) => {
        const lower = label?.toLowerCase() || '';
        if (lower.includes('leg') || lower.includes('lower')) return 'legs';
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
    const workoutType = mapIntentToType(initialIntent?.session_label || '');

    // What the user actually declared ("Push"), not the muscle it collapses to.
    // mapIntentToType has to fold push -> chest because WORKOUT_TYPES has no
    // push/pull concept, which is why the header used to read "Chest" on a push
    // day. Show the intent's own words when we have them.
    const sessionLabel = (initialIntent?.session_label || '').trim();
    const isFreeform = sessionLabel === 'Workout' || (!sessionLabel && params.start === 'empty');
    const sessionTitle = sessionLabel
        ? sessionLabel.charAt(0).toUpperCase() + sessionLabel.slice(1)
        : 'Workout';

    // Describes the session in its recap; exercise browsing stays unrestricted.
    const sessionMuscles = useMemo(
        () => isFreeform ? [] : getAllowedBodyParts(workoutType, sessionLabel) ?? [],
        [workoutType, sessionLabel, isFreeform],
    );

    // Core state
    const [userExercises, setUserExercises] = useState<UserExercise[]>([]);
    const exercisesSnapshot = useRef(userExercises);
    exercisesSnapshot.current = userExercises;
    const editedExercises = useRef(false);
    const [starterLoaded, setStarterLoaded] = useState(false);
    const [setupError, setSetupError] = useState('');
    const [setupRetry, setSetupRetry] = useState(0);
    const loadedAccount = useRef(user?.id);
    useEffect(() => {
        if (loadedAccount.current === user?.id) return;
        loadedAccount.current = user?.id;
        editedExercises.current = false;
        setSelectedIntent(null); setSavedSplit(null);
        setSavedRoutine(null); setRoutinePrompt(null);
        setUserExercises([]); setLastWorkoutPreview(null); setStarterLoaded(false); setSetupError('');
    }, [user?.id]);
    const loadedSession = useRef(`${sessionLabel}|${initialIntent?.training_pattern || ''}`);
    useEffect(() => {
        const key = `${sessionLabel}|${initialIntent?.training_pattern || ''}`;
        if (loadedSession.current === key) return;
        loadedSession.current = key;
        editedExercises.current = false;
        setUserExercises([]); setLastWorkoutPreview(null); setStarterLoaded(false); setSetupError('');
    }, [sessionLabel, initialIntent?.training_pattern]);
    const [startTime, setStartTime] = useState(new Date());
    const [hydratedAccount, setHydratedAccount] = useState<string | null>(null);
    const draftCompleted = useRef(false);
    const draftSaveErrorShown = useRef(false);
    const draftSnapshot = useRef<{ userId: string; draft: ActiveWorkoutDraft } | null>(null);
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

    // Rest duration selector modal
    const [showRestConfig, setShowRestConfig] = useState(false);

    // Visibility/Privacy
    const [visibility, setVisibility] = useState<'friends' | 'private'>('friends');
    const [shareLogs, setShareLogs] = useState(true);

    // Restore local progress before a template or network response can fill the
    // screen. Drafts have no inactivity timeout and belong to one account only.
    useEffect(() => {
        if (!user?.id || hydratedAccount === user.id) return;
        let active = true;
        draftCompleted.current = false;
        draftSnapshot.current = null;
        draftSaveErrorShown.current = false;
        void loadActiveWorkoutDraft(user.id).then(draft => {
            if (!active) return;
            if (draft) {
                editedExercises.current = true;
                loadedSession.current = `${draft.intent.session_label}|${draft.intent.training_pattern || ''}`;
                setSelectedIntent(draft.intent);
                setUserExercises(draft.exercises);
                setStartTime(new Date(draft.startedAt));
                setVisibility(draft.visibility);
                setRestDuration(draft.restDuration);
                setStarterLoaded(false);
            } else {
                setStartTime(new Date());
            }
            setSetupError('');
            setHydratedAccount(user.id);
        }).catch(() => {
            if (active) setSetupError('Could not restore your workout. Retry before continuing so saved progress stays safe.');
        });
        return () => { active = false; };
    }, [user?.id, hydratedAccount, setupRetry]);

    useEffect(() => {
        if (!user?.id || hydratedAccount !== user.id || draftCompleted.current
            || (!editedExercises.current && userExercises.length === 0)) return;
        const draft: ActiveWorkoutDraft = {
            version: 1,
            intent: { session_label: sessionLabel || (isFreeform ? 'Workout' : workoutType), training_pattern: initialIntent?.training_pattern },
            exercises: userExercises, startedAt: startTime.toISOString(), visibility, restDuration,
        };
        draftSnapshot.current = { userId: user.id, draft };
        void saveActiveWorkoutDraft(user.id, draft).catch(() => {
            if (!draftSaveErrorShown.current) {
                draftSaveErrorShown.current = true;
                toast.error('Workout backup unavailable', 'Keep this workout open. Progress could not be saved on this device.');
            }
        });
    }, [user?.id, hydratedAccount, userExercises, sessionLabel, workoutType, isFreeform, initialIntent?.training_pattern, startTime, visibility, restDuration, toast]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', state => {
            const snapshot = draftSnapshot.current;
            if (state !== 'active' && snapshot && !draftCompleted.current) {
                void saveActiveWorkoutDraft(snapshot.userId, snapshot.draft).catch(() => {});
            }
        });
        return () => { subscription.remove(); };
    }, []);

    // Optional RIR logging — opt-in via Settings
    const [showRir, setShowRir] = useState(false);
    const [showPrefsSheet, setShowPrefsSheet] = useState(false);
    const [preferencesLoaded, setPreferencesLoaded] = useState(false);

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

    const startVoiceCapture = voice.start;
    const openVoice = useCallback(async () => {
        if (await startVoiceCapture()) setVoiceSheetOpen(true);
    }, [startVoiceCapture]);

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
            }).finally(() => setPreferencesLoaded(true));
    }, []);

    const loadSharingPreference = async () => {
        try {
            const data = await settingsAPI.getSharingPreference();
            setShareLogs(data.share_logs_default);
            if (!editedExercises.current) setVisibility(data.share_logs_default ? 'friends' : 'private');
        } catch (error) {
            setShareLogs(true);
            if (!editedExercises.current) setVisibility('friends');
        }
    };

    // -----------------------------------------------------------------------
    // Rest Timer Logic
    // -----------------------------------------------------------------------

    const restTargetTimeRef = useRef<number | null>(null);

    const startRestTimer = useCallback((seconds = restDuration) => {
        if (restIntervalRef.current) clearInterval(restIntervalRef.current);

        const targetTime = Date.now() + seconds * 1000;
        restTargetTimeRef.current = targetTime;
        setRestSeconds(seconds);
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
    const startExerciseRest = useCallback((exercise: UserExercise) => {
        if (isCardioExercise(exercise)) return;
        const seconds = exercisePreferences.preferences[exercise.name.trim().toLowerCase()]?.rest_seconds ?? (restTimerEnabled ? restDuration : 0);
        if (seconds > 0) startRestTimer(seconds);
    }, [exercisePreferences.preferences, restTimerEnabled, restDuration, startRestTimer]);

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
        let active = true;
        if (!user?.id || hydratedAccount !== user.id) return;
        if (params.curatedExercises || params.start === 'empty' || isFreeform) return;
        setFetchingLastWorkout(true);
        setSetupError('');
        void (async () => {
            const [latest, saved] = await Promise.allSettled([
                sessionLabel ? workoutsAPI.getLatest(workoutType, sessionLabel) : Promise.resolve({ found: false }),
                workoutsAPI.getMySplits(),
            ]);
            if (!active) return;
            const previous = latest.status === 'fulfilled' && latest.value.found
                ? previousWorkoutDraft(latest.value.workout?.exercises) : null;
            setLastWorkoutPreview(previous);
            const splits = saved.status === 'fulfilled' && Array.isArray(saved.value.splits) ? saved.value.splits : [];
            const activeSplit = splits.find((split: any) => split.is_active);
            const days = Array.isArray(activeSplit?.days) ? activeSplit.days.filter((day: unknown) => typeof day === 'string' && day.trim()) : [];
            setSavedSplit(activeSplit ? { split_id: activeSplit.split_id, days, scheduleOnly: !activeSplit.training_plan } : null);
            setSavedRoutine(activeSplit?.id && activeSplit.training_plan ? { id: activeSplit.id, name: activeSplit.name || 'Saved routine', training_plan: activeSplit.training_plan } : null);
            if (!sessionLabel && days.length) {
                const firstDay = days.find((day: string) => !/^(rest|rest day|off|recovery)$/i.test(day.trim()));
                if (firstDay && !editedExercises.current) {
                    setSelectedIntent({ session_label: firstDay, training_pattern: activeSplit.split_id });
                    return;
                }
            }
            const chosen = chooseWorkoutDraft(previous, splits, sessionLabel, initialIntent?.training_pattern);
            if (chosen && !editedExercises.current && exercisesSnapshot.current.length === 0) {
                setUserExercises(prev => prev.length === 0 ? chosen.exercises : prev);
                setStarterLoaded(chosen.source !== 'previous');
            }
            if (latest.status === 'rejected' || (saved.status === 'rejected' && !previous)) {
                setSetupError('Some saved workout details could not load. Retry or add exercises yourself.');
            }
            setFetchingLastWorkout(false);
        })();
        return () => { active = false; };
    }, [workoutType, sessionLabel, isFreeform, initialIntent?.training_pattern, user?.id, hydratedAccount, params.curatedExercises, params.start, setupRetry]);

    const selectSavedDay = useCallback((day: string) => {
        const load = () => {
            editedExercises.current = false;
            setUserExercises([]); setLastWorkoutPreview(null); setStarterLoaded(false);
            setSelectedIntent({ session_label: day, training_pattern: savedSplit?.split_id });
        };
        if (editedExercises.current && exercisesSnapshot.current.length) {
            setConfirmation({ title: 'Switch workout?', message: 'This will replace the exercises and sets you have entered for this session.', confirmLabel: 'Switch workout', onConfirm: () => { setConfirmation(null); load(); } });
        } else load();
    }, [savedSplit?.split_id]);

    const handleRepeatLast = useCallback(() => {
        if (!lastWorkoutPreview) return;
        editedExercises.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setUserExercises(lastWorkoutPreview);
        setShowRepeatPreview(false);
        toast.success('Loaded', `Pre-filled from your last ${workoutType} workout`);
    }, [lastWorkoutPreview, workoutType, toast]);

    // -----------------------------------------------------------------------
    // Load Curated Workout (from library)
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (!user?.id || hydratedAccount !== user.id || editedExercises.current) return;
        if (params.curatedExercises) {
            try {
                const parsed = JSON.parse(params.curatedExercises as string) as UserExercise[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                    editedExercises.current = true;
                    setUserExercises(parsed);
                    const label = params.curatedName ? (params.curatedName as string) : 'template';
                    toast.success('Template Loaded', `Loaded "${label}" — enter your workout values.`);
                }
            } catch {
                // silently ignore bad data
            }
        }
    }, [hydratedAccount, user?.id]);

    // -----------------------------------------------------------------------
    // Exercise CRUD
    // -----------------------------------------------------------------------

    const handleAddExercise = useCallback(
        (exercise: any) => {
            editedExercises.current = true;
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
                bodyPart: exercise.bodyPart,
                tracking_type: isCardioExercise(exercise) ? 'cardio' : 'strength',
                instructions: exercise.instructions,
                sets: ghostSets,
            };
            const replacement = replacingExercise.current;
            replacingExercise.current = null;
            const apply = () => setUserExercises(prev => replacement === null ? isExerciseSelected(newExercise, prev) ? prev : [...prev, newExercise] : prev.map((old, index) => index === replacement ? newExercise : old));
            if (replacement !== null && exercisesSnapshot.current[replacement]?.sets.some(set => set.completed || set.weight_kg !== '' || set.reps !== '')) {
                setConfirmation({ title: 'Replace exercise?', message: 'The new exercise starts with empty sets. Other exercises keep all their progress.', confirmLabel: 'Replace exercise', onConfirm: () => { setConfirmation(null); apply(); } });
            } else apply();
            if (replacement !== null) setShowPicker(false);
        },
        [lastWorkoutPreview],
    );

    const addedFromLibrary = useRef<string | null>(null);
    const editorRequested = useRef(false);
    useEffect(() => {
        if (params.editExercises !== '1' || !user?.id || hydratedAccount !== user.id || !preferencesLoaded || showPrefsSheet || editorRequested.current) return;
        editorRequested.current = true;
        setShowExerciseEditor(true);
        router.setParams?.({ editExercises: undefined });
    }, [params.editExercises, user?.id, hydratedAccount, preferencesLoaded, showPrefsSheet]);
    useEffect(() => {
        const id = params.addExerciseId;
        if (!user?.id || hydratedAccount !== user.id || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) return;
        const key = `${user.id}:${id}`;
        if (addedFromLibrary.current === key) return;
        let active = true;
        void exerciseAPI.getById(encodeURIComponent(id)).then(response => {
            const exercise = response.exercise;
            if (!active || addedFromLibrary.current === key) return;
            if (!exercise || String(exercise.id) !== id || typeof exercise.name !== 'string') throw new Error('Exercise unavailable');
            addedFromLibrary.current = key;
            handleAddExercise(exercise);
            router.setParams?.({ addExerciseId: undefined });
        }).catch(() => {
            if (active) toast.error('Could not add exercise', 'Use Add Exercise to search again. Your current workout is kept.');
        });
        return () => { active = false; };
    }, [params.addExerciseId, user?.id, hydratedAccount, handleAddExercise, toast]);

    const addSet = useCallback((exerciseIndex: number) => {
        editedExercises.current = true;
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
                        duration_minutes: prevSet?.duration_minutes ?? '',
                        rpe: '',
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
        setConfirmation({ title: 'Remove set?', message: 'This set will be removed from this workout.', confirmLabel: 'Remove set', destructive: true,
                onConfirm: () => {
                    setConfirmation(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    editedExercises.current = true;
                    setUserExercises((prev) => {
                        const updated = [...prev];
                        const sets = [...updated[exerciseIndex].sets];
                        sets.splice(setIndex, 1);
                        updated[exerciseIndex] = { ...updated[exerciseIndex], sets };
                        return updated;
                    });
                },
        });
    }, []);

    const updateSet = useCallback(
        (exerciseIndex: number, setIndex: number, field: keyof ExerciseSet, value: any) => {
            editedExercises.current = true;
            setUserExercises((prev) => {
                const updated = [...prev];
                const sets = [...updated[exerciseIndex].sets];
                const wasCompleted = sets[setIndex].completed;
                sets[setIndex] = { ...sets[setIndex], [field]: value };
                const rir = sets[setIndex].rir;
                const invalidRir = showRir && rir != null && String(rir).trim() !== '' && (!Number.isInteger(workoutNumber(rir)) || workoutNumber(rir) < 0 || workoutNumber(rir) > 5);
                if (field !== 'completed' && (isCardioExercise(updated[exerciseIndex])
                    ? !!cardioEntryError(sets[setIndex], 'duration') || !!cardioEntryError(sets[setIndex], 'effort')
                    : (sets[setIndex].weight_kg == null || String(sets[setIndex].weight_kg).trim() === ''
                    || !Number.isFinite(workoutNumber(sets[setIndex].weight_kg)) || workoutNumber(sets[setIndex].weight_kg) < 0
                    || !Number.isInteger(workoutNumber(sets[setIndex].reps)) || workoutNumber(sets[setIndex].reps) <= 0 || invalidRir))) sets[setIndex].completed = false;
                updated[exerciseIndex] = { ...updated[exerciseIndex], sets };

                // Layered double-pulse haptics when a set becomes completed.
                if (field === 'completed' && value === true && !wasCompleted) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setTimeout(() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }, 80);
                    // The rest timer is opt-in, so completing a set no longer
                    // pops a countdown unless it was asked for.
                    setTimeout(() => startExerciseRest(updated[exerciseIndex]), 0);
                }

                return updated;
            });
        },
        [startExerciseRest, showRir],
    );

    const handleToggleUnilateral = useCallback((eIdx: number) => {
        editedExercises.current = true;
        setUserExercises((prev) =>
            prev.map((ex, i) => (i === eIdx ? { ...ex, is_unilateral: !ex.is_unilateral } : ex)),
        );
    }, []);

    const removeExercise = useCallback((index: number) => {
        setConfirmation({ title: 'Remove exercise?', message: 'This exercise and its sets will be removed from this workout. Your saved routine stays the same.', confirmLabel: 'Remove exercise', destructive: true,
                onConfirm: () => {
                    setConfirmation(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    editedExercises.current = true;
                    setUserExercises((prev) => {
                        const updated = [...prev];
                        updated.splice(index, 1);
                        return updated;
                    });
                },
        });
    }, []);

    // -----------------------------------------------------------------------
    // Number Picker Bottom Sheet
    // -----------------------------------------------------------------------

    const openPicker = useCallback(
        (exerciseIndex: number, setIndex: number, type: SetEntryField) => {
            if (!userExercises[exerciseIndex]?.sets[setIndex]) return;
            setPickerConfig({ visible: true, type, exerciseIndex, setIndex, currentValue: 0 });
        },
        [userExercises],
    );
    const closePicker = useCallback(() => setPickerConfig(current => ({ ...current, visible: false })), []);
    const saveEditedSet = (values: Pick<ExerciseSet, 'weight_kg' | 'reps' | 'rir' | 'duration_minutes' | 'rpe'>, complete: boolean) => {
        const exercise = userExercises[pickerConfig.exerciseIndex];
        const set = exercise?.sets[pickerConfig.setIndex];
        if (!set) return;
        editedExercises.current = true;
        setUserExercises(previous => previous.map(item => item.id !== exercise.id ? item : {
            ...item,
            sets: item.sets.map(row => row.id !== set.id ? row : { ...row, ...values, completed: row.completed || complete }),
        }));
        if (complete && !set.completed) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            startExerciseRest(exercise);
        }
        closePicker();
    };

    // -----------------------------------------------------------------------
    // Finish Workout
    // -----------------------------------------------------------------------

    const handleDiscard = () => {
        setConfirmation({ title: 'Discard workout?', message: 'This removes your unfinished workout and stops its ongoing activity. Your saved routine stays the same.', confirmLabel: 'Discard workout', cancelLabel: 'Keep workout', destructive: true, onConfirm: async () => {
                if (discardPending.current) return;
                discardPending.current = true;
                draftCompleted.current = true;
                setLoading(true);
                try {
                    if (user?.id) await clearActiveWorkoutDraft(user.id);
                    draftSnapshot.current = null;
                    await syncWorkoutActivity('', null).catch(() => {});
                    setConfirmation(null);
                    dismissRestTimer();
                    if (router.canGoBack()) router.back();
                    else router.replace('/(tabs)');
                } catch {
                    draftCompleted.current = false;
                    toast.error('Could not discard workout', 'Your progress is still saved. Please try again.');
                } finally { discardPending.current = false; setLoading(false); }
            },
        });
    };

    const proposedRoutine = useMemo(() => routineUpdate(savedRoutine?.training_plan, sessionLabel, userExercises), [savedRoutine, sessionLabel, userExercises]);
    const [routineError, setRoutineError] = useState('');
    const handleFinish = async (focus?: string, routineChoice?: 'today' | 'update') => {
        if (finishPending.current) return;
        Keyboard.dismiss();
        if (userExercises.some(ex => !isCardioExercise(ex) && ex.sets.some(set => set.completed && (set.weight_kg === '' || set.weight_kg == null)))) {
            toast.error('Enter a weight', 'Enter the weight for each checked set. Use 0 kg for bodyweight exercises.');
            return;
        }
        const finishedExercises = finalizeWorkout(userExercises);
        if (finishedExercises.length === 0) {
            toast.error('No completed sets', 'Complete at least one strength set or cardio interval before finishing.');
            return;
        }

        // The existing API stores six focus categories, not a generic workout type.
        // Ask at completion rather than silently classifying an empty start as Chest.
        if (!focus && (isFreeform || !sessionLabel)) { setShowCategoryPicker(true); return; }

        if (savedRoutine && proposedRoutine.changed && !routineChoice) {
            setRoutineError(''); setRoutinePrompt({ focus }); return;
        }

        finishPending.current = true; setLoading(true);
        let routineWasUpdated = false;
        try {
            if (routineChoice === 'update' && savedRoutine) {
                if (!proposedRoutine.plan || !token) throw new Error(proposedRoutine.error || 'Please sign in again before updating your routine.');
                const account = user?.id;
                const result = await workoutsAPI.updateRoutine(savedRoutine.id, proposedRoutine.plan, savedRoutine.training_plan, token);
                if (loadedAccount.current !== account) return;
                if (!result?.split?.training_plan) throw new Error('Could not confirm the routine update. Your workout is still kept here.');
                routineWasUpdated = true;
                setSavedRoutine({ ...savedRoutine, training_plan: result.split.training_plan });
            }
            setRoutinePrompt(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const durationMinutes = Math.round(
                (new Date().getTime() - startTime.getTime()) / 60000,
            );

            const loggedType = focus || workoutType;
            const loggedTitle = focus ? `${focus[0].toUpperCase() + focus.slice(1)} workout` : sessionTitle;
            const result = await workoutsAPI.log({
                workout_type: loggedType,
                day_name: loggedTitle,
                exercises: JSON.stringify(finishedExercises),
                notes: 'Logged via Smart Log',
                visibility: visibility,
                duration_minutes: Math.max(durationMinutes, 1),
            });
            invalidateExerciseHistory();

            draftCompleted.current = true;
            draftSnapshot.current = null;
            if (user?.id) await clearActiveWorkoutDraft(user.id).catch(() => {
                toast.error('Workout saved', 'The workout was saved, but its local backup could not be removed.');
            });
            // End the system card even if local backup cleanup failed after a successful server save.
            await syncWorkoutActivity('', null).catch(() => {});

            const shareExercises = buildShareExercises(finishedExercises);
            const totalVolume = shareExercises.reduce((sum, ex) => sum + ex.volumeKg, 0);
            const totalSets = shareExercises.reduce((sum, ex) => sum + ex.setCount, 0);
            const completedAt = Date.now();

            const recap = {
                duration: Math.max(durationMinutes, 1),
                volume: totalVolume,
                sets: totalSets,
                prs: result.prs || [],
                completedAt,
            };

            useLastSessionStore.getState().setSession({
                completedAt,
                title: loggedTitle,
                durationMin: Math.max(durationMinutes, 1),
                volumeKg: totalVolume,
                setCount: totalSets,
                prs: normalizePrs(result.prs),
                exercises: shareExercises,
            });

            router.replace({
                pathname: '/member/workout-recap',
                params: {
                    recap: JSON.stringify(recap),
                    session: JSON.stringify({
                        // Match the header: the recap should say "Push", not "Chest".
                        name: loggedTitle,
                        day_name: loggedType,
                        emphasis: focus ? [focus] : sessionMuscles.length ? sessionMuscles : [workoutType],
                    }),
                },
            });
        } catch (error: any) {
            if (routineChoice === 'update' && !routineWasUpdated) setRoutineError(error.status === 404 ? 'Routine updates are temporarily unavailable. You can still save today only.' : error.message || 'Could not save. Your workout is still here. Try again or save today only.');
            else toast.error(routineWasUpdated ? 'Routine updated; workout not saved' : 'Error', error.message || 'Failed to save workout');
        } finally {
            finishPending.current = false;
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
                preference={exercisePreferences.preferences[item.name.trim().toLowerCase()]}
                onEditPreferences={editExercisePreferences}
            />
        ),
        [showRir, updateSet, addSet, removeExercise, removeSet, handleToggleUnilateral, openPicker, exercisePreferences.preferences, editExercisePreferences],
    );

    // Header component for FlatList
    const hasCardio = userExercises.some(isCardioExercise);
    const ListHeader = useMemo(
        () => (
            <View>
                {!params.curatedExercises && savedDays.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>YOUR SAVED WORKOUTS</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {savedDays.map(day => <TouchableOpacity key={day} onPress={() => selectSavedDay(day)}
                                disabled={day === sessionLabel} accessibilityRole="button"
                                accessibilityLabel={`Load ${day} workout`} accessibilityState={{ selected: day === sessionLabel }}
                                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md,
                                    borderBottomWidth: day === sessionLabel ? 2 : 0, borderBottomColor: colors.text.primary }}>
                                <Text style={{ color: day === sessionLabel ? colors.text.primary : colors.text.muted }}>{day}</Text>
                            </TouchableOpacity>)}
                        </ScrollView>
                    </View>
                )}
                {starterLoaded && <Text style={styles.setupNote}>Saved routine · edit as you train.</Text>}
                {savedSplit?.scheduleOnly && !fetchingLastWorkout && !lastWorkoutPreview && userExercises.length === 0
                    && <Text style={styles.setupNote}>This split saves your training days only. Add exercises or choose a workout template below.</Text>}
                {!!setupError && <View><Text style={styles.setupNote}>{setupError}</Text><TouchableOpacity onPress={() => setSetupRetry(value => value + 1)} accessibilityRole="button" accessibilityLabel="Retry loading workout" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={styles.setupNote}>Retry</Text></TouchableOpacity></View>}
                {/* Warm-up sits above the exercises: read it, tick it off, or
                    skip it. It never blocks getting to the first set. */}
                {showWarmUp && (
                    <WarmUpCard
                        workoutType={sessionLabel || workoutType}
                        onDismiss={() => setShowWarmUp(false)}
                        onNeverShowAgain={() => {
                            setShowWarmUp(false);
                            settingsAPI
                                .updateWorkoutPreferences({ warmup_card_enabled: false })
                                .catch(() => {});
                        }}
                    />
                )}
                {/* Repeat Last Banner - Loading */}
                {fetchingLastWorkout && !lastWorkoutPreview && userExercises.length === 0 && (
                    <View style={[styles.repeatBanner, { opacity: 0.5 }]}>
                        <View style={styles.repeatBannerLeft}>
                            <ActivityIndicator size="small" color={colors.text.muted} />
                            <View>
                                <Text style={styles.repeatSubtitle}>Loading saved workout...</Text>
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
                <View style={styles.exerciseSectionHeader}>
                    <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>EXERCISES · {userExercises.length}</Text>
                    {userExercises.length > 0 && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit exercises" onPress={() => setShowExerciseEditor(true)} style={styles.editExercisesButton}><Ionicons name="options-outline" size={18} color={colors.text.primary} /><Text style={styles.editExercisesText}>Edit exercises</Text></TouchableOpacity>}
                </View>
                <Text style={styles.editHint}>{hasCardio ? 'Log time and effort for cardio. Tap a set number for more options.' : userExercises.length ? 'Type weight and reps below. Tap the set number for more options.' : 'Add your exercises first. Then log each set or cardio interval.'}</Text>
            </View>
        ),
        // showWarmUp must be here — without it the memo holds the old header and
        // dismissing the warm-up card does nothing on screen.
        [workoutType, sessionLabel, lastWorkoutPreview, userExercises.length, hasCardio, showWarmUp, starterLoaded, setupError, fetchingLastWorkout, savedDays, savedSplit?.scheduleOnly, selectSavedDay, params.curatedExercises],
    );

    // Footer component for FlatList
    const ListFooter = useMemo(
        () => (
            <View style={{ paddingBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                    <TouchableOpacity
                        style={[styles.addExerciseBtn, { flex: 1, marginTop: 0 }, !userExercises.length && { backgroundColor: colors.primary, borderStyle: 'solid', borderColor: colors.primary }]}
                        onPress={() => setShowPicker(true)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Add exercise"
                    >
                        <MaterialIcons name="add" size={20} color={userExercises.length ? colors.text.primary : colors.text.dark} />
                        <Text style={[styles.addExerciseText, { color: userExercises.length ? colors.text.primary : colors.text.dark }]}>Add exercises</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.addExerciseBtn, { width: 60, marginTop: 0 }]}
                        onPress={openVoice}
                        disabled={voice.isBusy}
                        activeOpacity={0.7}
                        accessibilityLabel="Log exercises by voice"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: voice.isBusy }}
                    >
                        {voice.isBusy ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <MaterialIcons name="mic" size={20} color={colors.text.muted} />
                        )}
                    </TouchableOpacity>
                </View>
                {!userExercises.length && <TouchableOpacity style={styles.browseTemplatesBtn} accessibilityRole="button" accessibilityLabel="Browse workout templates" onPress={() => router.push('/member/curated-workouts')}>
                    <MaterialIcons name="library-books" size={18} color={colors.text.secondary} /><Text style={styles.browseTemplatesText}>Or use a workout template</Text><MaterialIcons name="chevron-right" size={18} color={colors.text.muted} />
                </TouchableOpacity>}
            </View>
        ),
        [openVoice, voice.isBusy, userExercises.length],
    );

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    if (user?.id && hydratedAccount !== user.id) {
        return <SafeAreaView style={styles.container} edges={['top']}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md }}>
                {setupError ? <>
                    <Text style={{ color: colors.text.primary }}>{setupError}</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry restoring workout" onPress={() => setSetupRetry(value => value + 1)}>
                        <Text style={{ color: colors.primary }}>Retry</Text>
                    </TouchableOpacity>
                </> : <><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.text.secondary }}>Restoring workout…</Text></>}
            </View>
        </SafeAreaView>;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenBackdrop />
            <ConfirmationSheet action={confirmation} busy={loading} onCancel={() => setConfirmation(null)} />
            <WorkoutExercisesSheet visible={showExerciseEditor} exercises={userExercises} onClose={() => setShowExerciseEditor(false)}
                onAdd={() => { replacingExercise.current = null; setShowExerciseEditor(false); setShowPicker(true); }}
                onReplace={index => { replacingExercise.current = index; setShowExerciseEditor(false); setShowPicker(true); }}
                onRemove={index => { setShowExerciseEditor(false); removeExercise(index); }}
                onMove={(index, direction) => { editedExercises.current = true; setUserExercises(prev => { const next = index + direction; if (next < 0 || next >= prev.length) return prev; const updated = [...prev]; [updated[index], updated[next]] = [updated[next], updated[index]]; return updated; }); }} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
            <AIConsentModal {...voice.consentModalProps} />
            <VoiceCaptureSheet
                visible={voiceSheetOpen && voice.stage !== 'idle' && !voice.isAwaitingConsent}
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
                    editedExercises.current = true;
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
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Close workout">
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
                style={{ flex: 1, minHeight: 0 }}
                data={userExercises}
                keyExtractor={keyExtractor}
                renderItem={renderExercise}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                removeClippedSubviews={Platform.OS === 'android'}
            />

            <Modal visible={!!routinePrompt} transparent animationType="slide" onRequestClose={() => { if (!loading) setRoutinePrompt(null); }}>
                <View style={styles.routineBackdrop}>
                    <View style={[styles.routineSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
                        <ScrollView contentContainerStyle={{ gap: spacing.md }}>
                            <Text style={styles.routineTitle} accessibilityRole="header">Keep these routine changes?</Text>
                            <Text style={styles.routineBody}>You changed exercises, their order or the number of sets in {sessionLabel}. Save them just for today, or use this version next time too.</Text>
                            {proposedRoutine.changes.map((change, index) => <Text key={index} style={[styles.routineBody, { color: colors.text.primary }]}>• {change}</Text>)}
                            <Text style={styles.routineBody}>Other training days and existing targets stay the same. New exercises use the reps or time you entered. Performed values are saved in your workout history.</Text>
                            {!!(routineError || proposedRoutine.error) && <Text style={[styles.routineBody, { color: colors.error }]} accessibilityRole="alert">{routineError || proposedRoutine.error}</Text>}
                        </ScrollView>
                        <Button title="Save today only" disabled={loading} onPress={() => { void handleFinish(routinePrompt?.focus, 'today'); }} fullWidth />
                        <Button title="Update routine & save workout" variant="secondary" disabled={loading || !proposedRoutine.plan} onPress={() => { void handleFinish(routinePrompt?.focus, 'update'); }} fullWidth />
                        <Button title={loading ? 'Saving…' : 'Back to workout'} variant="ghost" disabled={loading} onPress={() => setRoutinePrompt(null)} fullWidth />
                    </View>
                </View>
            </Modal>

            <WorkoutCategorySheet visible={showCategoryPicker} onClose={() => setShowCategoryPicker(false)} onChoose={type => {
                const label = `${type[0].toUpperCase() + type.slice(1)} workout`;
                // This labels the current work, rather than switching to a different session.
                loadedSession.current = `${label}|`;
                setSelectedIntent({ session_label: label });
                setShowCategoryPicker(false);
                void handleFinish(type);
            }} />

            {/* Keep controls in the layout so focused rows can scroll above them. */}
            <View
                style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}
            >
            {restActive && restSeconds > 0 && <RestTimerPill seconds={restSeconds} onDismiss={dismissRestTimer} onAddSeconds={secs => {
                if (restTargetTimeRef.current === null) return;
                restTargetTimeRef.current += secs * 1000;
                setRestSeconds(Math.max(0, Math.ceil((restTargetTimeRef.current - Date.now()) / 1000)));
            }} />}
            {shareLogs && (
                <View style={styles.visibilityBar}>
                    <Text style={styles.visibilityLabel}>Who sees this workout?</Text>
                    <View style={styles.visibilityOptions} accessibilityRole="radiogroup" accessibilityLabel="Workout visibility">
                        <TouchableOpacity
                            accessibilityRole="radio" accessibilityLabel="Friends" accessibilityState={{ checked: visibility === 'friends' }} aria-checked={visibility === 'friends'}
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
                            accessibilityRole="radio" accessibilityLabel="Only me" accessibilityState={{ checked: visibility === 'private' }} aria-checked={visibility === 'private'}
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
                    onPress={() => { void handleFinish(); }}
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
                <TouchableOpacity onPress={handleDiscard} disabled={loading} accessibilityRole="button" accessibilityLabel="Discard workout" style={{ paddingVertical: spacing.sm, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13 }}>Discard workout</Text>
                </TouchableOpacity>
            </View>
            </View>

            {/* -------- MODALS -------- */}

            {/* Exercise Picker Modal */}
            <Modal
                visible={showPicker}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => { replacingExercise.current = null; setShowPicker(false); }}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle} accessibilityRole="header">{replacingExercise.current === null ? 'Add exercises' : 'Replace exercise'}</Text>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close exercise picker" style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }} onPress={() => { replacingExercise.current = null; setShowPicker(false); }}>
                            <MaterialIcons name="close" size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                    </View>
                    <ExerciseList
                        mode="select"
                        onSelect={handleAddExercise}
                        selectedExercises={userExercises}
                        selectionAction={replacingExercise.current === null ? 'Add' : 'Replace'}
                    />
                    {replacingExercise.current === null && <View style={styles.exercisePickerFooter}><Button title={userExercises.length ? `Done · ${userExercises.length} ${userExercises.length === 1 ? 'exercise' : 'exercises'}` : 'Back to workout'} onPress={() => setShowPicker(false)} fullWidth /></View>}
                </SafeAreaView>
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
                                ? 'A countdown appears unless an exercise has its own rest setting'
                                : 'Default off. Exercises with a saved rest time can still start their timer.'}
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
                            <Text style={styles.restToggleLabel}>Default rest timer</Text>
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

            {pickerConfig.visible && userExercises[pickerConfig.exerciseIndex]?.sets[pickerConfig.setIndex] && (
                <WorkoutSetEditor
                    key={[user?.id, userExercises[pickerConfig.exerciseIndex].id, userExercises[pickerConfig.exerciseIndex].sets[pickerConfig.setIndex].id].join(':')}
                    exerciseName={userExercises[pickerConfig.exerciseIndex].name}
                    setIndex={pickerConfig.setIndex}
                    set={userExercises[pickerConfig.exerciseIndex].sets[pickerConfig.setIndex]}
                    previousSet={userExercises[pickerConfig.exerciseIndex].sets[pickerConfig.setIndex - 1]}
                    initialField={pickerConfig.type}
                    showRir={showRir}
                    isUnilateral={userExercises[pickerConfig.exerciseIndex].is_unilateral}
                    isCardio={isCardioExercise(userExercises[pickerConfig.exerciseIndex])}
                    inputMode={inputMode}
                    onSelectMode={selectMode}
                    onSave={saveEditedSet}
                    onClose={closePicker}
                />
            )}

            {settingsExercise && <ExercisePreferencesSheet key={user?.id} exercise={settingsExercise} preference={exercisePreferences.preferences[settingsExercise.name.trim().toLowerCase()]} loading={exercisePreferences.loading} error={exercisePreferences.error} onRetry={() => void exercisePreferences.reload()} onSave={async preference => { await exercisePreferences.save(preference); toast.success('Exercise settings saved'); }} onClose={() => setExerciseSettings(null)} />}
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
    routineBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
    routineSheet: { maxHeight: '90%', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.glass.border },
    routineTitle: { color: colors.text.primary, fontFamily: typography.fontFamily.semiBold, fontSize: 21, lineHeight: 28 },
    routineBody: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 21 },
    setupNote: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 20, marginVertical: 12 },
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
    exerciseSectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.lg },
    editExercisesButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm },
    editExercisesText: { fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.sm, color: colors.text.primary },
    editHint: { fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.sm, lineHeight: 19, color: colors.text.muted, marginBottom: spacing.lg },
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
        minWidth: 44, minHeight: 44,
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
        flexShrink: 0,
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
    exercisePickerFooter: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.glass.border },
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
