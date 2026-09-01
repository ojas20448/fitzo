import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
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

interface Chip {
    id: string;
    label: string;
    isPr: boolean;
}

/**
 * The composer screen — picks which lifts from the just-finished workout to
 * feature on a shareable 9:16 card, in one of five themes.
 *
 * Layout, top to bottom: content chips -> hero preview -> theme picker ->
 * Share button. See the two render blocks below for why the hero and the
 * capture target are two SEPARATE renders of the active theme, not one.
 */
export default function ShareComposerScreen() {
    const source = useShareComposerStore((s) => s.source);
    const isStale = useShareComposerStore((s) => s.isStale);
    const isSession = source?.kind === 'session';
    const session = source && source.kind === 'session' ? source.session : null;

    const [selection, setSelection] = useState<string[]>([]);
    const [theme, setTheme] = useState<ThemeId | null>(null);
    const [heroWidth, setHeroWidth] = useState(0);

    const cardRef = useRef<View>(null);
    const { captureAndShare, isSharing } = useShareCapture();

    // Task 10 — camera photo behind the card, gesture-positioned. All local
    // component state, same as selection/theme/heroWidth above — NOT the
    // composer store — so it can never survive past this one composer
    // visit. A fresh mount (a new workout's "share" tap) always starts with
    // no photo, matching the lifecycle check in the task brief's
    // verification list (a backgrounded app + a new session must not carry
    // anything from the previous share forward).
    const [background, setBackground] = useState<ShareBackground | null>(null);
    // RULING R30 — true only once the CAPTURE TARGET's own <Image> (not the
    // hero's — see handleBackgroundLoad below) has decoded the current uri.
    const [backgroundLoaded, setBackgroundLoaded] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<any>(null);

    // Live gesture state. translate is RAW SCREEN PIXELS measured over the
    // hero preview while a gesture is active; scale/rotation are already
    // the same unit `ShareBackground` stores (unitless / radians), so only
    // translate ever needs a unit conversion before it can be written into
    // `background` — see commitBackground below and
    // utils/backgroundTransform.ts's own doc comment for RULING R29's other
    // half (pixelDeltaToFraction).
    const bgTranslateX = useSharedValue(0);
    const bgTranslateY = useSharedValue(0);
    const bgSavedX = useSharedValue(0);
    const bgSavedY = useSharedValue(0);
    const bgScale = useSharedValue(1);
    const bgSavedScale = useSharedValue(1);
    const bgRotation = useSharedValue(0);
    const bgSavedRotation = useSharedValue(0);

    // Open on the detected moment for a session source; a static source has
    // no "moment" to pick from a payload that already carries fixed content,
    // so it opens straight onto RECEIPT — the same theme pickMoment itself
    // falls back to when a session carries nothing chip-worthy either. No
    // source, or one too old to trust (see STALE_AFTER_MS in
    // shareComposerStore.ts), bounces back rather than showing a composer
    // with nothing — or stale, wrong — content. That staleness check is the
    // composer STORE's own clock (time since setSource), not the session's
    // own completedAt — see shareComposerStore.ts's doc comment for why
    // those are different checks, and WorkoutRecapScreen.tsx for where a
    // session's own freshness is verified before it ever reaches this store.
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
    }, []);

    // R3/R4: derived locally from the WHOLE session, independent of which
    // chips are selected — a heatmap of "what you trained today" does not
    // shrink because the card happens to feature one exercise. The actual
    // reduction (and its lowercase-key correctness) lives in
    // deriveMuscleVolume, which has test coverage this screen cannot.
    // A static source has no session to derive from, so this is always {}
    // for one — same as any workout with no muscle-tagged exercises.
    const muscleVolume = useMemo(
        () => deriveMuscleVolume(session?.exercises ?? []),
        [session],
    );
    const showMusclesChip = hasMuscleVolume(muscleVolume);

    // Empty for a static source — and the chip row that maps this is hidden
    // entirely below — there is nothing in a finished SharePayload to select
    // between.
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

    // The one place selection + session become what a theme renders — for a
    // session source. A static source has no selection to derive from: it
    // renders source.payload exactly as handed to the composer (the chip
    // row that would mutate selection is hidden for it below, so selection
    // can never move out of the [] it starts at).
    // muscleVolume is spread on AFTER buildSharePayload, not passed into
    // it — see buildSharePayload.ts's own doc comment for why that field
    // stays outside its 2-argument (session, selection) contract.
    // Gated on the MUSCLES_ID chip being in `selection` (not spread
    // unconditionally): Anatomy's hasMuscleVolume check treats an absent
    // muscleVolume the same as an empty one and falls back to its own
    // designed FallbackBody, so leaving the chip OFF has to actually mean
    // something — otherwise toggling "Muscles" would produce no observable
    // change in any theme.
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
        // Task 10: the camera photo is composer-local state, independent of
        // source kind — a static source (e.g. Stats' weekly recap) can
        // carry a background exactly the same way a session source can,
        // since nothing about WHERE the card's other content came from
        // changes what a photo taken IN the composer itself means.
        // Always spread (not `background ? {...} : base`) so composer
        // state is unconditionally authoritative — removing the photo
        // (`background` back to null) always clears it from the payload
        // too, even in a hypothetical future where a static producer's own
        // `source.payload` already carried one.
        return { ...base, background };
    }, [source, session, theme, selection, muscleVolume, background]);

    if (!source || !theme || !payload) {
        // Either the effect above is about to call router.back(), or the
        // moment hasn't been seeded yet (a single tick after mount) — both
        // are momentary, so a bare background avoids flashing a zeroed-out
        // composer. Same idiom as app/_layout.tsx's own loadingContainer.
        return <View style={styles.container} />;
    }

    const ActiveTheme = THEMES[theme].Component;
    const heroScale = heroWidth > 0 ? heroWidth / CARD_W : 0;
    const heroHeight = heroWidth * (CARD_H / CARD_W);
    // False for ANATOMY only — see themes/index.ts's own doc comment and
    // Anatomy.tsx's file doc for why that theme opts out entirely.
    const themeSupportsBackground = !!THEMES[theme].supportsBackground;
    // RULING R30: the share button must wait for the CAPTURE target's photo
    // to decode ONLY when a background is actually set AND the active theme
    // will actually render it — a background sitting in state while the
    // user is on Anatomy (which never mounts CardBackground, so never fires
    // onBackgroundLoad) must not disable sharing forever.
    const backgroundGateActive = !!background && themeSupportsBackground && !backgroundLoaded;

    // Task 10 — camera capture. Writes a freshly `createBackground`'d
    // (centred, 1x, unrotated — backgroundTransform.ts) entry and resets
    // the live gesture shared values to match, so the first drag after a
    // retake starts from the same neutral point the newly rendered
    // CardBackground itself starts at, not wherever the PREVIOUS photo was
    // left.
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
            setBackgroundLoaded(false); // re-armed until the NEW image's onLoad fires (R30)
            setShowCamera(false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (err) {
            logger.error('[ShareComposerScreen] photo capture failed', err);
            Alert.alert('Error', 'Failed to capture photo');
        }
    };

    const handleOpenCamera = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Camera Permission', 'Camera access is needed to add a photo background.');
                return;
            }
        }
        setShowCamera(true);
    };

    const handleRemoveBackground = () => {
        setBackground(null);
        setBackgroundLoaded(false);
    };

    // RULING R30 — wired ONLY to the CAPTURE TARGET's own CardBackground
    // below, never the hero's: the hero is what the user watches load, but
    // the capture target is what useShareCapture actually screenshots, and
    // those are two separate <Image> instances even though they share a
    // uri. Gating on the hero's load instead would let sharing enable
    // before the tree that actually matters has decoded.
    const handleBackgroundLoad = () => setBackgroundLoaded(true);

    // Bridges gesture updates (UI thread, screen pixels) into React state
    // (JS thread, normalized fractions) — RULING R29's boundary, crossed in
    // exactly one place. Unlike WorkoutRecapScreen's receipt-drag (a
    // reanimated-only animation with no React-state mirror, since nothing
    // outside that gesture ever needs its position), this photo's position
    // must ALSO reach the completely separate, non-gesture-aware capture
    // target tree (the hidden ViewShot below) — so every update commits
    // into state via runOnJS rather than staying purely on the UI thread.
    // `pixelDeltaToFraction` (not the raw translate values) is what
    // actually performs the R29 conversion; it runs here, on the JS thread,
    // deliberately — see its own doc comment in backgroundTransform.ts.
    const commitBackground = (translateX: number, translateY: number, scale: number, rotation: number) => {
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

    // Task 10 — full-screen camera, replacing the whole composer while
    // open. Same structural pattern as WorkoutRecapScreen's own camera
    // early-return (WorkoutRecapScreen.tsx:219-247): CameraView fills the
    // screen, capture/flip/close controls sit in a SafeAreaView overlay.
    // Placed AFTER the guard above (not before) so it never needs to
    // special-case a missing source/theme/payload itself.
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

    // Gesture layer over the hero preview — RULING R29: writes NORMALIZED
    // values, never pixels. `.onUpdate()`/`.onEnd()` run as reanimated
    // worklets (react-native-reanimated/plugin, babel.config.js) on the UI
    // thread; `runOnJS` is the one legal way to reach commitBackground (a
    // plain JS/React-state function) from there. Same
    // Gesture.Simultaneous(Pan, Pinch, Rotation) composition
    // WorkoutRecapScreen uses for its own receipt placement
    // (WorkoutRecapScreen.tsx:40-88) and the same reason: a one-at-a-time
    // recognizer cannot pinch and drag in the same touch sequence. The
    // SUBJECT inverts, though — recap moves the CARD over a fixed photo;
    // here the PHOTO moves behind a fixed card, so the sign of every delta
    // below is what the recap version would have called correct, applied
    // to the opposite layer.
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
            // Clamped on the UI thread (clampBackgroundScale is a
            // 'worklet' function — backgroundTransform.ts) so the photo can
            // never be scaled to nothing, matching the binding requirement.
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

    // Only wire the gesture layer when there is something to drag AND the
    // active theme will actually show it moving — dragging blind against a
    // theme that never renders the photo (Anatomy) would be touch input
    // with no visible effect.
    const gestureActive = !!background && themeSupportsBackground;
    const heroCard = (
        <View style={[styles.heroOuter, { width: heroWidth, height: heroHeight }]}>
            <View style={[styles.heroInner, { transform: [{ scale: heroScale }] }]}>
                <ActiveTheme payload={payload} />
            </View>
        </View>
    );

    // Step 3 of the task brief, essentially verbatim: SCOREBOARD (the only
    // singleSelectOnly theme) can only ever draw one figure. Switching TO it
    // with more than one chip selected collapses to the first; adding a
    // second chip while it's already active moves the theme to SPEC, the
    // layout built to handle a list, rather than silently dropping the chip.
    // Gated on isSession: a static source's selection can never grow past
    // the [] it starts at (its chip row is never rendered, so nothing can
    // ever push into it), so this collapse is a no-op for it either way —
    // the guard makes that explicit rather than relying on selection
    // happening to stay empty.
    const onSelectTheme = (id: ThemeId) => {
        Haptics.selectionAsync();
        if (isSession && THEMES[id].singleSelectOnly && selection.length > 1) {
            setSelection([selection[0]]);
        }
        setTheme(id);
    };

    const onToggleChip = (id: string) => {
        const next = selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id];
        if (next.length === 0) return; // never an empty selection
        if (next.length > 1 && THEMES[theme].singleSelectOnly) setTheme('spec');
        Haptics.selectionAsync();
        setSelection(next);
    };

    const handleShare = () => {
        // RULING R30 — defence in depth: the Share button's own `disabled`
        // prop already covers this (see the footer below), but this
        // guard means calling handleShare from anywhere else can never
        // capture a background that has not finished decoding.
        if (isSharing || backgroundGateActive) return;

        // A static source can hand the composer a purpose-built fallback
        // (Stats' weekly-recap text references summary_text / streak_days —
        // fields no SharePayload carries); the session path keeps the same
        // generic message it has always used.
        const fallbackMessage =
            source.kind === 'static' && source.fallbackMessage
                ? source.fallbackMessage
                : `${payload.headline} — shared from Fitzo`;
        captureAndShare(cardRef, {
            dialogTitle: 'Share your workout',
            fallbackMessage,
        });
    };

    return (
        <View style={styles.container}>
            {/*
             * Hidden capture target at true 1080x1920. The scaled hero below is
             * for reading; capturing IT would export at preview resolution.
             *
             * Do NOT use opacity:0 — Android skips rendering it entirely and
             * captureRef returns a blank image. Do NOT use display:'none' — the
             * tree never lays out. Sitting it behind an opaque background at
             * negative z keeps it painted and capturable while invisible.
             * Always mounted (never conditionally rendered past the guard
             * above) so it has already painted by the time Share is tappable;
             * useShareCapture's own double-rAF + settle delay is a second
             * layer of the same guarantee, not the only one.
             */}
            <View style={styles.captureHost} pointerEvents="none">
                <ViewShot ref={cardRef} style={{ width: CARD_W, height: CARD_H }}>
                    {/*
                     * onBackgroundLoad wired HERE only (RULING R30) — this is
                     * the tree useShareCapture actually screenshots. The
                     * hero instance below renders the same payload without
                     * it; see handleBackgroundLoad's own comment for why
                     * gating on the hero's load instead would be wrong.
                     */}
                    <ActiveTheme payload={payload} onBackgroundLoad={handleBackgroundLoad} />
                </ViewShot>
            </View>

            <SafeAreaView style={styles.screenBody} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} hitSlop={8}>
                        <MaterialIcons name="close" size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Share workout</Text>
                    <View style={styles.headerBtn} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/*
                     * Content chips — session source only. A static source
                     * (e.g. Stats' weekly recap) has no selectable content to
                     * chip between, so the whole section — label included —
                     * is hidden rather than left showing an empty row.
                     */}
                    {isSession && (
                        <>
                            <Text style={styles.sectionLabel}>WHAT TO FEATURE</Text>
                            <View style={styles.chipRow}>
                                {chips.map((chip) => {
                                    const active = selection.includes(chip.id);
                                    return (
                                        <TouchableOpacity
                                            key={chip.id}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => onToggleChip(chip.id)}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: active }}
                                        >
                                            {chip.isPr && (
                                                <MaterialIcons
                                                    name="emoji-events"
                                                    size={14}
                                                    color={active ? colors.background : colors.accent.gold}
                                                    style={styles.chipIcon}
                                                />
                                            )}
                                            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                                                {chip.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </>
                    )}

                    {/*
                     * Hero preview — the active theme rendered ONCE at
                     * transform:scale(heroScale), heroScale = measured width /
                     * CARD_W. heroOuter is centered flex content sized exactly
                     * to the scaled footprint; heroInner is the natural
                     * CARD_W x CARD_H box. Scaling defaults to the element's
                     * OWN center, which flexbox centering has already aligned
                     * with heroOuter's center, so the scaled-down result lands
                     * exactly inside heroOuter with no extra offset math —
                     * same technique Anatomy.tsx already uses for its own
                     * inner heatmap scale. (transformOrigin is deliberately
                     * not used here — BrandIntro.tsx already found it has
                     * patchy support on this RN/Expo setup and compensates
                     * with translate math instead; centered flex layout
                     * sidesteps needing either.)
                     */}
                    <View style={styles.heroSection} onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
                        {heroScale > 0 && (
                            gestureActive ? (
                                <GestureDetector gesture={backgroundGesture}>{heroCard}</GestureDetector>
                            ) : (
                                heroCard
                            )
                        )}
                    </View>

                    {/*
                     * Task 10 — camera photo behind the card. Sits right
                     * below the hero, the one place the effect is actually
                     * visible, rather than up with the content chips: it
                     * applies uniformly across themes (bar Anatomy, which
                     * opts out — themes/index.ts), it is not "what to
                     * feature" content selection.
                     */}
                    <View style={styles.photoRow}>
                        <TouchableOpacity
                            style={styles.photoBtn}
                            onPress={background ? handleRemoveBackground : handleOpenCamera}
                            accessibilityRole="button"
                            accessibilityLabel={background ? 'Remove background photo' : 'Add background photo'}
                        >
                            <MaterialIcons name={background ? 'close' : 'camera-alt'} size={16} color={colors.primary} />
                            <Text style={styles.photoBtnText}>{background ? 'REMOVE PHOTO' : 'ADD PHOTO'}</Text>
                        </TouchableOpacity>
                        {!!background && (
                            <TouchableOpacity
                                style={styles.photoBtn}
                                onPress={handleOpenCamera}
                                accessibilityRole="button"
                                accessibilityLabel="Retake background photo"
                            >
                                <MaterialIcons name="replay" size={16} color={colors.primary} />
                                <Text style={styles.photoBtnText}>RETAKE</Text>
                            </TouchableOpacity>
                        )}
                        {!!background && !themeSupportsBackground && (
                            <Text style={styles.photoHint} numberOfLines={1}>Hidden on {THEMES[theme].label}</Text>
                        )}
                    </View>

                    {/*
                     * Theme picker — LABELS ONLY, not a carousel of live
                     * previews. At the ~0.4 scale a five-up row would need,
                     * VT323 text and exercise names are illegible, so a row of
                     * tiny cards could not actually serve as confirmation —
                     * the hero above is the one place that reads the card.
                     */}
                    <Text style={styles.sectionLabel}>STYLE</Text>
                    <View style={styles.themeRow}>
                        {THEME_ORDER.map((id) => {
                            const active = theme === id;
                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={[styles.themePill, active && styles.themePillActive]}
                                    onPress={() => onSelectTheme(id)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                >
                                    <Text style={[styles.themePillText, active && styles.themePillTextActive]}>
                                        {THEMES[id].label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.shareBtn, (isSharing || backgroundGateActive) && styles.shareBtnDisabled]}
                        onPress={handleShare}
                        disabled={isSharing || backgroundGateActive}
                    >
                        {isSharing ? (
                            <ActivityIndicator color={colors.background} size="small" />
                        ) : backgroundGateActive ? (
                            // RULING R30 — visible while the capture target's
                            // photo is still decoding, so the disabled button
                            // reads as "wait a moment" rather than "broken".
                            <>
                                <ActivityIndicator color={colors.background} size="small" />
                                <Text style={styles.shareBtnText}>PREPARING PHOTO</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    // The fragile part — see the JSX comment above the ViewShot for the
    // full explanation of why these exact properties, not opacity/display.
    captureHost: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: -1,
        elevation: -1, // Android draws by elevation, not zIndex
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
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: typography.sizes.lg,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
    },

    scrollContent: {
        padding: spacing.xl,
        paddingBottom: spacing['4xl'],
    },

    sectionLabel: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.semiBold,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: colors.text.muted,
        marginBottom: spacing.md,
    },

    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing['3xl'],
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: 240,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    chipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    chipIcon: {
        marginRight: 6,
    },
    chipText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.medium,
        color: colors.text.primary,
    },
    chipTextActive: {
        color: colors.background,
    },

    heroSection: {
        width: '100%',
        alignItems: 'center',
        marginBottom: spacing['3xl'],
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
    },

    // Task 10 — camera photo controls, directly below the hero.
    photoRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing['3xl'],
    },
    photoBtn: {
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
    photoHint: {
        fontSize: typography.sizes['2xs'],
        fontFamily: typography.fontFamily.medium,
        color: colors.text.muted,
        flexShrink: 1,
    },

    themeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    themePill: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.full,
        backgroundColor: colors.glass.surface,
        borderWidth: 1,
        borderColor: colors.glass.border,
    },
    themePillActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    themePillText: {
        fontSize: typography.sizes.sm,
        fontFamily: typography.fontFamily.semiBold,
        color: colors.text.primary,
        letterSpacing: 0.5,
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

    // Task 10 — full-screen camera. Same visual language as
    // WorkoutRecapScreen's own camera overlay (WorkoutRecapScreen.tsx's
    // cameraOverlay/cameraTopRow/cameraBtn/cameraBottom/cameraHint/
    // captureBtn/captureBtnInner styles) rather than a divergent new one.
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
