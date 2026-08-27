import React, { useState, useEffect } from 'react';
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
import {
    GoogleSignin,
    isSuccessResponse,
    isErrorWithCode,
    statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';

// Configure Google Sign-In once
GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
});

export default function LoginScreen() {
    const { login, googleSignIn, appleSignIn } = useAuth();
    const toast = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [appleAvailable, setAppleAvailable] = useState(false);

    // Availability is asked at runtime rather than assumed from Platform.OS.
    // Sign in with Apple needs iOS 13+, so an older device reports false and
    // must not be shown a button that cannot open the authorisation sheet.
    useEffect(() => {
        if (Platform.OS !== 'ios') return;
        AppleAuthentication.isAvailableAsync()
            .then(setAppleAvailable)
            .catch(() => setAppleAvailable(false));
    }, []);

    const handleApplePress = async () => {
        setLoading(true);
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (!credential.identityToken) {
                toast.error('Apple Sign-In Failed', 'Could not get authentication token');
                return;
            }

            // credential.fullName is populated ONLY on the first authorisation
            // for this app; it is null on every subsequent sign-in. Forward it
            // regardless — the server decides whether it still needs it.
            await appleSignIn(credential.identityToken, credential.fullName);
            router.replace('/');
        } catch (error: any) {
            // Tapping Cancel on the Apple sheet throws with this code. It is a
            // deliberate user action, not a failure, so it must not raise an
            // error toast.
            if (error?.code === 'ERR_REQUEST_CANCELED') return;
            toast.error('Apple Sign-In Failed', error?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const handleGooglePress = async () => {
        setLoading(true);
        try {
            await GoogleSignin.hasPlayServices();
            const response = await GoogleSignin.signIn();
            if (isSuccessResponse(response)) {
                const idToken = response.data?.idToken;
                if (idToken) {
                    await googleSignIn(idToken);
                    router.replace('/');
                } else {
                    toast.error('Google Login Failed', 'Could not get authentication token');
                }
            }
        } catch (error: any) {
            if (isErrorWithCode(error)) {
                switch (error.code) {
                    case statusCodes.SIGN_IN_CANCELLED:
                        // User cancelled — do nothing
                        break;
                    case statusCodes.IN_PROGRESS:
                        toast.warning('Please wait', 'Sign-in already in progress');
                        break;
                    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
                        toast.error('Google Login Failed', 'Google Play Services not available');
                        break;
                    default:
                        toast.error('Google Login Failed', error.message || 'Something went wrong');
                }
            } else {
                toast.error('Google Login Failed', error.message || 'Something went wrong');
            }
        } finally {
            setLoading(false);
        }
    };



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

                        <View style={styles.socialRow}>
                            <TouchableOpacity
                                style={styles.googleBtn}
                                onPress={handleGooglePress}
                                disabled={loading}
                            >
                                <MaterialIcons name="g-translate" size={24} color={colors.text.primary} />
                                <Text style={styles.googleBtnText}>Google</Text>
                                <View style={{ width: 24 }} />
                            </TouchableOpacity>

                            {/*
                              * iOS only. Guideline 4.8 requires Sign in with Apple
                              * wherever a third-party sign-in is offered, but only on
                              * Apple platforms — rendering it on Android would show a
                              * button that cannot work, since the native
                              * authorisation sheet does not exist there.
                              */}
                            {appleAvailable && (
                                <TouchableOpacity
                                    style={styles.appleBtn}
                                    onPress={handleApplePress}
                                    disabled={loading}
                                    accessibilityRole="button"
                                    accessibilityLabel="Sign in with Apple"
                                >
                                    <MaterialIcons name="apple" size={24} color={colors.text.dark} />
                                    <Text style={styles.appleBtnText}>Apple</Text>
                                    <View style={{ width: 24 }} />
                                </TouchableOpacity>
                            )}
                        </View>

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
    // Both buttons flex equally so neither reads as the preferred option.
    // Apple requires its button be no less prominent than the alternatives.
    socialRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    googleBtn: {
        flex: 1,
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
    // White-on-black is one of the three treatments Apple's Human Interface
    // Guidelines permit; arbitrary brand colours are not allowed.
    appleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.text.primary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        gap: spacing.md,
    },
    appleBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.text.dark,
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
