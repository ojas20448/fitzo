
import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, KeyboardAvoidingView,
    Platform, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useAuth } from '../src/context/AuthContext';
import { useToast } from '../src/components/Toast';
import { colors, spacing, borderRadius, typography } from '../src/styles/theme';

type Step = 'email' | 'otp' | 'success';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { forgotPassword, resetPassword } = useAuth();
    const toast = useToast();

    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const codeRefs = useRef<(TextInput | null)[]>([]);

    // Step 1: Send the OTP email
    const handleSendCode = async () => {
        if (!email.trim()) {
            toast.error('Error', 'Please enter your email address');
            return;
        }
        setIsLoading(true);
        try {
            await forgotPassword(email.trim().toLowerCase());
            setStep('otp');
            toast.success('Code sent!', 'Check your email for the 6-digit code');
        } catch (error: any) {
            toast.error('Error', error.message || 'Failed to send reset code');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Verify OTP and reset password
    const handleResetPassword = async () => {
        const fullCode = code.join('');
        if (fullCode.length < 6) {
            toast.error('Error', 'Please enter the 6-digit code');
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            toast.error('Error', 'Password must be at least 6 characters');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('Error', 'Passwords do not match');
            return;
        }
        setIsLoading(true);
        try {
            await resetPassword(email.trim().toLowerCase(), fullCode, newPassword);
            setStep('success');
        } catch (error: any) {
            toast.error('Invalid Code', error.message || 'Code expired or incorrect. Request a new one.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle OTP digit input
    const handleCodeChange = (text: string, index: number) => {
        const newCode = [...code];
        newCode[index] = text.slice(-1);
        setCode(newCode);
        if (text && index < 5) {
            codeRefs.current[index + 1]?.focus();
        }
    };

    const handleCodeKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
            codeRefs.current[index - 1]?.focus();
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <LinearGradient
                colors={[colors.background, colors.surfaceLight]}
                style={StyleSheet.absoluteFill}
            />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.text.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ── Step 1: Email ── */}
                {step === 'email' && (
                    <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
                        <View style={styles.iconContainer}>
                            <MaterialIcons name="lock-reset" size={36} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>Forgot Password?</Text>
                        <Text style={styles.subtitle}>
                            Enter your email and we'll send you a 6-digit code to reset your password.
                        </Text>

                        <View style={styles.inputContainer}>
                            <MaterialIcons name="mail-outline" size={20} color={colors.text.muted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email Address"
                                placeholderTextColor={colors.text.muted}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                returnKeyType="done"
                                onSubmitEditing={handleSendCode}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                            onPress={handleSendCode}
                            disabled={isLoading}
                        >
                            {isLoading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.primaryButtonText}>Send Code</Text>
                            }
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* ── Step 2: OTP + New Password ── */}
                {step === 'otp' && (
                    <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.section}>
                        <View style={styles.iconContainer}>
                            <MaterialIcons name="mark-email-read" size={36} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>Enter Reset Code</Text>
                        <Text style={styles.subtitle}>
                            We sent a 6-digit code to{' '}
                            <Text style={{ color: colors.primary }}>{email}</Text>
                        </Text>

                        {/* OTP boxes */}
                        <View style={styles.otpRow}>
                            {code.map((digit, i) => (
                                <TextInput
                                    key={i}
                                    ref={el => { codeRefs.current[i] = el; }}
                                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                                    value={digit}
                                    onChangeText={t => handleCodeChange(t, i)}
                                    onKeyPress={e => handleCodeKeyPress(e, i)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    selectTextOnFocus
                                />
                            ))}
                        </View>

                        <Text style={styles.label}>New Password</Text>
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="lock-outline" size={20} color={colors.text.muted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Min. 6 characters"
                                placeholderTextColor={colors.text.muted}
                                value={newPassword}
                                onChangeText={setNewPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(v => !v)}>
                                <MaterialIcons
                                    name={showPassword ? 'visibility-off' : 'visibility'}
                                    size={20}
                                    color={colors.text.muted}
                                />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Confirm Password</Text>
                        <View style={styles.inputContainer}>
                            <MaterialIcons name="lock-outline" size={20} color={colors.text.muted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Re-enter password"
                                placeholderTextColor={colors.text.muted}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showPassword}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                            onPress={handleResetPassword}
                            disabled={isLoading}
                        >
                            {isLoading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.primaryButtonText}>Reset Password</Text>
                            }
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.resendButton} onPress={() => { setStep('email'); setCode(['', '', '', '', '', '']); }}>
                            <Text style={styles.resendText}>Didn't get the code? Send again</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* ── Step 3: Success ── */}
                {step === 'success' && (
                    <Animated.View entering={FadeInUp.springify()} style={[styles.section, styles.successSection]}>
                        <View style={styles.successIcon}>
                            <MaterialIcons name="check-circle" size={56} color="#4ade80" />
                        </View>
                        <Text style={styles.title}>All Done!</Text>
                        <Text style={styles.subtitle}>
                            Your password has been reset. You can now log in with your new password.
                        </Text>
                        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/login')}>
                            <Text style={styles.primaryButtonText}>Back to Login</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    backButton: {
        width: 40, height: 40,
        justifyContent: 'center', alignItems: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    content: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    section: { gap: 16 },
    successSection: { alignItems: 'center' },
    iconContainer: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: 'rgba(99,102,241,0.15)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 28, fontWeight: '800',
        color: colors.text.primary, letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15, color: colors.text.muted, lineHeight: 22,
    },
    label: {
        fontSize: 13, fontWeight: '600',
        color: colors.text.secondary, marginBottom: -8,
    },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 16, height: 54,
    },
    inputIcon: { marginRight: 10 },
    input: {
        flex: 1, color: colors.text.primary, fontSize: 16,
    },
    otpRow: {
        flexDirection: 'row', gap: 10, justifyContent: 'center', marginVertical: 8,
    },
    otpBox: {
        width: 48, height: 58, borderRadius: 12,
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        textAlign: 'center', fontSize: 24, fontWeight: '700',
        color: colors.text.primary,
    },
    otpBoxFilled: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(99,102,241,0.12)',
    },
    primaryButton: {
        height: 54, borderRadius: 14,
        backgroundColor: colors.primary,
        justifyContent: 'center', alignItems: 'center',
        marginTop: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35, shadowRadius: 10, elevation: 8,
    },
    buttonDisabled: { opacity: 0.6 },
    primaryButtonText: {
        color: '#fff', fontSize: 17, fontWeight: '700',
    },
    resendButton: { alignItems: 'center', paddingVertical: 8 },
    resendText: {
        color: colors.primary, fontSize: 14, fontWeight: '500',
    },
    successIcon: { marginBottom: 16 },
});
