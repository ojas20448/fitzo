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
    Image,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import Button from '../src/components/Button';
import GlassCard from '../src/components/GlassCard';
import { useToast } from '../src/components/Toast';
import { colors, typography, spacing, borderRadius, shadows } from '../src/styles/theme';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();


export default function LoginScreen() {
    const { login, googleSignIn } = useAuth();
    const toast = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Google Auth — hardcode Expo auth proxy URL (Google blocks custom schemes)
    const redirectUri = 'https://auth.expo.io/@fiskerr/fitzo';
    const [request, response, promptAsync] = Google.useAuthRequest({
        clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
        scopes: ['openid', 'profile', 'email'],
        redirectUri,
    });

    // Debug: log the redirect URI being used
    React.useEffect(() => {
        if (request) {
            console.log('🔑 Google OAuth redirect URI:', request.redirectUri);
        }
    }, [request]);

    React.useEffect(() => {
        if (response?.type === 'success') {
            // Try multiple ways to get the id_token
            const idToken = response.params?.id_token
                || response.authentication?.idToken;

            if (idToken) {
                handleGoogleLogin(idToken);
            } else if (response.params?.access_token || response.authentication?.accessToken) {
                // Fallback: use access_token if id_token not available
                const accessToken = response.params?.access_token || response.authentication?.accessToken;
                handleGoogleLogin(accessToken!);
            } else {
                toast.error('Google Login Failed', 'Could not get authentication token');
            }
        } else if (response?.type === 'error') {
            console.error('Google Auth Error:', response.error);
            toast.error('Google Login Failed', response.error?.message || 'Authentication was cancelled or failed');
        }
    }, [response]);

    const handleGoogleLogin = async (token: string) => {
        setLoading(true);
        try {
            await googleSignIn(token);
            router.replace('/');
        } catch (error: any) {
            toast.error('Google Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    }



    const handleLogin = async () => {
        if (!email || !password) {
            toast.warning('Missing Fields', 'Please enter your email and password');
            return;
        }

        setLoading(true);
        try {
            await login(email, password);
            Keyboard.dismiss();
            router.replace('/');
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
                            <Image
                                source={require('../assets/icon.png')}
                                style={styles.logoImage}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.brandName}>FITZO</Text>
                        <Text style={styles.tagline}>Your Gym Companion</Text>
                    </View>

                    {/* Login Form */}
                    <GlassCard style={styles.formSection}>
                        <Text style={styles.formLabel}>WELCOME BACK</Text>

                        <GlassCard variant="light" style={styles.inputContainer}>
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
                        </GlassCard>

                        <GlassCard variant="light" style={styles.inputContainer}>
                            <MaterialIcons name="lock" size={20} color={colors.text.muted} />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor={colors.text.muted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                                <MaterialIcons
                                    name={showPassword ? 'visibility' : 'visibility-off'}
                                    size={20}
                                    color={colors.text.muted}
                                />
                            </TouchableOpacity>
                        </GlassCard>

                        <Button
                            title="Log In"
                            onPress={handleLogin}
                            loading={loading}
                            fullWidth
                            style={{ marginTop: spacing.lg }}
                        />

                        <TouchableOpacity
                            style={styles.forgotPassword}
                            onPress={() => router.push('/forgot-password')}
                        >
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>

                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.googleBtn}
                            onPress={() => promptAsync()}
                            disabled={!request || loading}
                        >
                            <MaterialIcons name="g-translate" size={24} color={colors.text.primary} />
                            <Text style={styles.googleBtnText}>Google</Text>
                        </TouchableOpacity>

                    </GlassCard>

                    {/* Sign Up Link */}
                    <View style={styles.signupSection}>
                        <Text style={styles.signupText}>Don't have an account?</Text>
                        <TouchableOpacity onPress={() => router.push('/register' as any)}>
                            <Text style={styles.signupLink}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>


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
        width: 80,
        height: 80,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: spacing.xl,
        ...shadows.glow,
    },
    logoImage: {
        width: '100%',
        height: '100%',
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
        padding: spacing.xl,
        // Removed explicit borders/bg as GlassCard handles it
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
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
        height: 52,
        // Removed explicit borders/bg
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
        fontSize: 16,
        fontWeight: 'bold',
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
