import React, { useState, useEffect, useRef } from 'react';
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
import ScreenBackdrop from '../src/components/ScreenBackdrop';
import { router } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import Button from '../src/components/Button';
import { useToast } from '../src/components/Toast';
import { colors, typography, spacing, borderRadius, shadow } from '../src/styles/theme';
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
    const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
    const passwordInput = useRef<TextInput>(null);

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
            <ScreenBackdrop />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
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
                    </View>

                    <View style={styles.welcome}>
                        <Text accessibilityRole="header" style={styles.heading}>Welcome back</Text>
                        <Text style={styles.description}>Log in to continue your training.</Text>
                    </View>

                    {/* Login Form */}
                    <View style={styles.formSection}>
                        <Text style={styles.fieldLabel}>Email address</Text>
                        <View style={[styles.inputContainer, focusedField === 'email' && styles.inputFocused]}>
                            <Ionicons name="mail-outline" size={20} color={colors.text.secondary} />
                            <TextInput
                                style={styles.input}
                                accessibilityLabel="Email address"
                                placeholder="you@example.com"
                                placeholderTextColor={colors.text.muted}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="email"
                                textContentType="emailAddress"
                                returnKeyType="next"
                                onSubmitEditing={() => passwordInput.current?.focus()}
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                                editable={!loading}
                            />
                        </View>

                        <View style={styles.passwordLabelRow}>
                            <Text style={styles.passwordLabel}>Password</Text>
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Forgot password" style={styles.forgotPassword} onPress={() => router.push('/forgot-password')}>
                                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={[styles.inputContainer, focusedField === 'password' && styles.inputFocused]}>
                            <Ionicons name="lock-closed-outline" size={20} color={colors.text.secondary} />
                            <TextInput
                                ref={passwordInput}
                                style={styles.input}
                                accessibilityLabel="Password"
                                placeholder="Enter your password"
                                placeholderTextColor={colors.text.muted}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoComplete="current-password"
                                textContentType="password"
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="go"
                                onSubmitEditing={() => { if (!loading) void handleLogin(); }}
                                onFocus={() => setFocusedField('password')}
                                onBlur={() => setFocusedField(null)}
                                editable={!loading}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.visibilityButton}
                                accessibilityRole="button"
                                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                                accessibilityState={{ selected: showPassword }}
                                aria-pressed={showPassword}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
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
                            style={styles.loginButton}
                        />

                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>or</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <View style={styles.socialRow}>
                            <TouchableOpacity
                                style={styles.googleBtn}
                                onPress={handleGooglePress}
                                disabled={loading}
                                accessibilityRole="button"
                                accessibilityLabel="Continue with Google"
                            >
                                <FontAwesome name="google" size={19} color={colors.text.primary} />
                                <Text style={styles.googleBtnText}>Continue with Google</Text>
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
                                    <Ionicons name="logo-apple" size={22} color={colors.text.primary} />
                                    <Text style={styles.appleBtnText}>Continue with Apple</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                    </View>

                    {/* Sign Up Link */}
                    <View style={styles.signupSection}>
                        <Text style={styles.signupText}>New to Fitzo?</Text>
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Create account" style={styles.signupButton} onPress={() => router.push('/register' as any)}>
                            <Text style={styles.signupLink}>Create account</Text>
                            <Ionicons name="arrow-forward-outline" size={16} color={colors.text.primary} />
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
        alignSelf: 'center',
        width: '100%',
        maxWidth: 456,
        paddingHorizontal: spacing['2xl'],
        paddingVertical: spacing['3xl'],
    },
    brandSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing['4xl'],
    },
    logoContainer: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    brandName: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
        letterSpacing: 4,
    },
    welcome: { gap: spacing.sm, marginBottom: spacing['3xl'] },
    heading: { fontFamily: typography.fontFamily.semiBold, fontSize: 32, lineHeight: 42, letterSpacing: -0.8, color: colors.text.primary },
    description: { fontFamily: typography.fontFamily.regular, fontSize: typography.sizes.md, lineHeight: 22, color: colors.text.secondary },
    formSection: {
        width: '100%',
    },
    fieldLabel: { fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.sm, color: colors.text.secondary, marginBottom: spacing.md },
    passwordLabelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
    passwordLabel: { fontFamily: typography.fontFamily.medium, fontSize: typography.sizes.sm, color: colors.text.secondary },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: spacing.lg,
        paddingRight: spacing.sm,
        minHeight: 56,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
    },
    inputFocused: { borderColor: colors.text.secondary, backgroundColor: colors.surfaceLighter },
    visibilityButton: { minWidth: 44, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
    loginButton: { marginTop: spacing['2xl'], minHeight: 56, borderRadius: borderRadius.lg, ...shadow({ blur: 0, color: '#000000', opacity: 0 }) },
    input: {
        flex: 1,
        minWidth: 0,
        marginLeft: spacing.md,
        minHeight: 54,
        paddingVertical: spacing.md,
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
    },
    forgotPassword: {
        minHeight: 44,
        justifyContent: 'center',
    },
    forgotPasswordText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    signupSection: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    signupText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
    },
    signupLink: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.primary,
    },
    signupButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.xs },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing['2xl'],
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.glass.border,
    },
    dividerText: {
        color: colors.text.muted,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.regular,
        marginHorizontal: spacing.lg,
    },
    // Provider actions share the same dimensions and visual prominence.
    socialRow: {
        gap: spacing.md,
    },
    googleBtn: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        gap: spacing.md,
    },
    // White-on-black is one of the three treatments Apple's Human Interface
    // Guidelines permit; arbitrary brand colours are not allowed.
    appleBtn: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.glass.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glass.borderLight,
        gap: spacing.md,
    },
    appleBtnText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    googleBtnText: {
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
});
