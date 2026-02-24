import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useToast } from '../src/components/Toast';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import Button from '../src/components/Button';
import GlassCard from '../src/components/GlassCard';
import { colors, typography, spacing, borderRadius, shadows } from '../src/styles/theme';

export default function RegisterScreen() {
    const { register } = useAuth();
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [gymCode, setGymCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateStep1 = () => {
        const newErrors: Record<string, string> = {};

        if (!name.trim()) {
            newErrors.name = 'Name is required';
        } else if (name.trim().length < 2) {
            newErrors.name = 'Name must be at least 2 characters';
        }

        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            newErrors.email = 'Please enter a valid email';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        const newErrors: Record<string, string> = {};

        if (!password) {
            newErrors.password = 'Password is required';
        } else if (password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            newErrors.password = 'Password must contain uppercase, lowercase, and number';
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) {
            setStep(2);
        }
    };

    const toast = useToast();

    const handleRegister = async () => {
        if (!validateStep2()) return;

        setLoading(true);
        try {
            await register(email.trim().toLowerCase(), password, name.trim(), gymCode.trim() || '');
            toast.success('Account created successfully!');
            // Redirect to root and let the auth guard in app/index.tsx decide where to send the user
            // This prevents conflicts with the onboarding redirect
            setTimeout(() => {
                router.replace('/');
            }, 100);
        } catch (error: any) {
            toast.error(error.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const renderStep1 = () => (
        <>
            <Text style={styles.stepTitle}>Let's get started</Text>
            <Text style={styles.stepSubtitle}>Tell us about yourself</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={[styles.inputContainer, errors.name && styles.inputError]}>
                    <MaterialIcons name="person" size={20} color={colors.text.muted} />
                    <TextInput
                        style={styles.input}
                        placeholder="John Doe"
                        placeholderTextColor={colors.text.muted}
                        value={name}
                        onChangeText={(text) => {
                            setName(text);
                            if (errors.name) setErrors({ ...errors, name: '' });
                        }}
                        autoCapitalize="words"
                        autoCorrect={false}
                        accessibilityLabel="Full name input"
                    />
                </View>
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={[styles.inputContainer, errors.email && styles.inputError]}>
                    <MaterialIcons name="email" size={20} color={colors.text.muted} />
                    <TextInput
                        style={styles.input}
                        placeholder="john@example.com"
                        placeholderTextColor={colors.text.muted}
                        value={email}
                        onChangeText={(text) => {
                            setEmail(text);
                            if (errors.email) setErrors({ ...errors, email: '' });
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        accessibilityLabel="Email input"
                    />
                </View>
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gym Code <Text style={styles.optionalLabel}>(optional)</Text></Text>
                <View style={styles.inputContainer}>
                    <MaterialIcons name="fitness-center" size={20} color={colors.text.muted} />
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your gym code"
                        placeholderTextColor={colors.text.muted}
                        value={gymCode}
                        onChangeText={setGymCode}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        accessibilityLabel="Gym code input"
                    />
                </View>
                <Text style={styles.helperText}>Ask your gym for a code to connect your membership</Text>
            </View>

            <Button
                title="Continue"
                onPress={handleNext}
                fullWidth
                style={{ marginTop: spacing.xl }}
            />
        </>
    );

    const renderStep2 = () => (
        <>
            <Text style={styles.stepTitle}>Secure your account</Text>
            <Text style={styles.stepSubtitle}>Create a strong password</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={[styles.inputContainer, errors.password && styles.inputError]}>
                    <MaterialIcons name="lock" size={20} color={colors.text.muted} />
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={colors.text.muted}
                        value={password}
                        onChangeText={(text) => {
                            setPassword(text);
                            if (errors.password) setErrors({ ...errors, password: '' });
                        }}
                        secureTextEntry={!showPassword}
                        accessibilityLabel="Password input"
                    />
                    <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.eyeButton}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    >
                        <MaterialIcons
                            name={showPassword ? 'visibility' : 'visibility-off'}
                            size={20}
                            color={colors.text.muted}
                        />
                    </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

                {/* Password requirements */}
                <View style={styles.requirements}>
                    <PasswordRequirement
                        met={password.length >= 8}
                        text="At least 8 characters"
                    />
                    <PasswordRequirement
                        met={/[A-Z]/.test(password)}
                        text="One uppercase letter"
                    />
                    <PasswordRequirement
                        met={/[a-z]/.test(password)}
                        text="One lowercase letter"
                    />
                    <PasswordRequirement
                        met={/\d/.test(password)}
                        text="One number"
                    />
                </View>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <View style={[styles.inputContainer, errors.confirmPassword && styles.inputError]}>
                    <MaterialIcons name="lock-outline" size={20} color={colors.text.muted} />
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={colors.text.muted}
                        value={confirmPassword}
                        onChangeText={(text) => {
                            setConfirmPassword(text);
                            if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                        }}
                        secureTextEntry={!showPassword}
                        accessibilityLabel="Confirm password input"
                    />
                    {confirmPassword && password === confirmPassword && (
                        <MaterialIcons name="check-circle" size={20} color={colors.crowd.low} />
                    )}
                </View>
                {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </View>

            <View style={styles.buttonRow}>
                <Button
                    title="Back"
                    onPress={() => setStep(1)}
                    variant="secondary"
                    style={{ flex: 1, marginRight: spacing.md }}
                />
                <Button
                    title="Create Account"
                    onPress={handleRegister}
                    loading={loading}
                    style={{ flex: 2 }}
                />
            </View>
        </>
    );

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => step === 1 ? router.back() : setStep(1)}
                        accessibilityLabel="Go back"
                    >
                        <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                    </TouchableOpacity>

                    {/* Progress indicator */}
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
                        <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
                        <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
                    </View>

                    <View style={{ width: 44 }} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Logo */}
                    <View style={styles.logoSection}>
                        <View style={styles.logoContainer}>
                            <MaterialIcons name="fitness-center" size={32} color={colors.background} />
                        </View>
                    </View>

                    {/* Form */}
                    <View style={styles.formSection}>
                        {step === 1 ? renderStep1() : renderStep2()}
                    </View>

                    {/* Terms */}
                    <Text style={styles.terms}>
                        By creating an account, you agree to our{' '}
                        <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                        <Text style={styles.termsLink}>Privacy Policy</Text>
                    </Text>

                    {/* Login Link */}
                    <View style={styles.loginSection}>
                        <Text style={styles.loginText}>Already have an account?</Text>
                        <TouchableOpacity onPress={() => router.replace('/login')}>
                            <Text style={styles.loginLink}>Log In</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// Password requirement indicator component
const PasswordRequirement: React.FC<{ met: boolean; text: string }> = ({ met, text }) => (
    <View style={styles.requirement}>
        <MaterialIcons
            name={met ? 'check-circle' : 'radio-button-unchecked'}
            size={14}
            color={met ? colors.crowd.low : colors.text.muted}
        />
        <Text style={[styles.requirementText, met && styles.requirementMet]}>{text}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.glass.surface,
        borderWidth: 2,
        borderColor: colors.glass.border,
    },
    progressDotActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    progressLine: {
        width: 40,
        height: 2,
        backgroundColor: colors.glass.border,
        marginHorizontal: 4,
    },
    progressLineActive: {
        backgroundColor: colors.primary,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing['3xl'],
    },
    logoSection: {
        alignItems: 'center',
        marginTop: spacing.xl,
        marginBottom: spacing['2xl'],
    },
    logoContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.glow,
    },
    formSection: {
        flex: 1,
    },
    stepTitle: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    stepSubtitle: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        marginBottom: spacing['2xl'],
    },
    inputGroup: {
        marginBottom: spacing.lg,
    },
    inputLabel: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    optionalLabel: {
        color: colors.text.muted,
        fontFamily: typography.fontFamily.regular,
    },
    helperText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        paddingHorizontal: spacing.lg,
        height: 56,
        gap: spacing.md,
    },
    inputError: {
        borderColor: colors.error,
    },
    input: {
        flex: 1,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
    },
    eyeButton: {
        padding: spacing.sm,
    },
    errorText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.error,
        marginTop: spacing.xs,
    },
    requirements: {
        marginTop: spacing.md,
        gap: spacing.xs,
    },
    requirement: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    requirementText: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    requirementMet: {
        color: colors.crowd.low,
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: spacing.xl,
    },
    terms: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        textAlign: 'center',
        marginTop: spacing['2xl'],
        lineHeight: 18,
    },
    termsLink: {
        color: colors.primary,
        fontFamily: typography.fontFamily.medium,
    },
    loginSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.xl,
    },
    loginText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
    },
    loginLink: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
});
