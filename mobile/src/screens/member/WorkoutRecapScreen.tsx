import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, typography, spacing, borderRadius, shadows } from '../../styles/theme';
import WorkoutShareCard from '../../components/WorkoutShareCard';
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
    }, []);

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
                        <TouchableOpacity onPress={handleCapture} style={styles.captureBtn}>
                            <View style={styles.captureBtnInner} />
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
                <WorkoutShareCard
                    recap={{
                        duration: recap.duration || 0,
                        volume: recap.volume || 0,
                        sets: recap.sets || 0,
                        prs: recap.prs,
                        totalWorkouts: recap.totalWorkouts,
                        totalLifetimeVolume: recap.totalLifetimeVolume,
                        gymPercentile: recap.gymPercentile,
                    }}
                    user={{ name: user?.name || 'Athlete', streak }}
                    intent={session ? {
                        emphasis: session.emphasis,
                        session_label: session.name || session.day_name,
                    } : null}
                    progressPct={progressPct}
                    date={new Date()}
                    backgroundImage={photoUri}
                />
            </ViewShot>

            {/* ── Controls overlay at bottom ── */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.85)', '#000']}
                style={styles.controlsGradient}
                pointerEvents="box-none"
            >
                <SafeAreaView edges={['bottom']} style={styles.controls}>
                    {/* Add / Remove Photo */}
                    <View style={styles.photoRow}>
                        <TouchableOpacity style={styles.photoBtn} onPress={photoUri ? () => setPhotoUri(null) : handleOpenCamera}>
                            <MaterialIcons name={photoUri ? 'close' : 'camera-alt'} size={20} color="#fff" />
                            <Text style={styles.photoBtnText}>{photoUri ? 'REMOVE PHOTO' : 'ADD PHOTO'}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
                        {sharing ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <>
                                <MaterialIcons name="share" size={20} color="#fff" />
                                <Text style={styles.shareBtnText}>SHARE TO STORY</Text>
                            </>
                        )}
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
        color: '#FFFFFF',
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        letterSpacing: 1,
    },
    doneBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        borderRadius: borderRadius.full,
    },
    doneBtnText: {
        color: '#000000',
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
        color: '#FFFFFF',
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
    },
    captureBtn: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureBtnInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#FFFFFF',
    },
});
