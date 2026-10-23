import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, typography, spacing, borderRadius } from '../styles/theme';

const workerMode = process.env.EXPO_PUBLIC_FOOD_JOB_MODE === 'true';
export const AI_CONSENT_KEY = workerMode ? '@fitzo_ai_data_consent_worker_v2' : '@fitzo_ai_data_consent';

export async function getAIConsent(): Promise<boolean> {
    try {
        const val = await AsyncStorage.getItem(AI_CONSENT_KEY);
        return val === 'true';
    } catch {
        return false;
    }
}

export async function setAIConsent(granted: boolean): Promise<void> {
    await AsyncStorage.setItem(AI_CONSENT_KEY, granted ? 'true' : 'false');
}

interface AIConsentModalProps {
    visible: boolean;
    onAccept: () => void;
    onDecline: () => void;
    onDismiss?: () => void;
}

export default function AIConsentModal({
    visible,
    onAccept,
    onDecline,
    onDismiss,
}: AIConsentModalProps) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const saveConsent = async (granted: boolean) => {
        if (saving) return;
        setSaving(true);
        setError('');
        try {
            await setAIConsent(granted);
            if (granted) onAccept();
            else onDecline();
        } catch {
            setError('Could not save your AI preference. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            presentationStyle="pageSheet"
            onRequestClose={() => saveConsent(false)}
            onDismiss={onDismiss}
        >
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <MaterialIcons name="auto-awesome" size={32} color={colors.primary} />
                        </View>
                        <Text style={styles.title}>Enable Fitzo AI</Text>
                        <Text style={styles.subtitle}>
                            One choice for coaching, insights, food scans and voice logging.
                        </Text>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="data-usage" size={20} color={colors.primary} />
                            <Text style={styles.cardTitle}>What you share</Text>
                        </View>
                        <Text style={styles.cardBody}>
                            {workerMode
                                ? 'For coaching and insights, Fitzo sends your questions and relevant profile, workout, food, recovery and connected-health data to Google through Antigravity, with the Gemini API as a possible fallback.'
                                : 'For coaching and insights, Fitzo sends your questions and relevant profile, workout, food, recovery and connected-health data to Google (Gemini).'}
                            {' '}For scans and voice logging, it also sends the photo or voice clip you choose. Voice transcription may use Groq.
                        </Text>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="lock" size={20} color={colors.primary} />
                            <Text style={styles.cardTitle}>How it's handled</Text>
                        </View>
                        <Text style={styles.cardBody}>
                            {workerMode
                                ? 'Connections are encrypted. Scans are temporarily queued and processed on a designated laptop. Google may retain Antigravity interactions; retention and training depend on the service and account settings.'
                                : "Connections are encrypted. Google's paid Gemini API terms exclude prompts and responses from model improvement. Providers may retain data for safety and legal purposes."}
                        </Text>
                    </View>

                    <Text style={styles.subtitle}>
                        Turn AI off anytime in Profile → Fitzo AI. Manual logging remains available.
                    </Text>
                    <TouchableOpacity
                        style={styles.policyRow}
                        accessibilityRole="link"
                        onPress={() => Linking.openURL('https://www.fitzoapp.in/privacy-policy')}
                        activeOpacity={0.7}
                    >
                        <MaterialIcons name="description" size={18} color={colors.primary} />
                        <Text style={styles.policyText}>Privacy policy</Text>
                        <MaterialIcons name="open-in-new" size={16} color={colors.text.muted} />
                    </TouchableOpacity>

                </ScrollView>
                    {/* Keep consent actions visible without scrolling through the policy. */}
                    <View style={styles.actions}>
                        {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
                        <TouchableOpacity
                            style={styles.acceptButton}
                            accessibilityRole="button"
                            disabled={saving}
                            onPress={() => saveConsent(true)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.acceptButtonText}>{saving ? 'Saving…' : 'Enable Fitzo AI'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.declineButton}
                            accessibilityRole="button"
                            disabled={saving}
                            onPress={() => saveConsent(false)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.declineButtonText}>Not now</Text>
                        </TouchableOpacity>
                    </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing['2xl'],
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
        marginTop: spacing.md,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    title: {
        fontSize: 22,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: 13,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: 19,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    cardTitle: {
        fontSize: 15,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    cardBody: {
        fontSize: 13,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        lineHeight: 19,
    },
    error: {
        color: colors.error,
        fontSize: 13,
        fontFamily: typography.fontFamily.regular,
        textAlign: 'center',
    },
    policyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    policyText: {
        fontSize: 13,
        fontFamily: typography.fontFamily.medium,
        color: colors.primary,
        textDecorationLine: 'underline',
    },
    actions: {
        gap: spacing.sm,
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
        backgroundColor: colors.background,
    },
    acceptButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptButtonText: {
        color: '#000000',
        fontSize: 15,
        fontFamily: typography.fontFamily.bold,
    },
    declineButton: {
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    declineButtonText: {
        color: colors.text.secondary,
        fontSize: 14,
        fontFamily: typography.fontFamily.medium,
    },
});
