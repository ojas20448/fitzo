import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import { nutritionAPI, workoutsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function OnboardingWizard() {
    const toast = useToast();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        // Bio
        height_cm: '',
        weight_kg: '',
        age: '',
        gender: 'male' as 'male' | 'female',

        // Goals
        goal_type: 'maintenance' as 'fat_loss' | 'maintenance' | 'muscle_gain',
        activity_level: 'moderate' as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active',

        // Split (Optional)
        split_id: null as string | null,
    });

    const updateForm = (key: string, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const nextStep = () => {
        if (step === 1) {
            if (!formData.height_cm || !formData.weight_kg || !formData.age) {
                toast.error('Missing Info', 'Please fill in all fields');
                return;
            }
        }
        setStep(prev => prev + 1);
    };

    const prevStep = () => {
        setStep(prev => prev - 1);
    };

    const calculateBMI = () => {
        const height = parseFloat(formData.height_cm) / 100;
        const weight = parseFloat(formData.weight_kg);
        if (!height || !weight) return 0;
        return (weight / (height * height)).toFixed(1);
    };

    const getBMICategory = (bmi: number) => {
        if (bmi < 18.5) return { label: 'Underweight', color: '#3B82F6' };
        if (bmi < 25) return { label: 'Normal Weight', color: '#22C55E' };
        if (bmi < 30) return { label: 'Overweight', color: '#F59E0B' };
        return { label: 'Obese', color: '#EF4444' };
    };

    const calculateTDEE = () => {
        const weight = parseFloat(formData.weight_kg);
        const height = parseFloat(formData.height_cm);
        const age = parseFloat(formData.age);

        if (!weight || !height || !age) return 2000;

        let bmr = 10 * weight + 6.25 * height - 5 * age;
        bmr += formData.gender === 'male' ? 5 : -161;

        const multipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            very_active: 1.9,
        };

        return Math.round(bmr * multipliers[formData.activity_level]);
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            // Save Profile
            await nutritionAPI.updateProfile({
                weight_kg: parseFloat(formData.weight_kg),
                height_cm: parseFloat(formData.height_cm),
                age: parseInt(formData.age),
                gender: formData.gender,
                goal_type: formData.goal_type,
                activity_level: formData.activity_level,
            });

            // If split selected, adopt it
            if (formData.split_id) {
                await workoutsAPI.adoptSplit(formData.split_id);
            }

            toast.success('Welcome to Fitzo!', 'Your profile is ready.');
            router.replace('/(tabs)/home' as any);
        } catch (error) {
            console.error(error);
            toast.error('Error', 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Let's get to know you</Text>
            <Text style={styles.stepDesc}>We need your stats to calculate your personalized nutrition plan.</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Height (cm)</Text>
                <TextInput
                    style={styles.input}
                    value={formData.height_cm}
                    onChangeText={t => updateForm('height_cm', t)}
                    keyboardType="numeric"
                    placeholder="175"
                    placeholderTextColor={colors.text.subtle}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Weight (kg)</Text>
                <TextInput
                    style={styles.input}
                    value={formData.weight_kg}
                    onChangeText={t => updateForm('weight_kg', t)}
                    keyboardType="numeric"
                    placeholder="70"
                    placeholderTextColor={colors.text.subtle}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Age</Text>
                <TextInput
                    style={styles.input}
                    value={formData.age}
                    onChangeText={t => updateForm('age', t)}
                    keyboardType="numeric"
                    placeholder="25"
                    placeholderTextColor={colors.text.subtle}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.genderRow}>
                    <TouchableOpacity
                        style={[styles.genderBtn, formData.gender === 'male' && styles.genderBtnActive]}
                        onPress={() => updateForm('gender', 'male')}
                    >
                        <MaterialIcons name="male" size={24} color={formData.gender === 'male' ? colors.primary : colors.text.muted} />
                        <Text style={[styles.genderText, formData.gender === 'male' && styles.genderTextActive]}>Male</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.genderBtn, formData.gender === 'female' && styles.genderBtnActive]}
                        onPress={() => updateForm('gender', 'female')}
                    >
                        <MaterialIcons name="female" size={24} color={formData.gender === 'female' ? colors.primary : colors.text.muted} />
                        <Text style={[styles.genderText, formData.gender === 'female' && styles.genderTextActive]}>Female</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What is your goal?</Text>

            <View style={styles.optionsContainer}>
                {[
                    { id: 'fat_loss', label: 'Lose Fat', icon: 'trending-down' },
                    { id: 'maintenance', label: 'Maintain', icon: 'remove' },
                    { id: 'muscle_gain', label: 'Build Muscle', icon: 'trending-up' }
                ].map(opt => (
                    <TouchableOpacity
                        key={opt.id}
                        style={[styles.optionCard, formData.goal_type === opt.id && styles.optionCardActive]}
                        onPress={() => updateForm('goal_type', opt.id)}
                    >
                        <MaterialIcons name={opt.icon as any} size={24} color={formData.goal_type === opt.id ? colors.text.dark : colors.primary} />
                        <Text style={[styles.optionText, formData.goal_type === opt.id && styles.optionTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.stepTitle, { marginTop: spacing['2xl'] }]}>Activity Level</Text>
            <View style={styles.optionsContainer}>
                {[
                    { id: 'sedentary', label: 'Sedentary (Office job)' },
                    { id: 'moderate', label: 'Moderate (Exercise 3-5x)' },
                    { id: 'very_active', label: 'Very Active (Athlete)' }
                ].map(opt => (
                    <TouchableOpacity
                        key={opt.id}
                        style={[styles.optionCard, formData.activity_level === opt.id && styles.optionCardActive]}
                        onPress={() => updateForm('activity_level', opt.id)}
                    >
                        <Text style={[styles.optionText, formData.activity_level === opt.id && styles.optionTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderStep3 = () => {
        const bmi = parseFloat(calculateBMI() as string);
        const { label, color } = getBMICategory(bmi);
        const tdee = calculateTDEE();

        // Calculate recommended target
        let recommendedCalories = tdee;
        if (formData.goal_type === 'fat_loss') recommendedCalories -= 500;
        if (formData.goal_type === 'muscle_gain') recommendedCalories += 300;

        return (
            <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Your Blueprint</Text>

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>BMI</Text>
                        <Text style={[styles.statValue, { color }]}>{bmi}</Text>
                        <Text style={[styles.statSub, { color }]}>{label}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Daily Target</Text>
                        <Text style={styles.statValue}>{recommendedCalories}</Text>
                        <Text style={styles.statSub}>Calories</Text>
                    </View>
                </View>

                <View style={styles.infoBox}>
                    <MaterialIcons name="info" size={20} color={colors.primary} />
                    <Text style={styles.infoText}>
                        Based on your stats, we've personalized your nutrition plan. You can adjust this later in settings.
                    </Text>
                </View>
            </View>
        );
    };

    const renderStep4 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Pick a Starting Plan</Text>
            <Text style={styles.stepDesc}>Structure your training for best results.</Text>

            <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: 20 }}>
                {[
                    { id: '79273950-8b1b-4d7a-9a3b-2c5e5f5f5f5f', name: 'PPL (6 Day)', days: 6, level: 'Advanced' },
                    { id: 'c1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', name: 'Upper Lower (4 Day)', days: 4, level: 'Intermediate' },
                    { id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', name: 'Full Body (3 Day)', days: 3, level: 'Beginner' }
                ].map(opt => (
                    <TouchableOpacity
                        key={opt.id}
                        style={[styles.splitCard, formData.split_id === opt.id && styles.splitCardActive]}
                        onPress={() => updateForm('split_id', opt.id)}
                    >
                        <View>
                            <Text style={[styles.splitName, formData.split_id === opt.id && styles.textDark]}>{opt.name}</Text>
                            <Text style={[styles.splitMeta, formData.split_id === opt.id && styles.textDark]}>{opt.days} Days • {opt.level}</Text>
                        </View>
                        {formData.split_id === opt.id && <MaterialIcons name="check-circle" size={24} color={colors.text.dark} />}
                    </TouchableOpacity>
                ))}

                <TouchableOpacity
                    style={styles.browseBtn}
                    onPress={() => updateForm('split_id', null)}
                >
                    <Text style={styles.browseText}>I'll choose later / Custom</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${(step / 4) * 100}%` }]} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
            </ScrollView>

            <View style={styles.footer}>
                {step > 1 && (
                    <TouchableOpacity style={styles.backBtn} onPress={prevStep}>
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.nextBtn, (!formData.height_cm && step === 1) && styles.disabledBtn]}
                    onPress={step === 4 ? handleComplete : nextStep}
                    disabled={step === 1 && !formData.height_cm}
                >
                    <Text style={styles.nextText}>{step === 4 ? 'Get Started' : 'Next'}</Text>
                    {step < 4 && <MaterialIcons name="arrow-forward" size={20} color={colors.text.dark} />}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    progressContainer: {
        height: 4,
        backgroundColor: colors.surfaceLight,
        width: '100%',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primary,
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.xl,
    },
    stepContainer: {
        flex: 1,
    },
    stepTitle: {
        fontSize: typography.sizes['3xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    stepDesc: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        marginBottom: spacing.xl,
    },
    inputGroup: {
        marginBottom: spacing.xl,
    },
    label: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.muted,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    input: {
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        color: colors.text.primary,
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
    },
    genderRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    genderBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
    },
    genderBtnActive: {
        backgroundColor: colors.glass.surfaceHover,
        borderColor: colors.primary,
    },
    genderText: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
    },
    genderTextActive: {
        color: colors.primary,
        fontFamily: typography.fontFamily.bold,
    },
    optionsContainer: {
        gap: spacing.md,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    optionCardActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    optionText: {
        fontSize: typography.sizes.base,
        color: colors.text.primary,
        fontFamily: typography.fontFamily.medium,
    },
    optionTextActive: {
        color: colors.text.dark,
        fontFamily: typography.fontFamily.bold,
    },
    statsGrid: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    statCard: {
        flex: 1,
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
        marginBottom: spacing.xs,
    },
    statValue: {
        fontSize: typography.sizes['3xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    statSub: {
        fontSize: typography.sizes.xs,
        color: colors.text.muted,
        marginTop: 4,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: colors.primary + '15',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.md,
    },
    infoText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    splitCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
        borderRadius: borderRadius.lg,
    },
    splitCardActive: {
        backgroundColor: colors.primary,
    },
    splitName: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: 2,
    },
    splitMeta: {
        fontSize: typography.sizes.sm,
        color: colors.text.muted,
    },
    textDark: {
        color: colors.text.dark,
    },
    browseBtn: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    browseText: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
    },
    footer: {
        padding: spacing.xl,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    backBtn: {
        padding: spacing.md,
    },
    backText: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.medium,
    },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.2xl,
        borderRadius: borderRadius.full,
        gap: spacing.sm,
        ...shadows.glow,
    },
    disabledBtn: {
        opacity: 0.5,
        ...shadows.glass,
    },
    nextText: {
        color: colors.text.dark,
        fontFamily: typography.fontFamily.bold,
        fontSize: typography.sizes.base,
    },
});
