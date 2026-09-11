import React from 'react';
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

export const AI_CONSENT_KEY = '@fitzo_ai_data_consent';

export async function getAIConsent(): Promise<boolean> {
    try {
        const val = await AsyncStorage.getItem(AI_CONSENT_KEY);
        return val === 'true';
    } catch {
        return false;
    }
}

export async function setAIConsent(granted: boolean): Promise<void> {
    try {
        await AsyncStorage.setItem(AI_CONSENT_KEY, granted ? 'true' : 'false');
    } catch {
        // ignore
    }
}

interface AIConsentModalProps {
    visible: boolean;
    onAccept: () => void;
    onDecline: () => void;
    featureTitle?: string;
}

export default function AIConsentModal({
    visible,
    onAccept,
    onDecline,
    featureTitle,
}: AIConsentModalProps) {
    const handleAccept = async () => {
        await setAIConsent(true);
        onAccept();
    };

    const handleDecline = async () => {
        await setAIConsent(false);
        onDecline();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            presentationStyle="pageSheet"
            onRequestClose={handleDecline}
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
                        <Text style={styles.title}>
                            {featureTitle ? `${featureTitle} & Privacy` : 'AI Features & Data Privacy'}
                        </Text>
                        <Text style={styles.subtitle}>
                            In accordance with Apple App Store Review Guidelines 5.1.1(i) and 5.1.2(i), please review how your personal data is handled before using AI features in Fitzo.
                        </Text>
                    </View>

                    {/* Section 1: Data Sent */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="data-usage" size={20} color={colors.primary} />
                            <Text style={styles.cardTitle}>What Data Will Be Sent</Text>
                        </View>
                        <Text style={styles.cardBody}>
                            Depending on the AI feature you use, Fitzo sends only the relevant fitness context required to generate an answer:
                        </Text>
                        <View style={styles.bulletList}>
                            <Text style={styles.bulletItem}>• <Text style={styles.bold}>AI Coach & Insights:</Text> Your logged workout volume, exercise sets, nutrition targets, and recovery summaries.</Text>
                            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Photo Food Scanner:</Text> The captured meal photo for real-time nutritional estimation (analyzed and immediately discarded; never stored).</Text>
                            <Text style={styles.bulletItem}>• <Text style={styles.bold}>Voice Logging:</Text> The short voice clip for speech-to-text transcription and meal/workout extraction (analyzed and immediately discarded; never stored).</Text>
                        </View>
                        <View style={styles.protectedBox}>
                            <MaterialIcons name="shield" size={16} color={colors.success} />
                            <Text style={styles.protectedText}>
                                Personal identifiers (name, email address, password, and payment info) are NEVER sent to the AI service.
                            </Text>
                        </View>
                    </View>

                    {/* Section 2: Who the data is sent to */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="cloud" size={20} color={colors.primary} />
                            <Text style={styles.cardTitle}>Who Data Is Sent To</Text>
                        </View>
                        <Text style={styles.cardBody}>
                            All AI requests are processed by <Text style={styles.bold}>Google Cloud (Google Gemini AI API)</Text> as our secure enterprise third-party AI provider.
                        </Text>
                    </View>

                    {/* Section 3: Data Protection & Equal Safeguards */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <MaterialIcons name="lock" size={20} color={colors.primary} />
                            <Text style={styles.cardTitle}>Data Protection & Safeguards</Text>
                        </View>
                        <Text style={styles.cardBody}>
                            Under Google Cloud enterprise terms, all transmitted data is encrypted in transit (TLS 1.3) and at rest (AES-256). We confirm that Google Cloud provides equal data protection as stated in our Privacy Policy and does NOT use your personal or fitness data to train AI models.
                        </Text>
                    </View>

                    {/* Section 4: Privacy Policy Link */}
                    <TouchableOpacity
                        style={styles.policyRow}
                        onPress={() => Linking.openURL('https://www.fitzoapp.in/privacy-policy')}
                        activeOpacity={0.7}
                    >
                        <MaterialIcons name="description" size={18} color={colors.primary} />
                        <Text style={styles.policyText}>Read Fitzo's Full Privacy Policy</Text>
                        <MaterialIcons name="open-in-new" size={16} color={colors.text.muted} />
                    </TouchableOpacity>

                    {/* Action Buttons */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={handleAccept}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.acceptButtonText}>Agree & Continue</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.declineButton}
                            onPress={handleDecline}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.declineButtonText}>Not Now (Keep AI Disabled)</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
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
    bulletList: {
        marginTop: spacing.sm,
        gap: 6,
    },
    bulletItem: {
        fontSize: 12,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        lineHeight: 18,
    },
    bold: {
        color: colors.text.primary,
        fontFamily: typography.fontFamily.bold,
    },
    protectedBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(34, 197, 94, 0.08)',
        borderRadius: borderRadius.sm,
        padding: spacing.sm,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.2)',
    },
    protectedText: {
        flex: 1,
        fontSize: 11,
        fontFamily: typography.fontFamily.medium,
        color: colors.success,
        lineHeight: 16,
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
        marginTop: spacing.xs,
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
