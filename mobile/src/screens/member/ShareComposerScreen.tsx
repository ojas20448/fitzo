import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, PixelRatio, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import ViewShot from 'react-native-view-shot';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS } from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, typography, spacing, borderRadius } from '../../styles/theme';
import { useShareComposerStore } from '../../stores/shareComposerStore';
import { pickMoment, TOTAL_ID, EX_PREFIX, PR_PREFIX, MUSCLES_ID } from '../../utils/shareMoment';
import type { ThemeId } from '../../utils/shareMoment';
import { THEMES, THEME_ORDER } from '../../components/share/themes';
import { buildSharePayload, deriveMuscleVolume } from '../../utils/buildSharePayload';
import { hasMuscleVolume } from '../../components/share/format';
import { CARD_W, CARD_H } from '../../components/share/SharePayload';
import type { SharePayload, ShareBackground } from '../../components/share/SharePayload';
import { useShareCapture } from '../../hooks/useShareCapture';
import { createBackground, clampBackgroundScale, pixelDeltaToFraction } from '../../utils/backgroundTransform';
import * as Haptics from '../../utils/haptics';
import { logger } from '../../utils/logger';
import { getCaptureFrame } from '../../utils/shareCapture';

interface Chip {
    id: string;
    label: string;
    isPr: boolean;
}

export default function ShareComposerScreen() {
    const source = useShareComposerStore((s) => s.source);
    const isStale = useShareComposerStore((s) => s.isStale);
    const isSession = source?.kind === 'session';
    const session = source && source.kind === 'session' ? source.session : null;

    const [selection, setSelection] = useState<string[]>([]);
    const [theme, setTheme] = useState<ThemeId | null>(null);
    const [previewBounds, setPreviewBounds] = useState({ width: 0, height: 0 });
    const heroWidth = Math.min(previewBounds.width, previewBounds.height * CARD_W / CARD_H);
    const [showHighlights, setShowHighlights] = useState(false);
    const [selectionHint, setSelectionHint] = useState<string | null>(null);

    const cardRef = useRef<View>(null);
    const { captureAndShare, isSharing, shareError } = useShareCapture();
    const [background, setBackground] = useState<ShareBackground | null>(null);
    const [loadedAssets, setLoadedAssets] = useState({ key: '', background: false, artwork: false });
    const [imageError, setImageError] = useState<{ key: string; message: string } | null>(null);
    const [captureGeneration, setCaptureGeneration] = useState(0);
    const [captureSnapshot, setCaptureSnapshot] = useState<SharePayload | null>(null);
    const editingLocked = useRef(false);
    const activeCaptureKey = useRef('');
    const [showCamera, setShowCamera] = useState(false);
    const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<any>(null);
    const bgTranslateX = useSharedValue(0);
    const bgTranslateY = useSharedValue(0);
    const bgSavedX = useSharedValue(0);
    const bgSavedY = useSharedValue(0);
    const bgScale = useSharedValue(1);
    const bgSavedScale = useSharedValue(1);
    const bgRotation = useSharedValue(0);
    const bgSavedRotation = useSharedValue(0);
    useEffect(() => {
        if (!source || isStale()) {
            router.back();
            return;
        }
        if (source.kind === 'session') {
            const m = pickMoment(source.session);
            setSelection(m.selection);
            setTheme(m.theme);
        } else {
            setTheme('receipt');
        }
    }, [source, isStale]);
    const muscleVolume = useMemo(
        () => deriveMuscleVolume(session?.exercises ?? []),
        [session],
    );
    const showMusclesChip = hasMuscleVolume(muscleVolume);
    const chips: Chip[] = useMemo(() => {
        if (!session) return [];
        const list: Chip[] = [{ id: TOTAL_ID, label: 'Total', isPr: false }];
        for (const pr of session.prs) {
            list.push({ id: `${PR_PREFIX}${pr.exercise}`, label: pr.exercise, isPr: true });
        }
        for (const ex of session.exercises) {
            list.push({ id: `${EX_PREFIX}${ex.id}`, label: ex.name, isPr: false });
        }
        if (showMusclesChip) {
            list.push({ id: MUSCLES_ID, label: 'Muscles', isPr: false });
        }
        return list;
    }, [session, showMusclesChip]);
    const payload: SharePayload | null = useMemo(() => {
        if (!source || !theme) return null;
        let base: SharePayload;
        if (source.kind === 'static') {
            base = source.payload;
        } else {
            if (!session || selection.length === 0) return null;
            const built = buildSharePayload(session, selection);
            base = selection.includes(MUSCLES_ID) ? { ...built, muscleVolume } : built;
        }
        return { ...base, background };
    }, [source, session, theme, selection, muscleVolume, background]);

    const artworkKey = theme === 'receipt' ? (payload?.prs.length ? 'trophy' : JSON.stringify(payload?.exercises[0] ?? 'default')) : '';
    const captureKey = JSON.stringify([theme, background?.uri, artworkKey, captureGeneration]);
    activeCaptureKey.current = captureKey;
    const needsPhoto = !!background && !!theme && !!THEMES[theme].supportsBackground;
    const needsArt = theme === 'receipt';
    const waitingForImages = (needsPhoto || needsArt) && (loadedAssets.key !== captureKey
        || (needsPhoto && !loadedAssets.background) || (needsArt && !loadedAssets.artwork));
    const currentImageError = imageError?.key === captureKey ? imageError.message : null;
    // Convert design pixels to native layout units to avoid oversized exports.
    const captureFrame = getCaptureFrame(Platform.OS === 'web' ? 1 : PixelRatio.get());
    useEffect(() => {
        if (!waitingForImages || showCamera || currentImageError) return;
        const timeout = setTimeout(() => setImageError({ key: captureKey, message: 'The image is taking too long to load. Retry, or remove the photo.' }), 30000);
        return () => clearTimeout(timeout);
    }, [captureKey, waitingForImages, showCamera, currentImageError]);

    // Only load events from the current export tree can enable Share.
    const markAssetLoaded = (asset: 'background' | 'artwork') => {
        if (activeCaptureKey.current !== captureKey) return;
        setLoadedAssets(previous => ({
            ...(previous.key === captureKey ? previous : { key: captureKey, background: false, artwork: false }),
            [asset]: true,
        }));
    };
    const markAssetError = () => {
        if (activeCaptureKey.current === captureKey) setImageError({ key: captureKey, message: 'Could not load an image. Retry, or remove the photo.' });
    };

    if (!source || !theme || !payload) {
        return <View style={styles.container} />;
    }

    const ActiveTheme = THEMES[theme].Component;
    const heroScale = heroWidth > 0 ? heroWidth / CARD_W : 0;
    const heroHeight = heroWidth * (CARD_H / CARD_W);
    const themeSupportsBackground = !!THEMES[theme].supportsBackground;
    const backgroundGateActive = waitingForImages || !!currentImageError;
    const handleCapturePhoto = async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
            bgTranslateX.value = 0;
            bgTranslateY.value = 0;
            bgSavedX.value = 0;
            bgSavedY.value = 0;
            bgScale.value = 1;
            bgSavedScale.value = 1;
            bgRotation.value = 0;
            bgSavedRotation.value = 0;
            setBackground(createBackground(photo.uri));
            setCaptureGeneration(value => value + 1);
            setShowCamera(false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (err) {
            logger.error('[ShareComposerScreen] photo capture failed', err);
            Alert.alert('Error', 'Failed to capture photo');
        }
    };

    const handleOpenCamera = async () => {
        if (editingLocked.current) return;
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Camera Permission', 'Camera access is needed to add a photo background.');
                return;
            }
        }
        setCaptureGeneration(value => value + 1);
        setShowCamera(true);
    };

    const handleRemoveBackground = () => {
        if (editingLocked.current) return;
        setBackground(null);
    };
    const handleBackgroundLoad = () => markAssetLoaded('background');
    // Normalize preview gestures so the separate export tree matches the photo.
    const commitBackground = (translateX: number, translateY: number, scale: number, rotation: number) => {
        if (editingLocked.current) return;
        setBackground((prev) =>
            prev
                ? {
                      ...prev,
                      offsetX: pixelDeltaToFraction(translateX, heroWidth),
                      offsetY: pixelDeltaToFraction(translateY, heroHeight),
                      scale,
                      rotation,
                  }
                : prev,
        );
    };
    if (showCamera) {
        return (
            <View style={styles.container}>
                <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={cameraFacing} />
                <SafeAreaView style={styles.cameraOverlay} edges={['top', 'bottom']}>
                    <View style={styles.cameraTopRow}>
                        <TouchableOpacity
                            onPress={() => setShowCamera(false)}
                            style={styles.cameraBtn}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Close camera"
                        >
                            <MaterialIcons name="close" size={26} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setCameraFacing((f) => (f === 'front' ? 'back' : 'front'))}
                            style={styles.cameraBtn}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Flip camera"
                        >
                            <MaterialIcons name="flip-camera-android" size={26} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.cameraBottom}>
                        <Text style={styles.cameraHint}>Frame the background for your card</Text>
                        <TouchableOpacity
                            onPress={handleCapturePhoto}
                            style={styles.captureBtn}
                            accessibilityRole="button"
                            accessibilityLabel="Take photo"
                        >
                            <View style={styles.captureBtnInner} />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }
    const dragGesture = Gesture.Pan()
        .averageTouches(true)
        .onUpdate((e) => {
            bgTranslateX.value = bgSavedX.value + e.translationX;
            bgTranslateY.value = bgSavedY.value + e.translationY;
            runOnJS(commitBackground)(bgTranslateX.value, bgTranslateY.value, bgScale.value, bgRotation.value);
        })
        .onEnd(() => {
            bgSavedX.value = bgTranslateX.value;
            bgSavedY.value = bgTranslateY.value;
        });

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            bgScale.value = clampBackgroundScale(bgSavedScale.value * e.scale);
            runOnJS(commitBackground)(bgTranslateX.value, bgTranslateY.value, bgScale.value, bgRotation.value);
        })
        .onEnd(() => {
            bgSavedScale.value = bgScale.value;
        });

    const rotateGesture = Gesture.Rotation()
        .onUpdate((e) => {
            bgRotation.value = bgSavedRotation.value + e.rotation;
            runOnJS(commitBackground)(bgTranslateX.value, bgTranslateY.value, bgScale.value, bgRotation.value);
        })
        .onEnd(() => {
            bgSavedRotation.value = bgRotation.value;
        });

    const backgroundGesture = Gesture.Simultaneous(dragGesture, pinchGesture, rotateGesture);
    const gestureActive = !!background && themeSupportsBackground && !isSharing;
    const shareText = [payload.subtitle, payload.contextLabel, [payload.headlineLabel, payload.headline].filter(Boolean).join(': '),
        ...payload.rows.map(row => row.label + ': ' + row.value),
        ...payload.prs.map(pr => pr.exercise + ': ' + pr.current + (pr.previous ? ' (previous ' + pr.previous + ')' : '')),
        ...payload.exercises.map(ex => ex.name + ': ' + ex.setCount + ' sets'),
    ].filter(Boolean).join('\n');
    const heroCard = (
        <View style={[styles.heroOuter, { width: heroWidth, height: heroHeight }]} accessible accessibilityRole="image" accessibilityLabel={shareText}>
            <View style={[styles.heroInner, { transform: [{ scale: heroScale }] }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
                <ActiveTheme payload={payload} />
            </View>
        </View>
    );
    const onSelectTheme = (id: ThemeId) => {
        if (editingLocked.current) return;
        Haptics.selectionAsync();
        if (isSession && THEMES[id].singleSelectOnly && selection.filter(item => item !== MUSCLES_ID).length > 1) {
            setSelectionHint('Scoreboard uses one highlight. Edit Highlights or choose another style.');
            return;
        }
        setSelectionHint(null);
        if (id === 'anatomy' && showMusclesChip && !selection.includes(MUSCLES_ID)) setSelection([...selection, MUSCLES_ID]);
        setTheme(id);
    };

    const onToggleChip = (id: string) => {
        if (editingLocked.current) return;
        setSelectionHint(null);
        const base = id === TOTAL_ID ? selection.filter(item => !item.startsWith(EX_PREFIX))
            : id.startsWith(EX_PREFIX) ? selection.filter(item => item !== TOTAL_ID) : selection;
        const next = base.includes(id) ? base.filter((s) => s !== id) : [...base, id];
        if (next.length === 0) return; // never an empty selection
        if (id === MUSCLES_ID && next.includes(MUSCLES_ID)) setTheme('anatomy');
        else if (next.filter(item => item !== MUSCLES_ID).length > 1 && THEMES[theme].singleSelectOnly) setTheme('spec');
        Haptics.selectionAsync();
        setSelection(next);
    };

    const handleShare = async () => {
        if (editingLocked.current || isSharing || backgroundGateActive) return;
        editingLocked.current = true;
        setCaptureSnapshot(payload);
        try {
            await captureAndShare(cardRef, { dialogTitle: 'Share your workout', fallbackMessage: shareText + '\nFITZO' });
        } finally {
            editingLocked.current = false;
            setCaptureSnapshot(null);
        }
    };

    return (
        <View style={styles.container}>

            {/* Keep the export tree painted behind the opaque screen; opacity: 0 can produce blank Android captures. */}
            <View style={styles.captureHost} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
                <ViewShot ref={cardRef} style={{ width: captureFrame.width, height: captureFrame.height, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>

                    <View key={captureKey} style={{ width: CARD_W, height: CARD_H, flexShrink: 0, transform: [{ scale: captureFrame.scale }] }}>
                        <ActiveTheme payload={captureSnapshot ?? payload} onBackgroundLoad={handleBackgroundLoad} onBackgroundError={markAssetError}
                            onArtworkLoad={() => markAssetLoaded('artwork')} onArtworkError={markAssetError} />
                    </View>
                </ViewShot>
            </View>

            <SafeAreaView style={styles.screenBody} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} disabled={isSharing} style={styles.headerBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close share composer">
                        <MaterialIcons name="close" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Share workout</Text>
                    <View style={styles.headerBtn} />
                </View>

                <View style={styles.compactContent}>
                    <View style={styles.previewSpace} onLayout={event => {
                        const { width, height } = event.nativeEvent.layout;
                        setPreviewBounds({ width, height });
                    }}>
                        {heroScale > 0 && (gestureActive ? <GestureDetector gesture={backgroundGesture}>{heroCard}</GestureDetector> : heroCard)}
                    </View>
                    <View style={styles.compactThemes} accessibilityRole="radiogroup" accessibilityLabel="Card style">
                        {THEME_ORDER.map(id => {
                            const active = theme === id;
                            return <TouchableOpacity key={id} onPress={() => onSelectTheme(id)} disabled={isSharing}
                                style={[styles.compactTheme, active && styles.themePillActive]}
                                accessibilityRole="radio" accessibilityState={{ checked: active, disabled: isSharing }} aria-checked={active}>
                                <Text style={[styles.compactThemeText, active && styles.themePillTextActive]}>{THEMES[id].label}</Text>
                            </TouchableOpacity>;
                        })}
                    </View>
                    <View style={styles.compactActions}>
                        {isSession && <TouchableOpacity style={styles.photoBtn} onPress={() => setShowHighlights(true)} disabled={isSharing}
                            accessibilityRole="button" accessibilityLabel="Choose highlights">
                            <MaterialIcons name="tune" size={18} color={colors.primary} />
                            <Text style={styles.photoBtnText}>Highlights</Text>
                            <Text style={styles.selectionCount}>{selection.length}</Text>
                        </TouchableOpacity>}
                        {(themeSupportsBackground || !!background) && <TouchableOpacity style={styles.photoBtn} onPress={background ? handleRemoveBackground : handleOpenCamera} disabled={isSharing}
                            accessibilityRole="button" accessibilityLabel={background ? 'Remove background photo' : 'Add background photo'}>
                            <MaterialIcons name={background ? 'close' : 'camera-alt'} size={18} color={colors.primary} />
                            <Text style={styles.photoBtnText}>{background ? 'Remove photo' : 'Photo'}</Text>
                        </TouchableOpacity>}
                        {!!background && themeSupportsBackground && <TouchableOpacity onPress={handleOpenCamera} disabled={isSharing} style={styles.retakeButton}
                            accessibilityRole="button" accessibilityLabel="Retake background photo">
                            <MaterialIcons name="replay" size={20} color={colors.primary} />
                        </TouchableOpacity>}
                    </View>
                    {!!background && <Text style={styles.compactHint}>{themeSupportsBackground ? 'Drag, pinch or rotate the photo' : 'Photo is hidden in Anatomy'}</Text>}
                    {!!selectionHint && <Text style={styles.compactHint} accessibilityLiveRegion="polite">{selectionHint}</Text>}
                </View>

                <View style={styles.footer}>
                    {!!shareError && <Text style={[styles.imageErrorText, { paddingBottom: 12 }]} accessibilityLiveRegion="polite">{shareError}</Text>}
                    {!!currentImageError && <View style={styles.imageError}>
                        <Text style={styles.imageErrorText} accessibilityLiveRegion="polite">{currentImageError}</Text>
                        <TouchableOpacity onPress={() => setCaptureGeneration(value => value + 1)} accessibilityRole="button" accessibilityLabel="Retry loading card images">
                            <Text style={styles.photoBtnText}>RETRY IMAGE</Text>
                        </TouchableOpacity>
                    </View>}
                    <TouchableOpacity
                        style={[styles.shareBtn, (isSharing || backgroundGateActive) && styles.shareBtnDisabled]}
                        onPress={handleShare}
                        disabled={isSharing || backgroundGateActive}
                        accessibilityRole="button"
                        accessibilityLabel="Share card image"
                        accessibilityState={{ disabled: isSharing || backgroundGateActive, busy: isSharing || waitingForImages }}
                    >
                        {isSharing ? (
                            <ActivityIndicator color={colors.background} size="small" />
                        ) : currentImageError ? (
                            <Text style={styles.shareBtnText}>IMAGE UNAVAILABLE</Text>
                        ) : backgroundGateActive ? (
                            <>
                                <ActivityIndicator color={colors.background} size="small" />
                                <Text style={styles.shareBtnText}>PREPARING IMAGE</Text>
                            </>
                        ) : (
                            <>
                                <MaterialIcons name="share" size={18} color={colors.background} />
                                <Text style={styles.shareBtnText}>SHARE</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
            <Modal visible={showHighlights} transparent animationType="slide" onRequestClose={() => setShowHighlights(false)}>
                <View style={styles.sheetOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowHighlights(false)} accessibilityLabel="Close highlights" accessibilityRole="button" />
                    <SafeAreaView edges={['bottom']} style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.headerTitle}>Choose highlights</Text>
                            <TouchableOpacity onPress={() => setShowHighlights(false)} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Close highlights picker">
                                <MaterialIcons name="close" size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.selectionList}>
                            {chips.map(chip => {
                                const active = selection.includes(chip.id);
                                return <TouchableOpacity key={chip.id} onPress={() => onToggleChip(chip.id)} style={styles.selectionRow}
                                    accessibilityRole="checkbox" accessibilityState={{ checked: active }} aria-checked={active}
                                    accessibilityLabel={(chip.isPr ? 'Personal record: ' : '') + chip.label}>
                                    <MaterialIcons name={active ? 'check-box' : 'check-box-outline-blank'} size={24} color={active ? colors.primary : colors.text.muted} />
                                    <Text style={styles.selectionLabel}>{chip.label}</Text>
                                    {chip.isPr && <Text style={styles.prBadge}>PR</Text>}
                                </TouchableOpacity>;
                            })}
                        </ScrollView>
                        <TouchableOpacity style={[styles.shareBtn, styles.sheetDone]} onPress={() => setShowHighlights(false)} accessibilityRole="button" accessibilityLabel="Done choosing highlights">
                            <Text style={styles.shareBtnText}>DONE</Text>
                        </TouchableOpacity>
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    compactContent: { flex: 1, minHeight: 0, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 10 },
    previewSpace: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    compactThemes: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 },
    compactTheme: { paddingHorizontal: 5, paddingVertical: 10, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: colors.glass.border, backgroundColor: colors.glass.surface },
    compactThemeText: { fontFamily: typography.fontFamily.semiBold, fontSize: 12, color: colors.text.primary },
    compactActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
    selectionCount: { fontFamily: typography.fontFamily.semiBold, fontSize: 12, color: colors.text.muted },
    compactHint: { fontFamily: typography.fontFamily.regular, fontSize: 12, color: colors.text.muted, textAlign: 'center' },
    retakeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
    sheet: { maxHeight: '78%', backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
    selectionList: { paddingHorizontal: 20 },
    selectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.glass.border },
    selectionLabel: { flex: 1, fontFamily: typography.fontFamily.medium, fontSize: 15, color: colors.text.primary },
    prBadge: { fontFamily: typography.fontFamily.bold, fontSize: 12, color: colors.accent.gold },
    sheetDone: { margin: 20 },
    imageError: { gap: 12, paddingBottom: 16 },
    imageErrorText: { color: colors.text.primary, fontFamily: typography.fontFamily.regular, fontSize: 14 },
    container: {
        flex: 1,
        backgroundColor: colors.background,
        ...(Platform.OS === 'web' ? { overflow: 'hidden' as const } : {}),
    },
    captureHost: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: -1,
        elevation: -1, // Android draws by elevation, not zIndex
        ...(Platform.OS === 'web' ? { width: '100%' as const, height: '100%' as const, overflow: 'hidden' as const } : {}),
    },
    screenBody: {
        flex: 1,
        backgroundColor: colors.background, // opaque, covers the capture host
        zIndex: 1,
        elevation: 1,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.glass.border,
    },
    headerBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },




    heroOuter: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: borderRadius.lg,
        backgroundColor: colors.background,
    },
    heroInner: {
        width: CARD_W,
        height: CARD_H,
        flexShrink: 0,
    },
    photoBtn: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    photoBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.primary,
        letterSpacing: 0.5,
    },

    themePillActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    themePillTextActive: {
        color: colors.background,
    },

    footer: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.glass.border,
    },
    shareBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.full,
    },
    shareBtnDisabled: {
        opacity: 0.6,
    },
    shareBtnText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.bold,
        color: colors.background,
        letterSpacing: 1,
    },
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
