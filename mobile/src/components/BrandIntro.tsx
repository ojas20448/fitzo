/**
 * BrandIntro — Fitzo's cinematic cold-open.
 *
 * Plays once per cold launch, layered over the app while it boots underneath,
 * so the ~2.4s of theatre costs the user nothing: fonts, auth restore and the
 * backend wake-up all happen behind this curtain.
 *
 * The reveal is built from three stacked layers inside `markStage`:
 *
 *   1. `ink`     — a plain white rectangle that slides up from below.
 *   2. `gleam`   — a diagonal white gradient band that sweeps across it.
 *   3. `counter` — an SVG card filled pure black with the F glyph punched out
 *                  of it (even-odd fill rule).
 *
 * Because layer 3 is the same #000 as the backdrop, it is invisible — but it
 * masks layers 1 and 2 down to the letterform. So the rising rectangle reads
 * as the F wiping itself into existence bottom-up, and the sweeping band reads
 * as a gleam travelling across metal. No blend modes, no MaskedView
 * dependency, no animated SVG props — just three views and a punched-out card.
 *
 * NOTE: this technique requires an opaque #000 backdrop. If the intro ever
 * moves onto a non-black or gradient background, the counter-form card stops
 * being invisible and the whole illusion breaks.
 *
 * Known and accepted: while the gleam sweeps, it crosses the stage's clip
 * boundary, and the clip anti-aliases the gleam and the card independently.
 * That leaves a ~10%-brightness seam one device pixel wide, for ~640ms, on an
 * element that is scaling the whole time — measured, and well below the
 * threshold of visibility. Removing it would mean dropping `overflow: hidden`
 * and growing the card to cover the gleam's entire travel, which trades a real
 * safety net for nothing anyone can see. The ink no longer touches the boundary
 * at all, which is what made the earlier, persistent version of this seam
 * visible.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from '../utils/haptics';
import * as SplashScreen from 'expo-splash-screen';

import { colors, shadow, typography } from '../styles/theme';

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/** Stage box, in px — the clipped window the mark is revealed inside. */
const STAGE = 64;

/** How far the mask card overhangs the stage on every side.
 *
 *  The card has to be strictly larger than the stage, not the same size. When
 *  its edge coincides with the stage's `overflow: hidden` boundary, the card
 *  and the white ink beneath it get rasterised and anti-aliased independently,
 *  and the fractional difference leaves a faint bright hairline down the edge
 *  of the mark. Overhanging means the clip cuts through solid card instead. */
const CARD_PAD = 8;
const CARD = STAGE + CARD_PAD * 2;

/** Square, and 1:1 with px, so `preserveAspectRatio` has nothing to letterbox
 *  — a non-square viewBox in a square box strands uncovered strips at the
 *  left and right edges, which the ink then bleeds through. */
const VIEW_BOX = `0 0 ${CARD} ${CARD}`;

/** The Fitzo F, traced from assets/icon.png (58.4 x 58.8 natural) and placed
 *  centred in the stage, which sits CARD_PAD in from the card's origin. */
const F_GLYPH =
    'M10.8 10.6 H69.2 L63.7 23.3 H23.5 V34.1 H57.9 V45.8 H23.5 V69.4 H10.8 Z';

/** The card, with the F punched out of it via fillRule="evenodd". */
const COUNTER_FORM = `M0 0 H${CARD} V${CARD} H0 Z ` + F_GLYPH;

/** The ink rect is inset so it comfortably covers the glyph (which spans
 *  2.8..61.2) while never reaching the stage's clip boundary. Anything bright
 *  that touches that boundary gets anti-aliased independently of the card on
 *  top of it, and the mismatch shows as a hairline seam down the mark. */
const INK_INSET = 2;
const INK = STAGE - INK_INSET * 2;

const LETTERS = ['F', 'I', 'T', 'Z', 'O'];
const LETTER_TRACKING = 7;
const GAP_LEFT = 18;
const DIVIDER_W = 1.5;
const GAP_RIGHT = 18;

/** Extra scale the mark carries while it is alone at centre stage, before it
 *  shrinks into the lockup. 0.85 puts it at ~111px — about 28% of a 390pt
 *  screen, big enough to be an event without tipping into parody. */
const HERO_ZOOM = 0.85;

/* ------------------------------------------------------------------ *
 * Choreography (ms)
 * ------------------------------------------------------------------ */

const T = {
    rise: { delay: 60, dur: 620 },
    land: { delay: 660, up: 110, down: 260 },
    gleam: { delay: 420, dur: 640 },
    brighten: { delay: 980, dur: 320 },
    shift: { delay: 780, dur: 520 },
    divider: { delay: 860, dur: 260 },
    word: { delay: 940, dur: 700 },
    sweep: { delay: 920, dur: 560 },
    exit: { delay: 2040, dur: 420 },
};
const TOTAL = T.exit.delay + T.exit.dur;

const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** The wipe needs its own curve. EASE_OUT is so front-loaded that it covers
 *  80% of the travel in the first fifth of the duration — the curtain would
 *  snap open and the reveal would read as a hard cut. This one eases in, drives
 *  through the middle, and settles, so the gesture is actually legible. */
const EASE_WIPE = Easing.bezier(0.5, 0, 0.15, 1);

/** Module-scoped: survives re-renders and Fast Refresh, resets on cold start.
 *  Netflix plays on every launch — but not every time React re-mounts. */
let hasPlayed = false;

function tap(style: Haptics.ImpactFeedbackStyle) {
    if (Platform.OS === 'web') return;
    Haptics.impactAsync(style).catch(() => {});
}

function dismissSplash() {
    SplashScreen.hideAsync().catch(() => {});
}

/* ------------------------------------------------------------------ *
 * Wordmark letter
 * ------------------------------------------------------------------ */

function Letter({
    char,
    index,
    progress,
    isLast,
}: {
    char: string;
    index: number;
    progress: SharedValue<number>;
    isLast: boolean;
}) {
    const style = useAnimatedStyle(() => {
        const start = index * 0.11;
        const end = Math.min(1, start + 0.52);
        const p = interpolate(progress.value, [start, end], [0, 1], Extrapolation.CLAMP);
        return {
            opacity: p,
            transform: [
                // Drifts right in the wake of the light sweep.
                { translateX: interpolate(p, [0, 1], [-9, 0]) },
                { scale: interpolate(p, [0, 1], [0.9, 1]) },
            ],
        };
    });

    return (
        <Animated.Text
            style={[styles.letter, !isLast && styles.letterGap, style]}
            allowFontScaling={false}
        >
            {char}
        </Animated.Text>
    );
}

/* ------------------------------------------------------------------ *
 * Intro
 * ------------------------------------------------------------------ */

export function BrandIntro({ onDone }: { onDone?: () => void }) {
    const reducedMotion = useReducedMotion();

    const [mounted, setMounted] = useState(() => !hasPlayed);
    const [wordWidth, setWordWidth] = useState(0);

    const started = useRef(false);
    const finishing = useRef(false);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

    // 0 -> 1 progress drivers
    const rise = useSharedValue(0);
    const land = useSharedValue(0); // impact pulse as the mark completes
    const gleam = useSharedValue(0);
    const brighten = useSharedValue(0);
    const shift = useSharedValue(1); // 1 = mark centred, 0 = final lockup
    const divider = useSharedValue(0);
    const word = useSharedValue(0);
    const sweep = useSharedValue(0);
    const flash = useSharedValue(0);
    const exit = useSharedValue(0);

    const wordW = useSharedValue(0);

    const after = (ms: number, fn: () => void) => {
        timers.current.push(setTimeout(fn, ms));
    };

    const clearTimers = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };

    const finish = useCallback(() => {
        hasPlayed = true;
        clearTimers();
        setMounted(false);
        onDone?.();
    }, [onDone]);

    /** Tap anywhere to bail out early — just fade, no snapping. */
    const skip = useCallback(() => {
        if (finishing.current) return;
        finishing.current = true;
        clearTimers();
        exit.value = withTiming(1, { duration: 240, easing: Easing.in(Easing.cubic) });
        after(250, finish);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [finish]);

    // Already played this session: make sure the splash still lifts and the
    // parent unblocks.
    useEffect(() => {
        if (mounted) return;
        dismissSplash();
        onDone?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Watchdog. The sequence waits on an onLayout that should always arrive —
    // but this overlay is opaque and covers the entire app, so "should" is not
    // good enough. If the intro has not started by now, something is wrong with
    // measurement and the right move is to get out of the user's way.
    useEffect(() => {
        if (!mounted) return;
        after(2000, () => {
            if (!started.current) finish();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted]);

    // Kick off only once the wordmark has been measured, so the opening frame
    // can place the mark at true screen centre with no first-frame jump.
    useEffect(() => {
        if (!mounted || started.current || wordWidth <= 0) return;
        started.current = true;

        // Hand off from the native splash only now — both are the F on black,
        // so the seam is invisible.
        dismissSplash();

        if (reducedMotion) {
            rise.value = 1;
            brighten.value = 1;
            shift.value = 0;
            divider.value = 1;
            word.value = withTiming(1, { duration: 340 });
            exit.value = withDelay(900, withTiming(1, { duration: 300 }));
            after(1220, finish);
            return;
        }

        rise.value = withDelay(
            T.rise.delay,
            withTiming(1, { duration: T.rise.dur, easing: EASE_WIPE }),
        );

        // The punch as the wipe completes — pairs with the haptic and the flash.
        land.value = withDelay(
            T.land.delay,
            withSequence(
                withTiming(1, { duration: T.land.up, easing: Easing.out(Easing.quad) }),
                withTiming(0, { duration: T.land.down, easing: Easing.inOut(Easing.quad) }),
            ),
        );

        gleam.value = withDelay(
            T.gleam.delay,
            withTiming(1, { duration: T.gleam.dur, easing: Easing.inOut(Easing.quad) }),
        );

        brighten.value = withDelay(
            T.brighten.delay,
            withTiming(1, { duration: T.brighten.dur }),
        );

        shift.value = withDelay(
            T.shift.delay,
            withTiming(0, { duration: T.shift.dur, easing: EASE_IN_OUT }),
        );

        divider.value = withDelay(
            T.divider.delay,
            withTiming(1, { duration: T.divider.dur, easing: EASE_OUT }),
        );

        word.value = withDelay(
            T.word.delay,
            withTiming(1, { duration: T.word.dur, easing: Easing.out(Easing.cubic) }),
        );

        sweep.value = withDelay(
            T.sweep.delay,
            withTiming(1, { duration: T.sweep.dur, easing: Easing.inOut(Easing.cubic) }),
        );

        // Two blooms: one as the mark lands, one as the wordmark completes.
        flash.value = withDelay(
            650,
            withSequence(
                withTiming(1, { duration: 80 }),
                withTiming(0, { duration: 300 }),
                withDelay(520, withTiming(0.75, { duration: 110 })),
                withTiming(0, { duration: 420 }),
            ),
        );

        exit.value = withDelay(
            T.exit.delay,
            withTiming(1, { duration: T.exit.dur, easing: Easing.in(Easing.cubic) }),
        );

        after(680, () => tap(Haptics.ImpactFeedbackStyle.Medium));
        after(1570, () => tap(Haptics.ImpactFeedbackStyle.Light));
        after(TOTAL, finish);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted, wordWidth, reducedMotion]);

    useEffect(() => clearTimers, []);

    /* ---------------- animated styles ---------------- */

    const overlayStyle = useAnimatedStyle(() => ({
        opacity: 1 - exit.value,
    }));

    const rowStyle = useAnimatedStyle(() => {
        // Act 1 holds the mark big and alone at centre; Act 2 shrinks it to
        // lockup size and slides it left. Both are driven off `shift`, so the
        // zoom and the slide can never drift out of sync with each other.
        const scale =
            (1 + HERO_ZOOM * shift.value) *
            (1 + land.value * 0.045) *
            (1 + exit.value * 0.06);

        // Transforms compose as translate(scale(p)), so translateX lands in
        // unscaled px. The half-lockup offset therefore has to be scaled by
        // hand, or the mark drifts off centre as the zoom unwinds.
        const half = (GAP_LEFT + DIVIDER_W + GAP_RIGHT + wordW.value) / 2;

        return {
            transform: [{ translateX: shift.value * half * scale }, { scale }],
        };
    });

    const inkStyle = useAnimatedStyle(() => {
        const s = rise.value;
        return {
            opacity: interpolate(brighten.value, [0, 1], [0.82, 1]),
            // Bottom-anchored grow. The default transform origin is the centre,
            // so translating down by half the height the rect gives up pins its
            // bottom edge in place — a curtain going up, without the rect ever
            // crossing the clip boundary. Preferred over `transformOrigin`
            // (patchy support) and over animating `height` (layout path).
            transform: [{ translateY: (INK * (1 - s)) / 2 }, { scaleY: s }],
        };
    });

    const gleamStyle = useAnimatedStyle(() => ({
        opacity: interpolate(gleam.value, [0, 0.12, 0.85, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
        transform: [
            { translateX: interpolate(gleam.value, [0, 1], [-56, 96]) },
            { rotate: '18deg' },
        ],
    }));

    const dividerStyle = useAnimatedStyle(() => ({
        opacity: divider.value,
        transform: [{ scaleY: divider.value }],
    }));

    const sweepStyle = useAnimatedStyle(() => ({
        opacity: interpolate(sweep.value, [0, 0.08, 0.8, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
        transform: [{ translateX: interpolate(sweep.value, [0, 1], [-2, wordW.value + 2]) }],
    }));

    const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.13 }));

    if (!mounted) return null;

    return (
        <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}>
            <Pressable
                style={styles.centre}
                onPress={skip}
                accessibilityRole="button"
                accessibilityLabel="Skip Fitzo intro"
            >
                <Animated.View style={[styles.row, rowStyle]}>
                    {/* ---- mark ---- */}
                    <View style={styles.markWrap}>
                        <View style={styles.markStage}>
                            <Animated.View style={[styles.ink, inkStyle]} />
                            <Animated.View style={[styles.gleam, gleamStyle]} pointerEvents="none">
                                <LinearGradient
                                    colors={[
                                        'rgba(255,255,255,0)',
                                        'rgba(255,255,255,0.95)',
                                        'rgba(255,255,255,0)',
                                    ]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={StyleSheet.absoluteFill}
                                />
                            </Animated.View>
                            {/* Invisible black card that masks the two layers
                                above down to the letterform. */}
                            <Svg
                                width={CARD}
                                height={CARD}
                                viewBox={VIEW_BOX}
                                style={styles.counter}
                                pointerEvents="none"
                            >
                                <Path d={COUNTER_FORM} fill={colors.background} fillRule="evenodd" />
                            </Svg>
                        </View>
                    </View>

                    {/* ---- divider ---- */}
                    <Animated.View style={[styles.divider, dividerStyle]} />

                    {/* ---- wordmark ---- */}
                    <View
                        style={styles.word}
                        onLayout={(e) => {
                            const w = e.nativeEvent.layout.width;
                            if (w > 0 && w !== wordWidth) {
                                wordW.value = w;
                                setWordWidth(w);
                            }
                        }}
                    >
                        {LETTERS.map((c, i) => (
                            <Letter
                                key={c + i}
                                char={c}
                                index={i}
                                progress={word}
                                isLast={i === LETTERS.length - 1}
                            />
                        ))}
                        <Animated.View style={[styles.sweep, sweepStyle]} pointerEvents="none" />
                    </View>
                </Animated.View>
            </Pressable>

            <Animated.View
                style={[StyleSheet.absoluteFill, styles.flash, flashStyle]}
                pointerEvents="none"
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        backgroundColor: colors.background,
        zIndex: 999,
        elevation: 999,
    },
    centre: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    markWrap: {
        width: STAGE,
        height: STAGE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    markStage: {
        width: STAGE,
        height: STAGE,
        overflow: 'hidden',
    },
    ink: {
        position: 'absolute',
        left: INK_INSET,
        top: INK_INSET,
        width: INK,
        height: INK,
        backgroundColor: '#FFFFFF',
    },
    counter: {
        position: 'absolute',
        left: -CARD_PAD,
        top: -CARD_PAD,
    },
    gleam: {
        position: 'absolute',
        top: -40,
        left: 0,
        width: 30,
        height: STAGE + 80,
    },

    divider: {
        width: DIVIDER_W,
        height: 40,
        marginLeft: GAP_LEFT,
        marginRight: GAP_RIGHT,
        backgroundColor: 'rgba(255,255,255,0.22)',
    },

    word: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    letter: {
        fontSize: 32,
        lineHeight: 38,
        fontFamily: typography.fontFamily.light,
        color: colors.text.primary,
    },
    letterGap: {
        marginRight: LETTER_TRACKING,
    },
    sweep: {
        position: 'absolute',
        left: 0,
        top: -2,
        width: 2,
        height: 42,
        backgroundColor: '#FFFFFF',
        ...shadow({ blur: 10, color: '#FFFFFF', opacity: 0.9 }),
    },

    flash: {
        backgroundColor: '#FFFFFF',
    },
});

export default BrandIntro;
