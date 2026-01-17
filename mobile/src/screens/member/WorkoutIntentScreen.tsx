import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { intentAPI, workoutsAPI } from '../../services/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

// Preset splits
const PRESET_SPLITS = [
    {
        id: 'ppl_6',
        name: 'PPL (6 Day)',
        description: 'Push, Pull, Legs × 2',
        days: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'],
        daysPerWeek: 6,
    },
    {
        id: 'ppl_3',
        name: 'PPL (3 Day)',
        description: 'Push, Pull, Legs once per week',
        days: ['Push', 'Pull', 'Legs'],
        daysPerWeek: 3,
    },
    {
        id: 'upper_lower_4',
        name: 'Upper Lower (4 Day)',
        description: 'Upper, Lower × 2',
        days: ['Upper', 'Lower', 'Upper', 'Lower'],
        daysPerWeek: 4,
    },
    {
        id: 'upper_lower_2',
        name: 'Upper Lower (2 Day)',
        description: 'Upper, Lower × 1',
        days: ['Upper', 'Lower'],
        daysPerWeek: 2,
    },
    {
        id: 'full_body_3',
        name: 'Full Body (3 Day)',
        description: 'Full body workouts',
        days: ['Full Body A', 'Full Body B', 'Full Body C'],
        daysPerWeek: 3,
    },
    {
        id: 'anterior_posterior',
        name: 'Anterior / Posterior',
        description: 'Front and back chain',
        days: ['Anterior', 'Posterior', 'Anterior', 'Posterior'],
        daysPerWeek: 4,
    },
    {
        id: 'bro_split',
        name: 'Bro Split (5 Day)',
        description: 'One body part per day',
        days: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'],
        daysPerWeek: 5,
    },
];

// Body parts for custom split
const BODY_PARTS = [
    'Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body',
    'Chest', 'Back', 'Shoulders', 'Arms', 'Quads', 'Hamstrings',
    'Anterior', 'Posterior', 'Chest + Back', 'Arms + Shoulders', 'Legs + Core'
];

export default function WorkoutIntentScreen() {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'split' | 'day' | 'custom'>('split');

    // User's saved split
    const [savedSplit, setSavedSplit] = useState<typeof PRESET_SPLITS[0] | null>(null);
    const [selectedSplit, setSelectedSplit] = useState<typeof PRESET_SPLITS[0] | null>(null);
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
    const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('friends');

    // Custom split builder
    const [customDays, setCustomDays] = useState<string[]>([]);
    const [customName, setCustomName] = useState('My Split');

    // Load user's saved split on mount
    useEffect(() => {
        // TODO: Load from API/storage
        // For now, skip straight to split selection
    }, []);

    const handleSplitSelect = (split: typeof PRESET_SPLITS[0]) => {
        setSelectedSplit(split);
        setStep('day');
    };

    const handleDaySelect = (dayIndex: number) => {
        if (!selectedSplit) return;
        setSelectedDayIndex(dayIndex);
    };

    const handleSave = async () => {
        if (!selectedSplit || selectedDayIndex === null) return;

        setLoading(true);
        try {
            const dayName = selectedSplit.days[selectedDayIndex];

            // Set the intent
            await intentAPI.setIntent({
                training_pattern: selectedSplit.name,
                emphasis: [dayName],
                session_label: dayName,
                visibility,
            });

            // Navigate back to Home
            router.replace('/(tabs)/home' as any);
        } catch (error) {
            console.error('Failed to save intent:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickOption = async (type: 'cardio' | 'rest') => {
        setLoading(true);
        try {
            // Validate: Cardio needs a session, Rest might just be intent?
            // For now, let's treat Cardio as a session start. Rest probably stays as intent or just logs it.
            // Simplified: Start session for Cardio.

            if (type === 'rest') {
                // Just go back for rest
                await intentAPI.setIntent({
                    training_pattern: 'rest',
                    emphasis: ['rest'],
                    session_label: 'Rest Day',
                    visibility,
                });
                router.back();
                return;
            }

            const res = await workoutsAPI.startSession({
                split_id: null,
                day_name: 'Cardio',
                visibility,
            });

            router.replace({
                pathname: '/member/active-workout',
                params: { sessionId: res.session.id }
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const addCustomDay = (part: string) => {
        if (customDays.length < 7) {
            setCustomDays([...customDays, part]);
        }
    };

    const removeCustomDay = (index: number) => {
        setCustomDays(customDays.filter((_, i) => i !== index));
    };

    const saveCustomSplit = () => {
        const custom: typeof PRESET_SPLITS[0] = {
            id: 'custom',
            name: customName,
            description: `${customDays.length} days per week`,
            days: customDays,
            daysPerWeek: customDays.length,
        };
        setSelectedSplit(custom);
        setStep('day');
    };

    const handleBack = () => {
        if (step === 'day') {
            setStep('split');
            setSelectedDayIndex(null);
        } else if (step === 'custom') {
            setStep('split');
            setCustomDays([]);
        } else {
            router.back();
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.closeButton}>
                    <MaterialIcons
                        name={step !== 'split' ? 'arrow-back' : 'close'}
                        size={28}
                        color={colors.text.primary}
                    />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.skipText}>SKIP</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
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
                        {/* Discover Published Splits */}
                        <View style={styles.section}>
                            <Pressable
                                style={styles.discoverCard}
                                onPress={() => router.push('/member/published-splits' as any)}
                            >
                                <View style={styles.discoverContent}>
                                    <View style={styles.discoverIconBg}>
                                        <MaterialIcons name="explore" size={24} color={colors.primary} />
                                    </View>
                                    <View>
                                        <Text style={styles.discoverTitle}>Discover Workouts</Text>
                                        <Text style={styles.discoverDesc}>Find plans created by Fitzo & Community</Text>
                                    </View>
                                </View>
                                <MaterialIcons name="chevron-right" size={24} color={colors.text.muted} />
                            </Pressable>
                        </View>

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
                                onChangeText={setCustomName}
                                placeholder="My Split"
                                placeholderTextColor={colors.text.subtle}
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
                                            <Pressable onPress={() => removeCustomDay(index)}>
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
                                        style={styles.bodyPartChip}
                                        onPress={() => addCustomDay(part)}
                                    >
                                        <MaterialIcons name="add" size={16} color={colors.primary} />
                                        <Text style={styles.bodyPartText}>{part}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </>
                )}

                {step === 'day' && selectedSplit && (
                    <>
                        {/* Selected Split Info */}
                        <View style={styles.section}>
                            <View style={styles.selectedSplitCard}>
                                <Text style={styles.selectedSplitName}>{selectedSplit.name}</Text>
                                <Text style={styles.selectedSplitDesc}>{selectedSplit.daysPerWeek} days/week</Text>
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
                                            selectedDayIndex === index && styles.dayCardActive
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
                                    </Pressable>
                                ))}
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
                {step === 'custom' && customDays.length > 0 && (
                    <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={saveCustomSplit}
                    >
                        <Text style={styles.confirmButtonText}>
                            Use This Split
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Save Button for Day Selection */}
                {step === 'day' && selectedDayIndex !== null && (
                    <TouchableOpacity
                        style={styles.confirmButton}
                        onPress={handleSave}
                        disabled={loading}
                    >
                        <Text style={styles.confirmButtonText}>
                            {loading ? 'Saving...' : 'Save Session'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
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
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
    },
    closeButton: {
        width: 40,
        height: 40,
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
        paddingBottom: 180,
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
    selectedSplitCard: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
    },
    selectedSplitName: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
    },
    selectedSplitDesc: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.dark,
        opacity: 0.8,
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

    // Discover Styles
    discoverCard: {
        flexDirection: 'row',
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    discoverIconBg: {
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
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        paddingTop: spacing.xl,
        paddingBottom: spacing['3xl'],
        paddingHorizontal: spacing.xl,
    },
    privacyToggle: {
        flexDirection: 'row',
        justifyContent: 'center',
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.full,
        padding: 4,
        marginBottom: spacing.lg,
    },
    privacyOption: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
    },
    privacyOptionActive: {
        backgroundColor: colors.primary,
    },
    privacyText: {
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    privacyTextActive: {
        color: colors.text.dark,
    },
    confirmButton: {
        backgroundColor: colors.primary,
        height: 56,
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
});
