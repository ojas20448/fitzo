import ScreenBackdrop from '../../components/ScreenBackdrop';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable, TextInput, ActivityIndicator, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { intentAPI, workoutsAPI } from '../../services/api';
import { useToast } from '../../components/Toast';
import { colors, typography, spacing, borderRadius, shadows, shadow } from '../../styles/theme';

// Preset splits
const PRESET_SPLITS = [
    {
        id: 'ppl_6',
        name: 'PPL (6 Day)',
        pattern: 'ppl',
        description: 'Push, Pull, Legs × 2',
        days: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
        daysPerWeek: 6,
    },
    {
        id: 'ppl_3',
        name: 'PPL (3 Day)',
        pattern: 'ppl',
        description: 'Push, Pull, Legs once per week',
        days: ['Push', 'Pull', 'Legs'],
        daysPerWeek: 3,
    },
    {
        id: 'upper_lower_4',
        name: 'Upper Lower (4 Day)',
        pattern: 'upper_lower',
        description: 'Upper, Lower × 2',
        days: ['Upper', 'Lower', 'Upper', 'Lower'],
        daysPerWeek: 4,
    },
    {
        id: 'upper_lower_2',
        name: 'Upper Lower (2 Day)',
        pattern: 'upper_lower',
        description: 'Upper, Lower × 1',
        days: ['Upper', 'Lower'],
        daysPerWeek: 2,
    },
    {
        id: 'full_body_3',
        name: 'Full Body (3 Day)',
        pattern: 'full_body',
        description: 'Full body workouts',
        days: ['Full Body A', 'Full Body B', 'Full Body C'],
        daysPerWeek: 3,
    },
    {
        id: 'bro_split',
        name: 'Bro Split (5 Day)',
        pattern: 'bro_split',
        description: 'One body part per day',
        days: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'],
        daysPerWeek: 5,
    },
    {
        id: 'anterior_posterior',
        name: 'Anterior / Posterior',
        pattern: 'anterior_posterior',
        description: 'Front and back chain',
        days: ['Anterior', 'Posterior', 'Anterior', 'Posterior'],
        daysPerWeek: 4,
    },
    {
        id: 'push_pull',
        name: 'Push / Pull',
        pattern: 'push_pull',
        description: 'Upper body push/pull',
        days: ['Push', 'Pull'],
        daysPerWeek: 2,
    },
    {
        id: 'arnold_split',
        name: 'Arnold Split (6 Day)',
        pattern: 'arnold_split',
        description: 'Chest+Back, Shoulders+Arms, Legs',
        days: ['Chest & Back', 'Shoulders & Arms', 'Legs', 'Chest & Back', 'Shoulders & Arms', 'Legs'],
        daysPerWeek: 6,
    },
    {
        id: 'phul',
        name: 'PHUL (4 Day)',
        pattern: 'phul',
        description: 'Power Upper, Power Lower, Hypertrophy Upper, Hypertrophy Lower',
        days: ['Power Upper', 'Power Lower', 'Hypertrophy Upper', 'Hypertrophy Lower'],
        daysPerWeek: 4,
    },
    {
        id: 'phat',
        name: 'PHAT (5 Day)',
        pattern: 'phat',
        description: 'Power and Hypertrophy Adaptive Training',
        days: ['Power Upper', 'Power Lower', 'Rest', 'Hypertrophy Back/Shoulders', 'Hypertrophy Chest/Arms', 'Hypertrophy Legs'],
        daysPerWeek: 5,
    },
];

// Body parts for custom split
const BODY_PARTS = [
    'Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body',
    'Chest', 'Back', 'Shoulders', 'Arms', 'Quads', 'Hamstrings',
    'Anterior', 'Posterior', 'Chest + Back', 'Arms + Shoulders', 'Legs + Core',
    'Power Upper', 'Power Lower', 'Hypertrophy Upper', 'Hypertrophy Lower'
];

export default function WorkoutIntentScreen() {
    const toast = useToast();
    const params = useLocalSearchParams();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'split' | 'day' | 'custom'>('split');

    // User's saved split
    const [savedSplit, setSavedSplit] = useState<typeof PRESET_SPLITS[0] | null>(null);
    const [selectedSplit, setSelectedSplit] = useState<typeof PRESET_SPLITS[0] | null>(null);
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
    const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('friends');
    const [suggestedDayIndex, setSuggestedDayIndex] = useState<number | null>(null);

    // Loading state for initial split fetch
    const [initialLoading, setInitialLoading] = useState(true);

    // Custom split builder
    const [customDays, setCustomDays] = useState<string[]>([]);
    const [customName, setCustomName] = useState('My Split');
    const [isAddingCustomDay, setIsAddingCustomDay] = useState(false);
    const [customDayInput, setCustomDayInput] = useState('');
    const [customError, setCustomError] = useState('');
    const savingCustom = useRef(false);

    // Load user's saved/adopted split on mount
    useEffect(() => {
        // If we arrived from adopting a published split, jump straight to day selection
        if (params.adoptedSplit) {
            try {
                const adopted = JSON.parse(params.adoptedSplit as string);
                const days = adopted.days || [];
                if (days.length > 0) {
                    const split = {
                        id: adopted.id || 'adopted',
                        name: adopted.name || 'Adopted Plan',
                        pattern: adopted.pattern || 'custom',
                        description: adopted.description || `${days.length} days/week`,
                        days,
                        daysPerWeek: adopted.daysPerWeek || days.length,
                    };
                    setSelectedSplit(split);
                    setSavedSplit(split);
                    setStep('day');
                    setInitialLoading(false);
                    return;
                }
            } catch {}
        }

        loadSplitAndSuggestion();
    }, []);

    const loadSplitAndSuggestion = async () => {
        try {
            // Fetch both active split and suggestion in parallel
            const [splitResult, suggestResult] = await Promise.all([
                workoutsAPI.getMySplits().catch(() => null),
                intentAPI.getSuggestion().catch(() => null),
            ]);

            const active = splitResult?.splits?.find((s: any) => s.is_active) || splitResult?.splits?.[0];

            if (active?.days?.length > 0) {
                const split = {
                    id: active.split_id || active.id,
                    name: active.name || 'My Plan',
                    pattern: active.split_id?.startsWith('adopted_') ? 'custom' : (active.split_id || 'custom'),
                    description: `${active.days_per_week || active.days.length} days/week`,
                    days: active.days,
                    daysPerWeek: active.days_per_week || active.days.length,
                };
                setSavedSplit(split);
                setSelectedSplit(split);
                setStep('day');

                // Pre-select suggested day
                if (suggestResult?.suggestion) {
                    const idx = suggestResult.suggestion.day_index;
                    setSuggestedDayIndex(idx);
                    setSelectedDayIndex(idx);
                }

                // If a suggested index was passed from HomeScreen, use that
                if (params.suggestedIndex !== undefined) {
                    const idx = parseInt(params.suggestedIndex as string, 10);
                    if (!isNaN(idx)) {
                        setSuggestedDayIndex(idx);
                        setSelectedDayIndex(idx);
                    }
                }
            }
        } catch {} finally {
            setInitialLoading(false);
        }
    };

    const handleSplitSelect = async (split: typeof PRESET_SPLITS[0]) => {
        // Save the split to DB so it persists and enables auto-suggestions
        try {
            setLoading(true);
            await workoutsAPI.saveSplit({
                split_id: split.id,
                name: split.name,
                days: split.days,
                days_per_week: split.daysPerWeek,
            });
            setSavedSplit(split);
            setSelectedSplit(split);
            setStep('day');
        } catch (error: any) {
            toast.error('Failed to save split', error?.message || 'Please try again');
        } finally {
            setLoading(false);
        }
    };

    const handleDaySelect = (dayIndex: number) => {
        if (!selectedSplit) return;
        setSelectedDayIndex(dayIndex);
    };

    const handleSave = async (editExercises = false) => {
        if (!selectedSplit || selectedDayIndex === null) return;

        setLoading(true);
        try {
            const dayName = selectedSplit.days[selectedDayIndex];

            // Set the intent
            await intentAPI.setIntent({
                training_pattern: selectedSplit.pattern || 'custom',
                emphasis: [dayName],
                session_label: dayName,
                visibility,
            });

            toast.success('Session ready', `${dayName} is ready to log.`);

            // Navigate directly to workout log with intent data
            setTimeout(() => {
                router.replace({
                    pathname: '/log/workout',
                    params: {
                        intent: JSON.stringify({
                            session_label: dayName,
                            emphasis: [dayName],
                            training_pattern: selectedSplit.pattern || 'custom',
                        }),
                        ...(editExercises ? { editExercises: '1' } : {}),
                    },
                });
            }, 400);
        } catch (error: any) {
            toast.error('Failed to set intent', error?.message || 'Please try again');
            setLoading(false);
        }
    };

    const handleQuickOption = async (type: 'cardio' | 'rest' | 'skip') => {
        setLoading(true);
        try {
            if (type === 'skip') {
                // Just go back — don't set any intent
                router.back();
                return;
            }

            if (type === 'rest') {
                await intentAPI.setIntent({
                    training_pattern: null,
                    emphasis: ['rest'],
                    session_label: 'Rest Day',
                    visibility,
                });
                toast.success('Rest day set', 'Today is marked for recovery.');
                setTimeout(() => router.back(), 300);
                return;
            }

            // Cardio
            await intentAPI.setIntent({
                training_pattern: null,
                emphasis: ['cardio'],
                session_label: 'Cardio',
                visibility,
            });
            toast.success('Cardio Set', 'Let\'s get that heart rate up! 💪');
            setTimeout(() => router.back(), 300);
        } catch (error: any) {
            toast.error('Failed to set intent', error?.message || 'Please try again');
        } finally {
            setLoading(false);
        }
    };

    const handleChangeSplit = () => {
        // Reset to split selection
        setStep('split');
        setSelectedSplit(null);
        setSelectedDayIndex(null);
        setSuggestedDayIndex(null);
    };

    const addCustomDay = (part: string) => {
        if (savingCustom.current) return;
        setCustomError('');
        if (customDays.length < 7) {
            setCustomDays([...customDays, part]);
        }
    };

    const handleAddCustomDay = () => {
        if (savingCustom.current) return;
        setCustomError('');
        if (customDayInput.trim() && customDays.length < 7) {
            setCustomDays([...customDays, customDayInput.trim()]);
            setCustomDayInput('');
            setIsAddingCustomDay(false);
        }
    };

    const removeCustomDay = (index: number) => {
        if (savingCustom.current) return;
        setCustomError('');
        setCustomDays(customDays.filter((_, i) => i !== index));
    };

    const saveCustomSplit = async () => {
        if (savingCustom.current) return;
        const name = customName.trim();
        if (!name || name.length > 100) { setCustomError('Give your split a name between 1 and 100 characters.'); return; }
        if (!customDays.length || customDays.length > 7) { setCustomError('Add between 1 and 7 days to your split.'); return; }
        if (isAddingCustomDay && customDayInput.trim()) { setCustomError('Tap the checkmark to add your custom day before saving.'); return; }
        const custom: typeof PRESET_SPLITS[0] = {
            id: 'custom',
            name,
            pattern: 'custom',
            description: `${customDays.length} days per week`,
            days: customDays,
            daysPerWeek: customDays.length,
        };
        Keyboard.dismiss(); savingCustom.current = true; setLoading(true); setCustomError('');
        try {
            await workoutsAPI.saveSplit({
                split_id: 'custom',
                name,
                days: customDays,
                days_per_week: customDays.length,
            });
            setSavedSplit(custom);
            setSelectedSplit(custom);
            setStep('day');
        } catch (error: any) {
            setCustomError(error?.message || 'Couldn’t save your split. Your days are still here. Try again.');
        } finally { savingCustom.current = false; setLoading(false); }
    };

    const handleBack = () => {
        if (loading || savingCustom.current) return;
        if (step === 'day' && !savedSplit) {
            // Only go back to split selection if user hasn't saved a split yet
            setStep('split');
            setSelectedDayIndex(null);
        } else if (step === 'day' && savedSplit) {
            // Has a saved split — just go back to home
            router.back();
        } else if (step === 'custom') {
            setStep('split');
            setCustomDays([]);
        } else {
            router.back();
        }
    };

    if (initialLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenBackdrop />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const workoutCollections = <View style={styles.section}>
        <Text style={styles.sectionLabel}>FIND YOUR NEXT PLAN</Text>
        {(['fitzo', 'community'] as const).map(collection => <Pressable key={collection} style={[styles.discoverCard, { marginBottom: spacing.sm }]} accessibilityRole="button" accessibilityLabel={`${collection === 'fitzo' ? 'Fitzo' : 'Community'} Workouts`} onPress={() => router.push({ pathname: '/member/published-splits', params: { collection } } as any)}>
            <View style={styles.discoverContent}>
                <View style={styles.discoverIconBg}><Ionicons name={collection === 'fitzo' ? 'barbell-outline' : 'people-outline'} size={23} color={colors.text.primary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.discoverTitle}>{collection === 'fitzo' ? 'Fitzo Workouts' : 'Community Workouts'}</Text><Text style={styles.discoverDesc}>{collection === 'fitzo' ? 'Plans curated by Fitzo' : 'Explore, heart and share your own splits'}</Text></View>
            </View><Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
        </Pressable>)}
    </View>;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenBackdrop />
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.closeButton} disabled={loading} accessibilityRole="button" accessibilityLabel="Go back">
                    <MaterialIcons
                        name={step === 'split' || (step === 'day' && savedSplit) ? 'close' : 'arrow-back'}
                        size={28}
                        color={colors.text.primary}
                    />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (!savingCustom.current) router.back(); }} style={styles.skipButton} disabled={loading} accessibilityRole="button" accessibilityLabel="Skip session setup">
                    <Text style={styles.skipText}>SKIP</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                pointerEvents={loading ? 'none' : 'auto'}
            >
                {/* Title */}
                <View style={styles.titleSection}>
                    <Text style={styles.title}>
                        {step === 'split' ? 'Your' : step === 'custom' ? 'Build Your' : "Today's"}
                    </Text>
                    <Text style={styles.titleMuted}>
                        {step === 'day' ? 'Session.' : 'Split.'}
                    </Text>
                </View>

                {step === 'split' && (
                    <>
                        {workoutCollections}

                        {/* Preset Splits */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>CHOOSE A SPLIT</Text>
                            {PRESET_SPLITS.map((split) => (
                                <Pressable
                                    key={split.id}
                                    style={styles.splitRow}
                                    onPress={() => handleSplitSelect(split)}
                                >
                                    <View style={styles.splitInfo}>
                                        <Text style={styles.splitName}>{split.name}</Text>
                                        <Text style={styles.splitDesc}>{split.description}</Text>
                                        <View style={styles.daysPreview}>
                                            {split.days.slice(0, 4).map((day, i) => (
                                                <View key={i} style={styles.dayChip}>
                                                    <Text style={styles.dayChipText}>{day}</Text>
                                                </View>
                                            ))}
                                            {split.days.length > 4 && (
                                                <Text style={styles.moreText}>+{split.days.length - 4}</Text>
                                            )}
                                        </View>
                                    </View>
                                    <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                                </Pressable>
                            ))}
                        </View>

                        {/* Custom Split */}
                        <View style={styles.section}>
                            <Pressable
                                style={styles.customButton}
                                onPress={() => setStep('custom')}
                                accessibilityRole="button"
                                accessibilityLabel="Create custom split"
                            >
                                <MaterialIcons name="add" size={24} color={colors.primary} />
                                <Text style={styles.customButtonText}>Create Custom Split</Text>
                            </Pressable>
                        </View>

                        {/* Quick Options */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>OR QUICK SELECT</Text>
                            <View style={styles.quickGrid}>
                                <Pressable
                                    style={styles.quickCard}
                                    onPress={() => handleQuickOption('cardio')}
                                >
                                    <MaterialIcons name="directions-run" size={24} color={colors.text.muted} />
                                    <Text style={styles.quickLabel}>Cardio</Text>
                                </Pressable>
                                <Pressable
                                    style={styles.quickCard}
                                    onPress={() => handleQuickOption('rest')}
                                >
                                    <MaterialIcons name="self-improvement" size={24} color={colors.text.muted} />
                                    <Text style={styles.quickLabel}>Rest Day</Text>
                                </Pressable>
                            </View>
                        </View>
                    </>
                )}

                {step === 'custom' && (
                    <>
                        {/* Custom Split Name */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>SPLIT NAME</Text>
                            <TextInput
                                style={styles.input}
                                value={customName}
                                onChangeText={value => { setCustomName(value); setCustomError(''); }}
                                placeholder="My Split"
                                placeholderTextColor={colors.text.subtle}
                                accessibilityLabel="Custom split name"
                                editable={!loading}
                                maxLength={100}
                                autoCapitalize="words"
                            />
                        </View>

                        {/* Days Added */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>
                                YOUR DAYS ({customDays.length}/7)
                            </Text>
                            {customDays.length > 0 ? (
                                <View style={styles.addedDays}>
                                    {customDays.map((day, index) => (
                                        <View key={index} style={styles.addedDayRow}>
                                            <Text style={styles.addedDayNum}>Day {index + 1}</Text>
                                            <Text style={styles.addedDayName}>{day}</Text>
                                            <Pressable onPress={() => removeCustomDay(index)} disabled={loading} style={styles.removeDay} accessibilityRole="button" accessibilityLabel={`Remove ${day} from day ${index + 1}`}>
                                                <MaterialIcons name="close" size={20} color={colors.text.muted} />
                                            </Pressable>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <Text style={styles.emptyText}>Add days from below</Text>
                            )}
                        </View>

                        {/* Body Parts to Add */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>ADD DAYS</Text>
                            <View style={styles.bodyPartsGrid}>
                                {BODY_PARTS.map((part) => (
                                    <Pressable
                                        key={part}
                                        style={[styles.bodyPartChip, customDays.length >= 7 && styles.unavailable]}
                                        onPress={() => addCustomDay(part)}
                                        disabled={loading || customDays.length >= 7}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Add ${part} day`}
                                        accessibilityState={{ disabled: loading || customDays.length >= 7 }}
                                    >
                                        <MaterialIcons name="add" size={16} color={colors.primary} />
                                        <Text style={styles.bodyPartText}>{part}</Text>
                                    </Pressable>
                                ))}

                                {/* Custom Day Button/Input */}
                                {isAddingCustomDay ? (
                                    <View style={[styles.bodyPartChip, styles.customDayInputContainer]}>
                                        <TextInput
                                            style={styles.customDayInput}
                                            value={customDayInput}
                                            onChangeText={value => { setCustomDayInput(value); setCustomError(''); }}
                                            placeholder="e.g. Core & mobility"
                                            placeholderTextColor={colors.text.muted}
                                            accessibilityLabel="Custom day name"
                                            editable={!loading}
                                            maxLength={100}
                                            autoFocus
                                            onSubmitEditing={handleAddCustomDay}
                                            onBlur={() => {
                                                if (!customDayInput.trim()) setIsAddingCustomDay(false);
                                            }}
                                        />
                                        <TouchableOpacity onPress={handleAddCustomDay} disabled={loading} style={styles.removeDay} accessibilityRole="button" accessibilityLabel="Add custom day">
                                            <MaterialIcons name="check" size={16} color={colors.primary} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <Pressable
                                        style={[styles.bodyPartChip, { borderColor: colors.primary }]}
                                        onPress={() => setIsAddingCustomDay(true)}
                                        disabled={loading || customDays.length >= 7}
                                        accessibilityRole="button"
                                        accessibilityLabel="Write a custom day"
                                    >
                                        <MaterialIcons name="edit" size={14} color={colors.primary} />
                                        <Text style={[styles.bodyPartText, { color: colors.primary }]}>Custom</Text>
                                    </Pressable>
                                )}
                            </View>
                        </View>
                    </>
                )}

                {step === 'day' && selectedSplit && (
                    <>
                        {/* Selected Split Info */}
                        <View style={styles.section}>
                            <View style={styles.selectedSplitCard}>
                                <View style={styles.selectedSplitHeader}>
                                    <View style={styles.selectedSplitCopy}>
                                        <Text style={styles.selectedSplitName}>{selectedSplit.name}</Text>
                                        <Text style={styles.selectedSplitDesc}>{selectedSplit.daysPerWeek} days/week</Text>
                                    </View>
                                    <View style={styles.selectedSplitActions}>
                                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Change training plan" onPress={handleChangeSplit} style={styles.changeSplitBtn}>
                                        <Ionicons name="swap-horizontal-outline" size={18} color={colors.text.dark} />
                                        <Text style={styles.changeSplitText}>Change plan</Text>
                                    </TouchableOpacity>
                                    {selectedDayIndex !== null && !/^(rest|rest day|off|recovery)$/i.test(selectedSplit.days[selectedDayIndex]?.trim() || '') && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Customize session exercises" onPress={() => handleSave(true)} disabled={loading} style={styles.changeSplitBtn}><Ionicons name="options-outline" size={18} color={colors.text.dark} /><Text style={styles.changeSplitText}>Edit exercises</Text></TouchableOpacity>}
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Day Selection */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>WHICH DAY ARE YOU ON?</Text>
                            <View style={styles.daysGrid}>
                                {selectedSplit.days.map((day, index) => (
                                    <Pressable
                                        key={index}
                                        style={[
                                            styles.dayCard,
                                            selectedDayIndex === index && styles.dayCardActive,
                                            suggestedDayIndex === index && selectedDayIndex !== index && styles.dayCardSuggested,
                                        ]}
                                        onPress={() => handleDaySelect(index)}
                                        disabled={loading}
                                    >
                                        <Text style={[
                                            styles.dayCardNum,
                                            selectedDayIndex === index && styles.dayCardTextActive
                                        ]}>
                                            Day {index + 1}
                                        </Text>
                                        <Text style={[
                                            styles.dayCardName,
                                            selectedDayIndex === index && styles.dayCardTextActive
                                        ]}>
                                            {day}
                                        </Text>
                                        {suggestedDayIndex === index && (
                                            <View style={styles.suggestedPill}>
                                                <Text style={[
                                                    styles.suggestedPillText,
                                                    selectedDayIndex === index && { color: colors.text.dark }
                                                ]}>NEXT</Text>
                                            </View>
                                        )}
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        {workoutCollections}
                        {/* Quick options when user has a split */}
                        <View style={styles.section}>
                            <Text style={styles.sectionLabel}>NOT TRAINING TODAY?</Text>
                            <View style={styles.quickGrid}>
                                <Pressable style={styles.quickCard} onPress={() => handleQuickOption('cardio')}>
                                    <MaterialIcons name="directions-run" size={24} color={colors.text.muted} />
                                    <Text style={styles.quickLabel}>Cardio</Text>
                                </Pressable>
                                <Pressable style={styles.quickCard} onPress={() => handleQuickOption('rest')}>
                                    <MaterialIcons name="self-improvement" size={24} color={colors.text.muted} />
                                    <Text style={styles.quickLabel}>Rest Day</Text>
                                </Pressable>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                {/* Privacy Toggle */}
                <View style={styles.privacyToggle}>
                    {(['public', 'friends', 'private'] as const).map((v) => (
                        <Pressable
                            key={v}
                            style={[
                                styles.privacyOption,
                                visibility === v && styles.privacyOptionActive
                            ]}
                            onPress={() => setVisibility(v)}
                            disabled={loading}
                            accessibilityRole="radio"
                            accessibilityLabel={v.charAt(0).toUpperCase() + v.slice(1)}
                            accessibilityState={{ selected: visibility === v, checked: visibility === v, disabled: loading }}
                            aria-checked={visibility === v}
                        >
                            <Text style={[
                                styles.privacyText,
                                visibility === v && styles.privacyTextActive
                            ]}>
                                {v.charAt(0).toUpperCase() + v.slice(1)}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {/* Save Custom Button */}
                {step === 'custom' && !!customError && <Text style={styles.customError} accessibilityRole="alert" accessibilityLiveRegion="polite">{customError}</Text>}
                {step === 'custom' && customDays.length > 0 && (
                    <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={saveCustomSplit}
                        disabled={loading}
                        accessibilityRole="button"
                        accessibilityLabel="Use this split"
                        accessibilityState={{ busy: loading, disabled: loading }}
                    >
                        {loading && <ActivityIndicator color={colors.text.dark} />}
                        <Text style={styles.confirmButtonText}>
                            {loading ? 'Saving split...' : 'Use this split'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Save Button for Day Selection */}
                {step === 'day' && selectedDayIndex !== null && (
                    <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={() => handleSave()}
                        disabled={loading}
                    >
                        <Text style={styles.confirmButtonText}>
                            {loading ? 'Saving...' : `Start ${selectedSplit?.days[selectedDayIndex]} Session`}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    customError: { color: '#FCA5A5', fontFamily: typography.fontFamily.regular, fontSize: 13, lineHeight: 21, marginBottom: 12 },
    removeDay: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    skipButton: { minWidth: 64, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
    unavailable: { opacity: 0.4 },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
    },
    closeButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    skipText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xl,
    },
    titleSection: {
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
    },
    title: {
        fontSize: typography.sizes['4xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        letterSpacing: -1,
    },
    titleMuted: {
        fontSize: typography.sizes['4xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: -1,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.lg,
    },

    // Split Row (List Style)
    splitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    splitInfo: {
        flex: 1,
    },
    splitName: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        marginBottom: 2,
    },
    splitDesc: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginBottom: spacing.sm,
    },
    daysPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    dayChip: {
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    dayChipText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    moreText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginLeft: spacing.xs,
    },

    // Custom Button
    customButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        padding: spacing.lg,
        gap: spacing.sm,
    },
    customButtonText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.primary,
    },

    // Quick Options
    quickGrid: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    quickCard: {
        flex: 1,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.lg,
        alignItems: 'center',
        gap: spacing.sm,
    },
    quickLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },

    // Custom Split Builder
    input: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.lg,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    addedDays: {
        gap: spacing.sm,
    },
    addedDayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        gap: spacing.md,
    },
    addedDayNum: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        width: 50,
    },
    addedDayName: {
        flex: 1,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    emptyText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.subtle,
        textAlign: 'center',
        padding: spacing.xl,
    },
    bodyPartsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    bodyPartChip: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: 4,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    bodyPartText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },

    // Selected Split Card
    selectedSplitActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    selectedSplitCard: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
    },
    selectedSplitHeader: {
        gap: spacing.lg,
        alignItems: 'flex-start',
    },
    selectedSplitCopy: { width: '100%', gap: spacing.sm },
    selectedSplitName: {
        fontSize: typography.sizes.lg,
        lineHeight: 23,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
    },
    selectedSplitDesc: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.dark,
        opacity: 0.8,
    },
    changeSplitBtn: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.15)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        gap: 4,
    },
    changeSplitText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
    },

    // Days Grid
    daysGrid: {
        gap: spacing.md,
    },
    dayCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        padding: spacing.lg,
    },
    dayCardActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dayCardSuggested: {
        borderColor: colors.primary + '60',
        borderWidth: 2,
    },
    dayCardNum: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        width: 60,
    },
    dayCardName: {
        flex: 1,
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    dayCardTextActive: {
        color: colors.text.dark,
    },
    suggestedPill: {
        backgroundColor: colors.primary + '20',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
    },
    suggestedPillText: {
        fontSize: 9,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
        letterSpacing: 1,
    },

    // Discover Styles
    discoverCard: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.primary + '40',
        marginBottom: spacing.lg,
    },
    discoverContent: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    discoverIconBg: {
        flexShrink: 0,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    discoverTitle: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    discoverDesc: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: 2,
    },

    // Footer
    footer: {
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        paddingTop: spacing.xl,
        paddingBottom: spacing['3xl'],
        paddingHorizontal: spacing.xl,
        ...shadow({ y: -4, blur: 8, color: '#000000', opacity: 0.1 }),
    },
    privacyToggle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.full,
        padding: spacing.xs,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    privacyOption: {
        flex: 1,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
    },
    privacyOptionActive: {
        backgroundColor: colors.primary,
        ...shadow({ y: 2, blur: 4, color: colors.primary, opacity: 0.3 }),
    },
    privacyText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },
    privacyTextActive: {
        color: colors.text.dark,
        fontFamily: typography.fontFamily.bold,
    },
    confirmButton: {
        backgroundColor: colors.primary,
        minHeight: 56,
        padding: 14,
        gap: 4,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.glow,
    },
    confirmButtonText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },

    // Custom Day Input Styles
    customDayInputContainer: {
        borderColor: colors.primary,
        paddingRight: spacing.sm,
        minWidth: 120,
    },
    customDayInput: {
        color: colors.text.primary,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        minWidth: 80,
        padding: 0,
        height: 20,
    },
});
