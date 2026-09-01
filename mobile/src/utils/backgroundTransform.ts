import type { ShareBackground } from '../components/share/SharePayload';

/**
 * Pure math for a camera photo positioned behind a share card — Task 10,
 * RULING R29.
 *
 * `ShareBackground` (SharePayload.ts) stores a photo's placement NORMALIZED
 * — offsetX/offsetY as a FRACTION of card width/height, scale as a unitless
 * multiplier over cover-fit, rotation in radians — never as pixels. The
 * reason: ShareComposerScreen renders the active theme TWICE, at two
 * different physical sizes — a hero preview scaled to `heroWidth`
 * (device-dependent, ~0.35x on a phone) and a separate hidden capture
 * target at the true CARD_W x CARD_H (ShareComposerScreen.tsx:133,192). A
 * pixel offset that looks right at one size is wrong at the other by
 * whatever ratio separates them — roughly 3x between a phone's hero preview
 * and the 1080-wide export. Normalized values sidestep that entirely: the
 * SAME fraction resolves to the correct pixels at any render size, which is
 * exactly what `resolveBackgroundTransform` below does, and exactly what
 * its test suite (backgroundTransform.test.ts) exists to prove — that test
 * IS the R29 guarantee, not this comment.
 *
 * Zero React Native imports here, on purpose — like format.ts, this is one
 * of the few places this feature's logic can actually be unit-tested, since
 * no component in this repo can be rendered under this test setup
 * (no @testing-library/react-native, no react-test-renderer).
 */

/**
 * A freshly captured photo starts centred, at exactly cover-fit, unrotated
 * — the neutral starting point every gesture in the composer resets FROM.
 * Pulled into one function so the composer and this module's own tests
 * share a single definition of "neutral" instead of two independent copies
 * of the same four literals silently drifting apart.
 */
export function createBackground(uri: string): ShareBackground {
    return { uri, offsetX: 0, offsetY: 0, scale: 1, rotation: 0 };
}

/**
 * Scale bounds, defined relative to the scale=1 "exactly covers the card"
 * landmark ShareBackground.scale is documented against — never an absolute
 * pixel size, since the whole point of this module is that no absolute
 * pixel size is meaningful without a render size to resolve it against.
 * MIN keeps a pinch-in from ever scaling the photo to nothing (half of
 * cover-fit, not zero — the task's binding requirement); MAX gives generous
 * room to zoom into one detail (3x cover-fit) without the multiplier
 * growing unbounded.
 */
export const MIN_BACKGROUND_SCALE = 0.5;
export const MAX_BACKGROUND_SCALE = 3;

/**
 * Clamps a live pinch-gesture scale to the bounds above. Called directly
 * inside ShareComposerScreen's pinch gesture's `.onUpdate()` — which
 * `react-native-reanimated/plugin` (babel.config.js) compiles to run on the
 * UI thread — so this needs the `'worklet'` directive to be legal to call
 * from there. The directive is additive only: it does not change how this
 * function behaves when called as plain JS (this file's own tests included,
 * which run under Jest with no reanimated runtime involved at all), it only
 * makes the SAME function also embeddable in UI-thread worklet code.
 */
export function clampBackgroundScale(scale: number): number {
    'worklet';
    return Math.min(MAX_BACKGROUND_SCALE, Math.max(MIN_BACKGROUND_SCALE, scale));
}

/**
 * Converts a raw on-screen gesture delta (pixels, measured over a preview
 * rendered at `boxSize`) into the SAME normalized fraction
 * `resolveBackgroundTransform` below expects — the other direction of the
 * R29 boundary. Gesture handlers report `translationX`/`translationY` in
 * real screen pixels regardless of any `transform: scale()` applied to the
 * view they are attached to (RNGH measures the finger's actual on-screen
 * movement, not the transformed view's own coordinate space), so this
 * division is the ONE place raw pixels are allowed to exist in this
 * feature at all — and only in transit, on their way to becoming a
 * fraction, never stored or passed on as pixels themselves.
 *
 * Guards `boxSize <= 0` (the hero has not been laid out yet) by returning 0
 * rather than Infinity/NaN — the same defensive shape as this file's other
 * pure functions.
 */
export function pixelDeltaToFraction(px: number, boxSize: number): number {
    return boxSize > 0 ? px / boxSize : 0;
}

/**
 * The absolute pixel transform for one normalized ShareBackground, resolved
 * against a SPECIFIC render size (cardW x cardH). Every field is plain,
 * unit-labelled, and cheap to assert on in a test — no react-native
 * `transform` array shape or degrees-string formatting happens here; that
 * is CardBackground.tsx's job, the only caller and the only place that
 * actually needs an RN style object.
 *
 * offsetX/offsetY are fractions of cardW/cardH, so translateX/translateY
 * are size-relative BY CONSTRUCTION (`offsetX * cardW`) — the same fraction
 * yields proportionally different pixel values at different cardW, which is
 * the R29 guarantee stated as an equation: for a fixed `bg`, two calls with
 * different cardW/cardH must return pixel offsets in the same ratio to
 * their own cardW/cardH. See backgroundTransform.test.ts for that exact
 * assertion at hero-preview scale vs true 1080x1920 scale.
 *
 * scale and rotation carry NO size conversion at all — both are already
 * size-independent (a "1.5x zoom" or a "12 degree tilt" means the same
 * thing regardless of how many pixels the card happens to be rendered at),
 * so they pass through unchanged. That is not a shortcut that happens to
 * work; it is the reason ShareBackground documents them as unitless/radians
 * in the first place — nothing about either field needs cardW/cardH to be
 * meaningful.
 */
export interface ResolvedBackgroundTransform {
    translateX: number;
    translateY: number;
    scale: number;
    rotateDeg: number;
}

export function resolveBackgroundTransform(
    bg: ShareBackground,
    cardW: number,
    cardH: number
): ResolvedBackgroundTransform {
    return {
        translateX: bg.offsetX * cardW,
        translateY: bg.offsetY * cardH,
        scale: bg.scale,
        rotateDeg: (bg.rotation * 180) / Math.PI,
    };
}
