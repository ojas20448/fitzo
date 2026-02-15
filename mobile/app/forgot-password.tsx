
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../src/context/AuthContext';
import { useToast } from '../src/components/Toast';
import { colors } from '../src/styles/theme';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { forgotPassword } = useAuth();
    const toast = useToast();

    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleReset = async () => {
        if (!email.trim()) {
            toast.error('Error', 'Please enter your email');
            return;
        }

        setIsLoading(true);
        try {
            await forgotPassword(email);
            setIsSuccess(true);
            toast.success('Success', 'Reset link sent to your email');
        } catch (error: any) {
            toast.error('Error', error.message || 'Failed to send reset link');
        } finally {
            setIsLoading(false);
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

            <View style={styles.content}>
                <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.titleContainer}>
                    <Text style={styles.title}>Forgot Password?</Text>
                    <Text style={styles.subtitle}>
                        {isSuccess
                            ? "Check your email for instructions to reset your password."
                            : "Enter your email address and we'll send you a link to reset your password."}
                    </Text>
                </Animated.View>

                {!isSuccess ? (
                    <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.form}>
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
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleReset}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitButtonText}>Send Reset Link</Text>
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    <Animated.View entering={FadeInUp.springify()} style={styles.successContainer}>
                        <View style={styles.successIcon}>
                            <MaterialIcons name="mark-email-read" size={40} color={colors.primary} />
                        </View>
                        <TouchableOpacity
                            style={styles.returnButton}
                            onPress={() => router.back()}
                        >
                            <Text style={styles.returnButtonText}>Back to Login</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    titleContainer: {
        marginBottom: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: colors.text.primary,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.muted,
        lineHeight: 24,
    },
    form: {
        gap: 20,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 16,
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: colors.text.primary,
        fontSize: 16,
    },
    submitButton: {
        backgroundColor: colors.primary,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 20,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    successContainer: {
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    successIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    returnButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
    },
    returnButtonText: {
        color: colors.text.primary,
        fontWeight: '600',
        fontSize: 16,
    },
});
