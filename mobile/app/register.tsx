import React, { useCallback, useRef, useState } from 'react';
import { BackHandler, Image, Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import Button from '../src/components/Button';
import ScreenBackdrop from '../src/components/ScreenBackdrop';
import { colors, typography } from '../src/styles/theme';

export default function RegisterScreen() {
    const { register } = useAuth();
    const [step, setStep] = useState(1);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [gymCode, setGymCode] = useState('');
    const [showGymCode, setShowGymCode] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitError, setSubmitError] = useState('');
    const [focused, setFocused] = useState<string | null>(null);
    const submitting = useRef(false);
    const scroll = useRef<ScrollView>(null);
    const emailInput = useRef<TextInput>(null);
    const confirmInput = useRef<TextInput>(null);

    const goBack = useCallback(() => {
        if (submitting.current) return;
        Keyboard.dismiss(); setErrors({}); setSubmitError('');
        if (step === 2) { setStep(1); scroll.current?.scrollTo({ y: 0, animated: false }); }
        else if (router.canGoBack()) router.back();
        else router.replace('/login');
    }, [step]);
    useFocusEffect(useCallback(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
        return () => subscription.remove();
    }, [goBack]));

    const clearError = (key: string) => {
        setErrors(previous => ({ ...previous, [key]: '' })); setSubmitError('');
    };
    const validateIdentity = () => {
        const next: Record<string, string> = {};
        if (name.trim().length < 2) next.name = 'Enter your name (at least 2 characters).';
        else if (name.trim().length > 100) next.name = 'Use 100 characters or fewer for your name.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.';
        setErrors(next);
        return !Object.keys(next).length;
    };
    const handleNext = () => {
        if (submitting.current || !validateIdentity()) return;
        Keyboard.dismiss(); setSubmitError(''); setStep(2);
        scroll.current?.scrollTo({ y: 0, animated: false });
    };
    const handleRegister = async () => {
        if (submitting.current) return;
        if (!validateIdentity()) { setStep(1); return; }
        const next: Record<string, string> = {};
        if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            next.password = 'Use 8 or more characters with uppercase, lowercase and a number.';
        }
        if (!confirmPassword) next.confirmPassword = 'Enter your password again.';
        else if (confirmPassword !== password) next.confirmPassword = 'The passwords don’t match. Try again.';
        setErrors(next);
        if (Object.keys(next).length) return;
        Keyboard.dismiss(); submitting.current = true; setLoading(true); setSubmitError('');
        try {
            await register(email.trim().toLowerCase(), password, name.trim(), gymCode.trim());
            router.replace('/');
        } catch (error: unknown) {
            setSubmitError(error instanceof Error ? error.message : 'Couldn’t create your account. Please try again.');
            submitting.current = false; setLoading(false);
        }
    };
    const focusProps = (key: string) => ({ onFocus: () => setFocused(key), onBlur: () => setFocused(null), editable: !loading });
    const fieldStyle = (key: string) => [s.inputRow, focused === key && s.inputFocused, !!errors[key] && s.inputError];
    const errorText = (key: string) => errors[key] ? <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{errors[key]}</Text> : null;
    const requirements = [
        { text: '8+ characters', met: password.length >= 8 },
        { text: 'Uppercase', met: /[A-Z]/.test(password) },
        { text: 'Lowercase', met: /[a-z]/.test(password) },
        { text: 'A number', met: /\d/.test(password) },
    ];

    return <SafeAreaView style={s.screen}>
        <ScreenBackdrop />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.flex}>
            <View style={s.header}>
                <TouchableOpacity onPress={goBack} disabled={loading} style={s.iconButton} accessibilityRole="button" accessibilityLabel={step === 2 ? 'Edit account details' : 'Back to login'} accessibilityState={{ disabled: loading }}>
                    <Ionicons name="arrow-back-outline" size={23} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={s.stepCount}>Step {step} of 2 · {step === 1 ? 'Your details' : 'Password'}</Text>
                <View style={s.headerSpacer} />
            </View>
            <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
                <View style={s.brand}>
                    <Image source={require('../assets/icon.png')} style={s.logo} resizeMode="contain" />
                    <Text style={s.wordmark}>FITZO</Text>
                </View>
                <View style={s.progress} accessibilityRole="progressbar" accessibilityLabel="Create account" accessibilityValue={{ min: 1, max: 2, now: step }}>
                    {[1, 2].map(part => <View key={part} style={[s.progressPart, part <= step && s.progressActive]} />)}
                </View>
                <Text style={s.title} accessibilityRole="header">{step === 1 ? 'Make room for progress.' : 'Secure your account.'}</Text>
                <Text style={s.subtitle}>{step === 1 ? 'Create your account, then build a routine that fits your week.' : 'One last step. Then we’ll set up your training.'}</Text>
                {step === 1 ? <>
                    <View style={s.field}>
                        <Text style={s.label}>Your name</Text>
                        <View style={fieldStyle('name')}>
                            <Ionicons name="person-outline" size={20} color={colors.text.muted} />
                            <TextInput style={s.input} value={name} onChangeText={text => { setName(text); clearError('name'); }} placeholder="What should we call you?" placeholderTextColor={colors.text.muted}
                                autoCapitalize="words" autoCorrect={false} autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => emailInput.current?.focus()} accessibilityLabel="Full name input" maxLength={100} {...focusProps('name')} />
                        </View>{errorText('name')}
                    </View>
                    <View style={s.field}>
                        <Text style={s.label}>Email address</Text>
                        <View style={fieldStyle('email')}>
                            <Ionicons name="mail-outline" size={20} color={colors.text.muted} />
                            <TextInput ref={emailInput} style={s.input} value={email} onChangeText={text => { setEmail(text); clearError('email'); }} placeholder="you@example.com" placeholderTextColor={colors.text.muted}
                                autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={handleNext} accessibilityLabel="Email input" {...focusProps('email')} />
                        </View>{errorText('email')}
                    </View>
                    <View style={s.optional}>
                        <TouchableOpacity onPress={() => setShowGymCode(!showGymCode)} style={s.optionalToggle} accessibilityRole="button" accessibilityLabel="Add a gym code (optional)" accessibilityState={{ expanded: showGymCode }} aria-expanded={showGymCode}>
                            <Ionicons name="business-outline" size={19} color={colors.text.secondary} />
                            <Text style={s.optionalTitle}>{gymCode.trim() ? 'Gym code added' : 'Have a gym code?'} <Text style={s.muted}>Optional</Text></Text>
                            <Ionicons name={showGymCode ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={colors.text.secondary} />
                        </TouchableOpacity>
                        {showGymCode && <View style={s.optionalBody}>
                            <Text style={s.helper}>Enter the code from your gym. You can also join later from the Gym tab.</Text>
                            <View style={fieldStyle('gymCode')}><TextInput style={s.input} value={gymCode} onChangeText={text => { setGymCode(text); setSubmitError(''); }} placeholder="Gym code" placeholderTextColor={colors.text.muted} autoCapitalize="characters" autoCorrect={false} returnKeyType="next" onSubmitEditing={handleNext} accessibilityLabel="Gym code input" {...focusProps('gymCode')} /></View>
                        </View>}
                    </View>
                    <Button title="Continue" onPress={handleNext} fullWidth style={s.primary} />
                    <Text style={s.helperNote}>Your photo and profile can wait until you’re in.</Text>
                </> : <>
                    <View style={s.identity}>
                        <View style={s.grow}><Text style={s.identityName}>{name.trim()}</Text><Text style={s.helper} numberOfLines={2}>{email.trim().toLowerCase()}</Text>{!!gymCode.trim() && <Text style={s.helper}>Gym code: {gymCode.trim()}</Text>}</View>
                        <TouchableOpacity disabled={loading} style={s.editButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Edit name, email or gym code"><Text style={s.link}>Edit</Text></TouchableOpacity>
                    </View>
                    <View style={s.field}>
                        <Text style={s.label}>Password</Text>
                        <View style={fieldStyle('password')}>
                            <Ionicons name="lock-closed-outline" size={20} color={colors.text.muted} />
                            <TextInput style={s.input} value={password} onChangeText={text => { setPassword(text); clearError('password'); if (errors.confirmPassword) clearError('confirmPassword'); }} placeholder="Create a password" placeholderTextColor={colors.text.muted}
                                autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" secureTextEntry={!showPassword} returnKeyType="next" onSubmitEditing={() => confirmInput.current?.focus()} accessibilityLabel="Password input" {...focusProps('password')} />
                            <TouchableOpacity disabled={loading} style={s.visibility} onPress={() => setShowPassword(!showPassword)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide passwords' : 'Show passwords'}>
                                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>{errorText('password')}
                        <View style={s.requirements}>{requirements.map(item => <View key={item.text} style={s.requirement} accessibilityLabel={`${item.text}: ${item.met ? 'met' : 'needed'}`} accessible>
                            <Ionicons name={item.met ? 'checkmark-circle-outline' : 'ellipse-outline'} size={15} color={item.met ? colors.text.primary : colors.text.muted} />
                            <Text style={[s.requirementText, item.met && s.requirementMet]}>{item.text}</Text>
                        </View>)}</View>
                    </View>
                    <View style={s.field}>
                        <Text style={s.label}>Confirm password</Text>
                        <View style={fieldStyle('confirmPassword')}>
                            <Ionicons name="lock-closed-outline" size={20} color={colors.text.muted} />
                            <TextInput ref={confirmInput} style={s.input} value={confirmPassword} onChangeText={text => { setConfirmPassword(text); clearError('confirmPassword'); }} placeholder="Enter it again" placeholderTextColor={colors.text.muted}
                                autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" secureTextEntry={!showPassword} returnKeyType="done" onSubmitEditing={() => { void handleRegister(); }} accessibilityLabel="Confirm password input" {...focusProps('confirmPassword')} />
                            {!!confirmPassword && password === confirmPassword && <Ionicons name="checkmark-outline" size={21} color={colors.text.primary} accessibilityLabel="Passwords match" />}
                        </View>{errorText('confirmPassword')}
                    </View>
                    {!!submitError && <View style={s.errorNotice}><Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{submitError}</Text>
                        {!!gymCode.trim() && <TouchableOpacity disabled={loading} onPress={goBack} style={s.editButton} accessibilityRole="button"><Text style={s.link}>Check your details or gym code</Text></TouchableOpacity>}
                    </View>}
                    <Button title="Create account" onPress={() => { void handleRegister(); }} loading={loading} fullWidth style={s.primary} />
                    <Text style={s.terms}>By creating an account, you agree to our Terms of Service and Privacy Policy.</Text>
                    <TouchableOpacity disabled={loading} style={s.privacy} onPress={() => { void Linking.openURL('https://www.fitzoapp.in/privacy-policy'); }} accessibilityRole="link"><Text style={s.helper}>Read our privacy policy</Text></TouchableOpacity>
                </>}
                <View style={s.loginRow}><Text style={s.helper}>Already have an account?</Text><TouchableOpacity disabled={loading} onPress={() => router.replace('/login')} style={s.editButton} accessibilityRole="button"><Text style={s.link}>Log in</Text></TouchableOpacity></View>
            </ScrollView>
        </KeyboardAvoidingView>
    </SafeAreaView>;
}

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, grow: { flex: 1, minWidth: 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 456, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 4 },
    iconButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, headerSpacer: { width: 44 },
    stepCount: { flex: 1, minWidth: 0, textAlign: 'center', fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 18, color: colors.text.secondary },
    content: { flexGrow: 1, width: '100%', maxWidth: 456, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 }, logo: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.glass.border },
    wordmark: { fontFamily: typography.fontFamily.medium, fontSize: 20, letterSpacing: 4, color: colors.text.primary },
    progress: { flexDirection: 'row', gap: 6, marginBottom: 24 }, progressPart: { height: 3, flex: 1, borderRadius: 2, backgroundColor: '#252525' }, progressActive: { backgroundColor: colors.primary },
    title: { fontFamily: typography.fontFamily.semiBold, fontSize: 30, lineHeight: 39, letterSpacing: -0.8, color: colors.text.primary },
    subtitle: { fontFamily: typography.fontFamily.regular, fontSize: 14, lineHeight: 22, color: colors.text.secondary, marginTop: 10, marginBottom: 28 },
    field: { marginBottom: 20 }, label: { fontFamily: typography.fontFamily.medium, fontSize: 13, lineHeight: 20, color: colors.text.secondary, marginBottom: 8 },
    inputRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 12, minHeight: 56, borderWidth: 1, borderColor: colors.glass.borderLight, borderRadius: 16, backgroundColor: colors.surfaceLight },
    inputFocused: { borderColor: colors.text.secondary, backgroundColor: colors.surfaceLighter }, inputError: { borderColor: colors.error },
    input: { flex: 1, minWidth: 0, minHeight: 54, paddingVertical: 14, color: colors.text.primary, fontFamily: typography.fontFamily.regular, fontSize: 15, ...Platform.select({ web: { outlineWidth: 0 } }) },
    visibility: { minWidth: 44, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
    optional: { borderWidth: 1, borderColor: colors.glass.border, borderRadius: 16, marginBottom: 8 }, optionalToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, padding: 14 },
    optionalTitle: { flex: 1, fontFamily: typography.fontFamily.medium, fontSize: 13, lineHeight: 21, color: colors.text.primary }, muted: { color: colors.text.muted, fontFamily: typography.fontFamily.regular, fontSize: 11 },
    optionalBody: { padding: 14, paddingTop: 0, gap: 14 }, helper: { color: colors.text.secondary, fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 20 },
    helperNote: { color: colors.text.muted, fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 20, textAlign: 'center', marginTop: 14 },
    primary: { marginTop: 12, minHeight: 56, borderRadius: 16, boxShadow: 'none' },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.glass.border, borderRadius: 16, marginBottom: 24 },
    identityName: { fontFamily: typography.fontFamily.medium, fontSize: 14, lineHeight: 22, color: colors.text.primary }, editButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    link: { fontFamily: typography.fontFamily.medium, fontSize: 13, lineHeight: 21, color: colors.text.primary }, requirements: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    requirement: { flexDirection: 'row', alignItems: 'center', gap: 5 }, requirementText: { fontFamily: typography.fontFamily.regular, color: colors.text.muted, fontSize: 11, lineHeight: 18 }, requirementMet: { color: colors.text.primary },
    error: { color: '#FCA5A5', fontFamily: typography.fontFamily.regular, fontSize: 12, lineHeight: 20, marginTop: 6 }, errorNotice: { padding: 14, borderWidth: 1, borderColor: '#573030', borderRadius: 14, marginBottom: 12 },
    terms: { fontFamily: typography.fontFamily.regular, fontSize: 11, lineHeight: 19, color: colors.text.muted, marginTop: 20, textAlign: 'center' }, privacy: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    loginRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 22 },
});
