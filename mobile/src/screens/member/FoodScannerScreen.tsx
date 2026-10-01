import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, AppState } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import GlassCard from '../../components/GlassCard';
import Button from '../../components/Button';
import { foodPhotoAPI } from '../../services/api';
import AIConsentModal, { getAIConsent } from '../../components/AIConsentModal';
import { foodJobsEnabled, loadPendingScan, clearPendingScan, submitScan, scanStatus, PendingScan } from '../../services/foodJobs';

export default function FoodScannerScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [consentModalVisible, setConsentModalVisible] = useState(false);
    const [detectedFood, setDetectedFood] = useState<any>(null);
    const [base64Image, setBase64Image] = useState<string | null>(null);
    const cameraRef = useRef<any>(null);
    const [scanState, setScanState] = useState('');
    const running = useRef(false);
    const mounted = useRef(true);
    const acceptResult = (response: any) => {
        if (!response?.items?.length || !response.total) throw new Error('No food was detected. Try a clearer photo.');
        setDetectedFood({ name: response.items.map((i: any) => i.name).join(', '), ...response.total });
    };
    const recoverJob = async (pending: PendingScan) => {
        let delay = 1500;
        let misses = 0;
        while (mounted.current) {
            if (AppState.currentState === 'background') { await new Promise(r => setTimeout(r, 3000)); continue; }
            try {
                const job = await scanStatus(pending);
                if (!mounted.current) return;
                setScanState(job.status === 'queued' ? 'Queued — waiting for the worker' : 'Processing your photo');
                if (job.status === 'completed') { acceptResult(job.result); await clearPendingScan(); setScanState('Completed'); return; }
                if (['failed', 'expired'].includes(job.status)) {
                    await clearPendingScan();
                    const error: any = new Error('This scan could not finish. Please try again later.');
                    if (job.apiFallbackAvailable && ['QUOTA_EXHAUSTED', 'AUTH_REQUIRED', 'TIMEOUT', 'PROVIDER_ERROR', 'JOB_EXPIRED'].includes(job.errorCode)) error.code = 'WORKER_FALLBACK_AVAILABLE';
                    throw error;
                }
            } catch (error: any) {
                if (error.status === 404 && !pending.id && misses++ < 5) { /* The submit response may have been lost. */ }
                else {
                    if ([401, 403, 404].includes(error.status)) await clearPendingScan();
                    throw error;
                }
            }
            await new Promise(r => setTimeout(r, delay));
            delay = Math.min(delay * 1.5, 10000);
        }
    };
    useEffect(() => {
        mounted.current = true;
        const resume = async () => {
            if (!foodJobsEnabled || running.current) return;
            running.current = true;
            try {
                const pending = await loadPendingScan();
                if (pending) { setAnalyzing(true); await recoverJob(pending); }
            } catch (e: any) { if (mounted.current) { setScanState('Unavailable — reopen this screen to check the saved scan'); Alert.alert('Scan unavailable', e.message || 'Try again later.'); } }
            finally { running.current = false; if (mounted.current) setAnalyzing(false); }
        };
        resume();
        const subscription = AppState.addEventListener('change', state => { if (state === 'active') resume(); });
        return () => { mounted.current = false; subscription.remove(); };
    }, []);

    // Request camera permission if not granted
    if (!permission) {
        return <View style={styles.container}><ActivityIndicator /></View>;
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.permissionContainer}>
                    <MaterialIcons name="camera-alt" size={64} color={colors.text.muted} />
                    <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                    <Text style={styles.permissionText}>
                        We need access to your camera to scan food items
                    </Text>
                    <Button title="Continue" onPress={requestPermission} />
                </View>
            </SafeAreaView>
        );
    }

    // A phone camera shoots ~12MP. Base64 of that JPEG is 2-4MB, which is far
    // more than Gemini Vision needs and slow/flaky to upload on mobile data.
    //
    // 768 rather than 1024: measured against production, every food photo at or
    // below ~700px came back in 6-8s with full multi-item breakdowns (salmon,
    // tomatoes, slaw and glaze each itemised separately), so the larger edge was
    // buying upload time and model latency rather than recognition quality. A
    // smaller payload also shortens the window in which an upstream hiccup can
    // land on the request.
    const MAX_EDGE = 768;

    const takePicture = async () => {
        if (!cameraRef.current || running.current) return;

        try {
            // base64 is deliberately NOT requested here — we only need the file
            // URI, and asking for base64 of the full-size shot would allocate the
            // multi-MB string we are trying to avoid.
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
            setCapturedImage(photo.uri);

            const rendered = await ImageManipulator
                .manipulate(photo.uri)
                .resize({ width: MAX_EDGE })
                .renderAsync();

            const { base64 } = await rendered.saveAsync({
                format: SaveFormat.JPEG,
                compress: 0.7,
                base64: true,
            });

            if (base64) setBase64Image(base64);
        } catch (error: any) {
            Alert.alert('Error', 'Failed to capture photo');
        }
    };

    const executeAnalysis = async () => {
        if (!base64Image || running.current) return;

        running.current = true;
        setAnalyzing(true);
        try {
            if (foodJobsEnabled) {
                const pending = await loadPendingScan() || await submitScan(base64Image);
                await recoverJob(pending);
                return;
            }
            const response = await foodPhotoAPI.analyzePhoto(base64Image);

            if (response.success && response.items && response.items.length > 0) {
                const combinedName = response.items.map((i: any) => i.name).join(', ');
                setDetectedFood({
                    name: combinedName,
                    calories: response.total.calories,
                    protein_g: response.total.protein_g,
                    carbs_g: response.total.carbs_g,
                    fat_g: response.total.fat_g
                });
            } else {
                Alert.alert('Analysis Failed', 'Could not detect food in image');
            }
        } catch (error: any) {
            if (foodJobsEnabled && error.code === 'WORKER_FALLBACK_AVAILABLE') {
                try { acceptResult(await foodPhotoAPI.analyzePhoto(base64Image)); setScanState('Completed using API fallback'); }
                catch (e: any) { Alert.alert('Scan unavailable', e.message || 'Please try again later.'); }
                return;
            }
            if (foodJobsEnabled && mounted.current) setScanState((await loadPendingScan()) ? 'Unavailable — reopen this screen to recover your scan' : 'Unavailable — try again later');
            // NB: the axios interceptor in services/api.ts rejects a FLAT
            // { message, code, status } object — `error.response` is stripped.
            if (error?.status === 413 || error?.code === 'PAYLOAD_TOO_LARGE') {
                // Should be unreachable now that we downscale before upload, but
                // surface it plainly rather than as a generic failure if it ever
                // regresses.
                Alert.alert('Photo Too Large', 'That photo was too large to upload. Please try again.');
            } else {
                Alert.alert('Error', error.message || 'Failed to analyze food');
            }
        } finally {
            running.current = false;
            if (mounted.current) setAnalyzing(false);
        }
    };

    const analyzeFoodPhoto = async () => {
        if (!base64Image) return;

        const consented = await getAIConsent();
        if (!consented) {
            setConsentModalVisible(true);
            return;
        }

        executeAnalysis();
    };

    const logFood = async () => {
        if (!detectedFood) return;

        try {
            // Navigate to calorie log screen with pre-filled data
            router.push({
                pathname: '/log/calories',
                params: {
                    foodName: detectedFood.name,
                    calories: detectedFood.calories,
                    protein: detectedFood.protein_g,
                    carbs: detectedFood.carbs_g,
                    fat: detectedFood.fat_g,
                    source: 'camera_scan'
                }
            });
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        }
    };

    const retake = async () => {
        if (running.current) return;
        if (foodJobsEnabled) {
            const pending = await loadPendingScan();
            if (pending) {
                try {
                    const job = await scanStatus(pending);
                    if (['queued', 'running'].includes(job.status)) await foodPhotoAPI.cancelJob(job.id);
                    await clearPendingScan();
                } catch (error: any) {
                    if (error.status === 404) await clearPendingScan();
                    else { Alert.alert('Pending scan', 'Reconnect to cancel your saved scan before taking another photo.'); return; }
                }
            }
        }
        setCapturedImage(null);
        setBase64Image(null);
        setDetectedFood(null);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="close" size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Scan Food</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Camera or Preview */}
            <View style={styles.cameraContainer}>
                {!capturedImage ? (
                    <CameraView style={styles.camera} ref={cameraRef} facing="back">
                        <View style={styles.cameraOverlay}>
                            <View style={styles.scanFrame} />
                            <Text style={styles.scanHint}>
                                Center your food in the frame
                            </Text>
                        </View>
                    </CameraView>
                ) : (
                    <Image source={{ uri: capturedImage }} style={styles.preview} />
                )}
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {!capturedImage ? (
                    <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                        <View style={styles.captureButtonInner} />
                    </TouchableOpacity>
                ) : detectedFood ? (
                    <GlassCard style={styles.resultCard}>
                        <View style={styles.foodInfo}>
                            <MaterialIcons name="restaurant" size={32} color={colors.primary} />
                            <Text style={styles.foodName}>{detectedFood.name}</Text>
                        </View>

                        <View style={styles.macros}>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{detectedFood.calories}</Text>
                                <Text style={styles.macroLabel}>Calories</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{detectedFood.protein_g}g</Text>
                                <Text style={styles.macroLabel}>Protein</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{detectedFood.carbs_g}g</Text>
                                <Text style={styles.macroLabel}>Carbs</Text>
                            </View>
                            <View style={styles.macroItem}>
                                <Text style={styles.macroValue}>{detectedFood.fat_g}g</Text>
                                <Text style={styles.macroLabel}>Fat</Text>
                            </View>
                        </View>

                        <View style={styles.buttonRow}>
                            <Button
                                title="Retake"
                                onPress={retake}
                                variant="outline"
                                style={{ flex: 1 }}
                            />
                            <Button
                                title="Log Food"
                                onPress={logFood}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </GlassCard>
                ) : (
                    <View style={styles.analyzeContainer}>
                        {!!scanState && <Text accessibilityLiveRegion="polite" style={styles.aiBadgeText}>{scanState}</Text>}
                        <Button
                            title={analyzing ? "Analyzing..." : "Analyze Photo"}
                            onPress={analyzeFoodPhoto}
                            loading={analyzing}
                            fullWidth
                        />
                        <View style={styles.aiBadgeRow}>
                            <MaterialIcons name="auto-awesome" size={13} color={colors.text.muted} />
                            <Text style={styles.aiBadgeText}>
                                Nutrition estimates require your review. Photos are temporarily stored while processing.
                            </Text>
                        </View>
                        <TouchableOpacity onPress={retake} style={styles.retakeLink}>
                            <Text style={styles.retakeText}>Retake Photo</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <AIConsentModal
                visible={consentModalVisible}
                featureTitle="Photo Food Scanner"
                onAccept={() => {
                    setConsentModalVisible(false);
                    executeAnalysis();
                }}
                onDecline={() => setConsentModalVisible(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        padding: spacing.xs,
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    cameraContainer: {
        flex: 1,
        marginHorizontal: spacing.lg,
        borderRadius: borderRadius['2xl'],
        overflow: 'hidden',
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: 280,
        height: 280,
        borderWidth: 3,
        borderColor: colors.primary,
        borderRadius: borderRadius.xl,
        backgroundColor: 'transparent',
    },
    scanHint: {
        marginTop: spacing.xl,
        color: 'white',
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.lg,
    },
    preview: {
        flex: 1,
        resizeMode: 'cover',
    },
    controls: {
        padding: spacing.xl,
    },
    captureButton: {
        alignSelf: 'center',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButtonInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
    },
    analyzeContainer: {
        gap: spacing.md,
    },
    retakeLink: {
        alignSelf: 'center',
        padding: spacing.sm,
    },
    retakeText: {
        color: colors.text.muted,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
    },
    resultCard: {
        padding: spacing.xl,
        gap: spacing.lg,
    },
    foodInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    foodName: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
        flex: 1,
    },
    macros: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: spacing.md,
    },
    macroItem: {
        alignItems: 'center',
    },
    macroValue: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.bold,
        color: colors.primary,
    },
    macroLabel: {
        fontSize: typography.sizes.xs,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        marginTop: spacing.xs,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        gap: spacing.lg,
    },
    permissionTitle: {
        fontSize: typography.sizes.xl,
        fontFamily: typography.fontFamily.bold,
        color: colors.text.primary,
    },
    permissionText: {
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.secondary,
        textAlign: 'center',
    },
    aiBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    aiBadgeText: {
        fontSize: 11,
        fontFamily: typography.fontFamily.regular,
        color: colors.text.muted,
        textAlign: 'center',
    },
});
