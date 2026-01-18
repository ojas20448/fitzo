import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { checkinAPI } from '../../services/api';
import Button from '../../components/Button';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';

const QRCheckinScreen: React.FC = () => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [streak, setStreak] = useState<number | null>(null);
    const [torch, setTorch] = useState(false);

    // Animation
    const translateY = useSharedValue(0);

    useEffect(() => {
        translateY.value = withRepeat(
            withTiming(FRAME_SIZE, { duration: 1500, easing: Easing.linear }),
            -1,
            false // no reverse, just restart
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }]
    }));

    // ... handleBarCodeScanned ... (keep existing)

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned || processing) return;

        setScanned(true);
        setProcessing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Decode QR - expecting gym_id directly or JSON with gym_id
            let gymId = data;
            try {
                const parsed = JSON.parse(data);
                gymId = parsed.gym_id || data;
            } catch {
                // Data is not JSON, use as-is (might be UUID directly)
            }

            const response = await checkinAPI.checkin(gymId);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSuccess(true);
            setStreak(response.streak);

            // Return to home after delay
            setTimeout(() => {
                router.back();
            }, 2500);
        } catch (error: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
                'Check-in Failed',
                error.message || 'Something went wrong. Please try again.',
                [
                    { text: 'OK', onPress: () => setScanned(false) }
                ]
            );
            setProcessing(false);
        }
    };

    // ... permissions checks ... (keep existing)

    if (!permission) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <Text style={styles.message}>Loading camera...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.container}>
                <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
                    <MaterialIcons name="close" size={20} color={colors.text.muted} />
                </TouchableOpacity>
                <View style={styles.centered}>
                    <View style={styles.permissionIcon}>
                        <MaterialIcons name="camera-alt" size={48} color={colors.text.muted} />
                    </View>
                    <Text style={styles.permissionTitle}>Camera Access</Text>
                    <Text style={styles.permissionMessage}>
                        We need camera access to scan the gym's QR code for check-in.
                    </Text>
                    <Button
                        title="Enable Camera"
                        onPress={requestPermission}
                        style={{ marginTop: spacing['2xl'] }}
                    />
                </View>
            </SafeAreaView>
        );
    }

    // Success state
    if (success) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.successContainer}>
                    <View style={styles.successIcon}>
                        <MaterialIcons name="check" size={56} color={colors.background} />
                    </View>
                    <Text style={styles.successTitle}>Checked In</Text>
                    <Text style={styles.successMessage}>Let's get to work.</Text>

                    {streak !== null && (
                        <View style={styles.streakCard}>
                            <View style={styles.streakHeader}>
                                <Text style={styles.streakEmoji}>🔥</Text>
                                <Text style={styles.streakLabel}>STREAK</Text>
                            </View>
                            <Text style={styles.streakNumber}>{streak}</Text>
                            <Text style={styles.streakUnit}>days</Text>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
                <MaterialIcons name="close" size={20} color={colors.text.muted} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>SCAN</Text>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerSubtitle}>CHECK IN</Text>
                </View>

                <TouchableOpacity
                    style={[styles.torchButton, torch && styles.torchButtonActive]}
                    onPress={() => setTorch(!torch)}
                >
                    <MaterialIcons
                        name={torch ? "flash-on" : "flash-off"}
                        size={20}
                        color={torch ? colors.background : colors.text.primary}
                    />
                </TouchableOpacity>
            </View>

            {/* Camera View */}
            <View style={styles.cameraContainer}>
                <CameraView
                    style={styles.camera}
                    enableTorch={torch}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                >
                    {/* QR Frame Overlay */}
                    <View style={styles.overlay}>
                        <View style={styles.overlayTop} />
                        <View style={styles.overlayMiddle}>
                            <View style={styles.overlaySide} />
                            <View style={styles.qrFrame}>
                                {/* Corner markers */}
                                <View style={[styles.corner, styles.cornerTL]} />
                                <View style={[styles.corner, styles.cornerTR]} />
                                <View style={[styles.corner, styles.cornerBL]} />
                                <View style={[styles.corner, styles.cornerBR]} />

                                {/* Animated Scan Line */}
                                <Animated.View style={[styles.scanLine, animatedStyle]} />
                            </View>
                            <View style={styles.overlaySide} />
                        </View>
                        <View style={styles.overlayBottom} />
                    </View>
                </CameraView>
            </View>

            {/* Instructions */}
            <View style={styles.footer}>
                <View style={styles.instruction}>
                    <MaterialIcons name="info-outline" size={20} color={colors.text.secondary} />
                    <Text style={styles.instructionText}>
                        Find the QR code at the gym's front desk
                    </Text>
                </View>
            </View>

            {processing && (
                <View style={styles.processingOverlay}>
                    <Text style={styles.processingText}>Checking in...</Text>
                </View>
            )}
        </SafeAreaView>
    );
};

const FRAME_SIZE = 280;
const CORNER_SIZE = 40;

const styles = StyleSheet.create({
    // ... (keep existing styles)
    // Add scanLine style
    scanLine: {
        width: '100%',
        height: 2,
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 5,
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    message: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
        marginTop: spacing.md,
    },
    // ...

    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing['2xl'],
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    torchButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    torchButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing['3xl'],
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.xl,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    headerTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.primary,
        letterSpacing: 2,
    },
    headerDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.text.subtle,
    },
    headerSubtitle: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    permissionIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.glass.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    permissionTitle: {
        fontSize: typography.sizes['2xl'],
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 0.5,
    },
    permissionMessage: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        textAlign: 'center',
        marginTop: spacing.md,
        lineHeight: 24,
        maxWidth: 280,
    },
    cameraContainer: {
        flex: 1,
        marginHorizontal: spacing.xl,
        borderRadius: borderRadius['2xl'],
        overflow: 'hidden',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    overlayMiddle: {
        flexDirection: 'row',
        height: FRAME_SIZE,
    },
    overlaySide: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    overlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    qrFrame: {
        width: FRAME_SIZE,
        height: FRAME_SIZE,
    },
    corner: {
        position: 'absolute',
        width: CORNER_SIZE,
        height: CORNER_SIZE,
        borderColor: colors.primary,
    },
    cornerTL: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 8,
    },
    cornerTR: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 8,
    },
    cornerBL: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 8,
    },
    cornerBR: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 8,
    },
    footer: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    instruction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.glass.surface,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    instructionText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.secondary,
    },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingText: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing['2xl'],
    },
    successIcon: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        ...shadows.glow,
    },
    successTitle: {
        fontSize: 48,
        fontFamily: typography.fontFamily.light,
        color: colors.text.primary,
        letterSpacing: -1,
    },
    successMessage: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        marginTop: spacing.sm,
        letterSpacing: 0.5,
    },
    streakCard: {
        backgroundColor: colors.glass.surface,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing['3xl'],
        borderRadius: borderRadius['2xl'],
        marginTop: spacing['2xl'],
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    streakHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    streakEmoji: {
        fontSize: 20,
    },
    streakLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        letterSpacing: 2,
    },
    streakNumber: {
        fontSize: 64,
        fontFamily: typography.fontFamily.light,
        color: colors.text.primary,
        letterSpacing: -2,
    },
    streakUnit: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.subtle,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});

export default QRCheckinScreen;
