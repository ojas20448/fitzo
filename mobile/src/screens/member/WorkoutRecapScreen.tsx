import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert, Image } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from '../../utils/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import ReceiptShareCard, { weightEquivalence } from '../../components/ReceiptShareCard';
import { memberAPI, workoutsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const { width, height } = Dimensions.get('window');

export default function WorkoutRecapScreen() {
    const params = useLocalSearchParams();
    const { user } = useAuth();

    const recap = params.recap ? JSON.parse(params.recap as string) : null;
    const session = params.session ? JSON.parse(params.session as string) : null;

    const [streak, setStreak] = useState(0);
    const [progressPct, setProgressPct] = useState<number | null>(null);
    const [sharing, setSharing] = useState(false);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<any>(null);

    const viewShotRef = useRef<View>(null);

    // Receipt placement: free drag + pinch to resize + two-finger rotate.
    //
    // This replaces a PanResponder/Animated.ValueXY setup that could only
    // translate. PanResponder cannot run alongside a pinch without fighting it
    // for the touch, so scaling was impossible; gesture-handler composes the
    // three gestures simultaneously and reanimated keeps them on the UI thread.
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedX = useSharedValue(0);
    const savedY = useSharedValue(0);
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const savedRotation = useSharedValue(0);

    const MIN_SCALE = 0.4;
    const MAX_SCALE = 2.5;

    const dragGesture = Gesture.Pan()
        .averageTouches(true)
        .onUpdate((e) => {
            translateX.value = savedX.value + e.translationX;
            translateY.value = savedY.value + e.translationY;
        })
        .onEnd(() => {
            savedX.value = translateX.value;
            savedY.value = translateY.value;
        });

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            const next = savedScale.value * e.scale;
            // Clamp on the UI thread so the card can never be scaled to nothing
            // or blown past the screen.
            scale.value = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
        })
        .onEnd(() => {
            savedScale.value = scale.value;
        });

    const rotateGesture = Gesture.Rotation()
        .onUpdate((e) => {
            rotation.value = savedRotation.value + e.rotation;
        })
        .onEnd(() => {
            savedRotation.value = rotation.value;
        });

    const composedGesture = Gesture.Simultaneous(dragGesture, pinchGesture, rotateGesture);

    const receiptAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
            { rotateZ: `${(rotation.value * 180) / Math.PI}deg` },
        ],
    }));

    const resetPlacement = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        rotation.value = withSpring(0);
        savedX.value = 0;
        savedY.value = 0;
        savedScale.value = 1;
        savedRotation.value = 0;
    };

    useEffect(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const init = async () => {
            try {
                const [homeData, historyData] = await Promise.all([
                    memberAPI.getHome().catch(() => null),
                    workoutsAPI.getHistory(5).catch(() => null),
                ]);

                if (homeData?.streak?.current) setStreak(homeData.streak.current);

                if (recap?.volume && historyData?.workouts?.length > 1) {
                    const prev = historyData.workouts[1];
                    if (prev?.total_volume && prev.total_volume > 0) {
                        setProgressPct(((recap.volume - prev.total_volume) / prev.total_volume) * 100);
                    }
                }
            } catch (error: any) {
                // silently handled
            }
        };
        init();

        // Auto-open camera for a post-workout selfie
        autoOpenCamera();
    }, []);

    const autoOpenCamera = async () => {
        // Small delay so the screen renders first
        await new Promise(r => setTimeout(r, 600));
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) return; // User declined — just show card without photo
        }
        setShowCamera(true);
    };

    const handleShare = async () => {
        if (sharing || !viewShotRef.current) return;
        setSharing(true);
        try {
            const uri = await captureRef(viewShotRef, {
                format: 'png',
                quality: 1,
                result: 'tmpfile',
            });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Share your workout',
                    UTI: 'public.png',
                });
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setSharing(false);
        }
    };

    const handleOpenCamera = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Camera Permission', 'Camera access is needed to take a photo for your story card.');
                return;
            }
        }
        setShowCamera(true);
    };

    const handleCapture = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
            setPhotoUri(photo.uri);
            setShowCamera(false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
            Alert.alert('Error', 'Failed to capture photo');
        }
    };

    if (showCamera) {
        return (
            <View style={styles.container}>
                <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cameraFacing} />
                <SafeAreaView style={styles.cameraOverlay} edges={['top', 'bottom']}>
                    <View style={styles.cameraTopRow}>
                        <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.cameraBtn}>
                            <MaterialIcons name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setCameraFacing(f => f === 'front' ? 'back' : 'front')}
                            style={styles.cameraBtn}
                        >
                            <MaterialIcons name="flip-camera-android" size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.cameraBottom}>
                        <Text style={styles.cameraHint}>Take a post-workout selfie</Text>
                        <TouchableOpacity onPress={handleCapture} style={styles.captureBtn}>
                            <View style={styles.captureBtnInner} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.skipBtn}>
                            <Text style={styles.skipBtnText}>Skip</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    if (!recap) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No workout data.</Text>
                <TouchableOpacity onPress={() => router.replace('/' as any)}>
                    <Text style={styles.emptyLink}>Go Home</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* ── Share card (full screen, captured by ViewShot) ── */}
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={styles.cardWrap}>
                {/* Background image or gradient */}
                {photoUri ? (
                    <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
                ) : (
                    <LinearGradient
                        colors={[colors.surfaceLighter, colors.backgroundAlt]}
                        style={StyleSheet.absoluteFill}
                    />
                )}

                {/* Receipt: drag to place, pinch to resize, twist to angle */}
                <GestureDetector gesture={composedGesture}>
                    <Reanimated.View style={[styles.draggableReceipt, receiptAnimatedStyle]}>
                    <ReceiptShareCard
                        transparentStage
                        title={
                            session?.name || session?.day_name
                                ? `${session.name || session.day_name} · Total weight moved`
                                : 'Total weight moved'
                        }
                        headlineValue={`${(recap.volume || 0).toLocaleString()} KG`}
                        headlineCaption={weightEquivalence(recap.volume || 0)}
                        rows={[
                            { label: 'Duration', value: `${recap.duration || 0} min` },
                            { label: 'Sets', value: `${recap.sets || 0}` },
                            ...(streak > 0 ? [{ label: 'Streak', value: `${streak} days` }] : []),
                        ]}
                        total={{ label: 'Total', value: `${(recap.volume || 0).toLocaleString()} kg` }}
                        prs={
                            recap.prs?.length
                                ? recap.prs.map((pr: any) => ({
                                      name: pr.exercise_name || pr.name || 'PR',
                                      current: pr.current || `${pr.weight_kg || ''} kg x ${pr.reps || ''}`,
                                      previous: pr.previous,
                                  }))
                                : undefined
                        }
                        date={new Date()}
                    />
                    </Reanimated.View>
                </GestureDetector>
            </ViewShot>

            {/* ── Controls overlay at bottom ── */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.85)', '#000']}
                style={styles.controlsGradient}
                pointerEvents="box-none"
            >
                <SafeAreaView edges={['bottom']} style={styles.controls}>
                    <View style={styles.hintRow}>
                        <Text style={styles.dragHint}>
                            💡 Drag to move · pinch to resize · twist to angle
                        </Text>
                        <TouchableOpacity
                            onPress={resetPlacement}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel="Reset receipt position and size"
                        >
                            <Text style={styles.resetHint}>RESET</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Add / Remove Photo */}
                    <View style={styles.photoRow}>
                        <TouchableOpacity style={styles.photoBtn} onPress={photoUri ? () => setPhotoUri(null) : handleOpenCamera}>
                            <MaterialIcons name={photoUri ? 'close' : 'camera-alt'} size={20} color="#fff" />
                            <Text style={styles.photoBtnText}>{photoUri ? 'REMOVE PHOTO' : 'ADD PHOTO / SELFIE'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/*
                     * Ruling R24 — secondary, visually subordinate control for the
                     * photo+receipt composite above (camera selfie, drag/pinch/rotate
                     * placement). It belongs to that UI, not to the primary share path
                     * below: the composer has no concept of a user photo (SharePayload
                     * carries none), so without this the composite would have no way
                     * to ever be shared. Wired to the pre-existing, untouched
                     * handleShare/sharing declared near the top of this component.
                     */}
                    <TouchableOpacity
                        style={styles.altShareBtn}
                        onPress={handleShare}
                        disabled={sharing}
                        accessibilityRole="button"
                        accessibilityLabel="Share this photo card"
                    >
                        {sharing ? (
                            <ActivityIndicator color="rgba(255,255,255,0.55)" size="small" />
                        ) : (
                            <Text style={styles.altShareBtnText}>SHARE PHOTO CARD</Text>
                        )}
                    </TouchableOpacity>

                    {/*
                     * Primary path: opens the themed composer (5 layouts,
                     * pick-your-lifts) rather than capturing this screen directly.
                     */}
                    <TouchableOpacity style={styles.shareBtn} onPress={() => router.push('/member/share' as any)}>
                        <MaterialIcons name="share" size={20} color="#fff" />
                        <Text style={styles.shareBtnText}>SHARE TO STORY</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.doneBtn}
                        onPress={() => router.replace('/' as any)}
                    >
                        <Text style={styles.doneBtnText}>DONE</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    cardWrap: {
        flex: 1,
    },
    draggableReceipt: {
        position: 'absolute',
        alignSelf: 'center',
        top: '18%',
    },
    hintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        marginBottom: 8,
    },
    dragHint: {
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 11,
        fontFamily: typography.fontFamily.medium,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    resetHint: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 11,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
    },
    emptyContainer: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
    },
    emptyText: {
        color: colors.text.muted,
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.medium,
    },
    emptyLink: {
        color: colors.primary,
        fontSize: typography.sizes.md,
        fontFamily: typography.fontFamily.bold,
    },

    // Controls
    controlsGradient: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 60,
    },
    controls: {
        paddingHorizontal: 24,
        paddingBottom: 8,
        gap: 12,
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 16,
        borderRadius: borderRadius.full,
    },
    shareBtnText: {
        color: colors.primary,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
    },
    altShareBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    altShareBtnText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
    },
    doneBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: borderRadius.full,
    },
    doneBtnText: {
        color: colors.background,
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
    },

    // Photo button
    photoRow: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    photoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    photoBtnText: {
        color: colors.primary,
        fontSize: 11,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
    },

    // Camera
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
    },
    cameraTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    cameraBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraBottom: {
        alignItems: 'center',
        paddingBottom: 32,
        gap: 16,
    },
    cameraHint: {
        color: colors.primary,
        fontSize: typography.sizes.base,
        fontFamily: typography.fontFamily.semiBold,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    skipBtn: {
        paddingHorizontal: 24,
        paddingVertical: 8,
    },
    skipBtnText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        letterSpacing: 0.5,
    },
    captureBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureBtnInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: colors.primary,
    },
});
