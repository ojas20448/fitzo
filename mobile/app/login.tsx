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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import Button from '../src/components/Button';
import { useToast } from '../src/components/Toast';
import { colors, typography, spacing, borderRadius, shadows } from '../src/styles/theme';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const { login, googleSignIn } = useAuth();
    const toast = useToast();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // For Expo Go, use the auth.expo.io proxy
    // For web development, Google blocks localhost - test on mobile instead
    // For web, we need to explicitly use the current window location
    const redirectUri = Platform.OS === 'web'
        ? (typeof window !== 'undefined' ? window.location.origin : undefined)
        : makeRedirectUri({
            scheme: 'fitzo',
            path: 'login'
        });

    console.log('Redirect URI:', redirectUri);

    {/* Google Auth Disabled for Testing
    // const [request, response, promptAsync] = Google.useAuthRequest({
    //    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    //    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    //    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    //    redirectUri,
    // });
    */}

    {/* 
    React.useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            handleGoogleSignIn(id_token);
        } else if (response?.type === 'error') {
            toast.error('Sign In Failed', 'Google Sign-In encountered an error');
        }
    }, [response]);
    */}

    const handleGoogleSignIn = async (token: string) => {
        // Disabled
    };

    const handleLogin = async () => {
        if (!email || !password) {
            toast.warning('Missing Fields', 'Please enter your email and password');
            return;
        }

        setLoading(true);
        try {
            const user = await login(email, password);

            if (user?.role === 'manager') {
                router.replace('/manager-dashboard');
            } else if (user?.role === 'trainer') {
                router.replace('/trainer-home');
            } else {
                router.replace('/(tabs)');
            }
        } catch (error: any) {
            toast.error('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo/Brand */}
                    <View style={styles.brandSection}>
                        <View style={styles.logoContainer}>
                            <MaterialIcons name="fitness-center" size={40} color={colors.background} />
                        </View>
                        <Text style={styles.brandName}>FITZO</Text>
                        <Text style={styles.tagline}>Your Gym Companion</Text>
                    </View>

                    {/* Login Form */}
                    <View style={styles.formSection}>
                        <Text style={styles.formLabel}>WELCOME BACK</Text>

                        <View style={styles.inputContainer}>
                            <MaterialIcons name="email" size={20} color={colors.text.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                placeholderTextColor={colors.text.muted}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <MaterialIcons name="lock" size={20} color={colors.text.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={colors.text.muted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <MaterialIcons
                                    name={showPassword ? 'visibility' : 'visibility-off'}
                                    size={20}
                                    color={colors.text.muted}
                                />
                            </TouchableOpacity>
                        </View>

                        <Button
                            title="Log In"
                            onPress={handleLogin}
                            loading={loading}
                            fullWidth
                            style={{ marginTop: spacing.lg }}
                        />

                        {/* Social Login 
                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.googleBtn}
                            onPress={() => {
                                // promptAsync();
                            }}
                            disabled={true}
                        >
                            <Text style={styles.googleBtnText}>G</Text>
                            <Text style={styles.googleBtnLabel}>Sign in with Google</Text>
                        </TouchableOpacity>
                        */}

                        <TouchableOpacity style={styles.forgotPassword}>
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Sign Up Link */}
                    <View style={styles.signupSection}>
                        <Text style={styles.signupText}>Don't have an account?</Text>
                        <TouchableOpacity onPress={() => router.push('/register' as any)}>
                            <Text style={styles.signupLink}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Skip Login for Testing */}
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={() => router.replace('/(tabs)')}
                    >
                        <Text style={styles.skipText}>Skip Login (Testing)</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: spacing.xl,
    },
    brandSection: {
        alignItems: 'center',
        marginBottom: spacing['3xl'],
    },
    logoContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        ...shadows.glow,
    },
    brandName: {
        fontSize: 40,
        fontFamily: typography.fontFamily.light,
        color: colors.text.primary,
        letterSpacing: 8,
    },
    tagline: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.sm,
        letterSpacing: 1,
    },
    formSection: {
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    formLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.subtle,
        textAlign: 'center',
        marginBottom: spacing.xl,
        letterSpacing: 3,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.xl,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
        height: 52,
    },
    input: {
        flex: 1,
        marginLeft: spacing.md,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    forgotPassword: {
        alignItems: 'center',
        marginTop: spacing.lg,
    },
    forgotPasswordText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 0.5,
    },
    signupSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing['2xl'],
        gap: spacing.sm,
    },
    signupText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        letterSpacing: 0.3,
    },
    signupLink: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.primary,
        letterSpacing: 0.5,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.xl,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.glass.border,
    },
    dividerText: {
        color: colors.text.muted,
        fontSize: 10,
        fontFamily: typography.fontFamily.bold,
        marginHorizontal: spacing.lg,
        letterSpacing: 1,
    },
    googleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glass.surfaceLight,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.border,
        gap: spacing.md,
    },
    googleBtnText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text.primary, // Or Google colors
    },
    googleBtnLabel: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    skipButton: {
        marginTop: spacing.xl,
        padding: spacing.md,
        alignItems: 'center',
    },
    skipText: {
        color: colors.text.muted,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
    },
});
