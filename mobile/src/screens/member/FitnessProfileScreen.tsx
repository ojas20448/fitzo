import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { nutritionAPI } from '../../services/api';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import { useToast } from '../../components/Toast';

const GOALS = [
    { id: 'fat_loss', label: 'Lose Fat', icon: 'trending-down', color: '#FF6B6B' },
    { id: 'maintenance', label: 'Maintain', icon: 'swap-vert', color: '#4ECDC4' },
    { id: 'muscle_gain', label: 'Build Muscle', icon: 'trending-up', color: '#FFE66D' },
];

const ACTIVITY_LEVELS = [
    { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
    { id: 'light', label: 'Light', desc: '1-3 days/week' },
    { id: 'moderate', label: 'Moderate', desc: '3-5 days/week' },
    { id: 'active', label: 'Active', desc: '6-7 days/week' },
    { id: 'very_active', label: 'Very Active', desc: 'Twice daily' },
];

export default function FitnessProfileScreen() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [height, setHeight] = useState('170');
    const [weight, setWeight] = useState('70');
    const [age, setAge] = useState('25');
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [goalType, setGoalType] = useState('maintenance');
    const [activityLevel, setActivityLevel] = useState('moderate');
    const [isVegetarian, setIsVegetarian] = useState(false);

    // Calculated values
    const bmi = parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2) || 0;
    const bmiCategory = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
    const bmiColor = bmi < 18.5 || bmi >= 30 ? '#FF6B6B' : bmi < 25 ? '#4ECDC4' : '#FFE66D';

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const { profile } = await nutritionAPI.getProfile();
            if (profile) {
                setHeight(String(profile.height_cm || 170));
                setWeight(String(profile.weight_kg || 70));
                setAge(String(profile.age || 25));
                setGender(profile.gender || 'male');
                setGoalType(profile.goal_type || 'maintenance');
                setActivityLevel(profile.activity_level || 'moderate');
                setIsVegetarian(profile.is_vegetarian || false);
            }
        } catch (error) {
            console.log('No existing profile, using defaults');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await nutritionAPI.updateProfile({
                height_cm: parseFloat(height),
                weight_kg: parseFloat(weight),
                age: parseInt(age),
                gender,
                activity_level: activityLevel as any,
                goal_type: goalType as any,
                is_vegetarian: isVegetarian,
            });

            toast.success('Profile Updated!', `Daily target: ${result.profile.target_calories} kcal`);
            router.back();
        } catch (error) {
            console.error(error);
            toast.error('Error', 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Fitness Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* BMI Display */}
                <View style={styles.bmiCard}>
                    <Text style={styles.bmiLabel}>Your BMI</Text>
                    <Text style={[styles.bmiValue, { color: bmiColor }]}>{bmi.toFixed(1)}</Text>
                    <Text style={[styles.bmiCategory, { color: bmiColor }]}>{bmiCategory}</Text>
                </View>

                {/* Physical Stats */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PHYSICAL STATS</Text>

                    {/* Gender Toggle */}
                    <View style={styles.genderRow}>
                        <Pressable
                            style={[styles.genderBtn, gender === 'male' && styles.genderBtnActive]}
                            onPress={() => setGender('male')}
                        >
                            <MaterialIcons name="male" size={20} color={gender === 'male' ? colors.text.dark : colors.text.muted} />
                            <Text style={[styles.genderText, gender === 'male' && styles.genderTextActive]}>Male</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.genderBtn, gender === 'female' && styles.genderBtnActive]}
                            onPress={() => setGender('female')}
                        >
                            <MaterialIcons name="female" size={20} color={gender === 'female' ? colors.text.dark : colors.text.muted} />
                            <Text style={[styles.genderText, gender === 'female' && styles.genderTextActive]}>Female</Text>
                        </Pressable>
                    </View>

                    {/* Height, Weight, Age Inputs */}
                    <View style={styles.inputRow}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Height</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    value={height}
                                    onChangeText={setHeight}
                                    keyboardType="numeric"
                                    placeholder="170"
                                    placeholderTextColor={colors.text.subtle}
                                />
                                <Text style={styles.inputUnit}>cm</Text>
                            </View>
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Weight</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    value={weight}
                                    onChangeText={setWeight}
                                    keyboardType="numeric"
                                    placeholder="70"
                                    placeholderTextColor={colors.text.subtle}
                                />
                                <Text style={styles.inputUnit}>kg</Text>
                            </View>
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Age</Text>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    value={age}
                                    onChangeText={setAge}
                                    keyboardType="numeric"
                                    placeholder="25"
                                    placeholderTextColor={colors.text.subtle}
                                />
                                <Text style={styles.inputUnit}>yrs</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Goal Selection */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>YOUR GOAL</Text>
                    <View style={styles.goalsRow}>
                        {GOALS.map((goal) => (
                            <Pressable
                                key={goal.id}
                                style={[
                                    styles.goalCard,
                                    goalType === goal.id && [styles.goalCardActive, { borderColor: goal.color }]
                                ]}
                                onPress={() => setGoalType(goal.id)}
                            >
                                <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                                    <MaterialIcons name={goal.icon as any} size={24} color={goal.color} />
                                </View>
                                <Text style={[
                                    styles.goalLabel,
                                    goalType === goal.id && { color: goal.color }
                                ]}>{goal.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Activity Level */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ACTIVITY LEVEL</Text>
                    {ACTIVITY_LEVELS.map((level) => (
                        <Pressable
                            key={level.id}
                            style={[
                                styles.activityRow,
                                activityLevel === level.id && styles.activityRowActive
                            ]}
                            onPress={() => setActivityLevel(level.id)}
                        >
                            <View style={styles.activityRadio}>
                                {activityLevel === level.id && <View style={styles.activityRadioInner} />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.activityLabel}>{level.label}</Text>
                                <Text style={styles.activityDesc}>{level.desc}</Text>
                            </View>
                        </Pressable>
                    ))}
                </View>

                {/* Vegetarian Toggle */}
                <View style={styles.section}>
                    <Pressable
                        style={styles.toggleRow}
                        onPress={() => setIsVegetarian(!isVegetarian)}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.toggleLabel}>Vegetarian</Text>
                            <Text style={styles.toggleDesc}>Show vegetarian food suggestions first</Text>
                        </View>
                        <View style={[styles.toggle, isVegetarian && styles.toggleActive]}>
                            <View style={[styles.toggleKnob, isVegetarian && styles.toggleKnobActive]} />
                        </View>
                    </Pressable>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
                </TouchableOpacity>
            </ScrollView>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: 100,
    },

    // BMI Card
    bmiCard: {
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    bmiLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 1,
    },
    bmiValue: {
        fontSize: 48,
        fontFamily: typography.fontFamily.bold,
        marginVertical: spacing.sm,
    },
    bmiCategory: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
    },

    // Section
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        letterSpacing: 2,
        marginBottom: spacing.lg,
    },

    // Gender
    genderRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    genderBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    genderBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    genderText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    genderTextActive: {
        color: colors.text.dark,
    },

    // Inputs
    inputRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginBottom: spacing.sm,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
        paddingHorizontal: spacing.md,
    },
    input: {
        flex: 1,
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        paddingVertical: spacing.md,
    },
    inputUnit: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
    },

    // Goals
    goalsRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    goalCard: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 2,
        borderColor: colors.glass.border,
    },
    goalCardActive: {
        backgroundColor: colors.surfaceLight,
    },
    goalIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    goalLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.secondary,
    },

    // Activity
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: spacing.md,
    },
    activityRowActive: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '10',
    },
    activityRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.text.muted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityRadioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    activityLabel: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    activityDesc: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },

    // Toggle
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    toggleLabel: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    toggleDesc: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    toggle: {
        width: 50,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.surfaceLight,
        padding: 2,
    },
    toggleActive: {
        backgroundColor: colors.primary,
    },
    toggleKnob: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: colors.text.primary,
    },
    toggleKnobActive: {
        marginLeft: 20,
    },

    // Save
    saveBtn: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        padding: spacing.lg,
        alignItems: 'center',
        marginTop: spacing.xl,
        ...shadows.glow,
    },
    saveBtnDisabled: {
        opacity: 0.7,
    },
    saveBtnText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.dark,
        letterSpacing: 1,
    },
});
