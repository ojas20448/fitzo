import {
    resolveBackgroundTransform,
    clampBackgroundScale,
    createBackground,
    pixelDeltaToFraction,
    MIN_BACKGROUND_SCALE,
    MAX_BACKGROUND_SCALE,
} from '../backgroundTransform';
import type { ShareBackground } from '../../components/share/SharePayload';

const bg = (overrides: Partial<ShareBackground> = {}): ShareBackground => ({
    uri: 'file:///gym.jpg',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0,
    ...overrides,
});

describe('resolveBackgroundTransform — RULING R29: normalized, never pixels', () => {
    // THE regression test the task brief calls out by name: the SAME
    // normalized background, resolved at two very different render sizes (a
    // ~0.35x phone hero preview vs the true 1080x1920 export), must produce
    // pixel offsets in the SAME ratio to their own card size. A resolver
    // that treated offsetX/offsetY as already-pixel values (the R29 bug)
    // would return the SAME translateX at both sizes instead of a
    // proportional one — these tests fail loudly if that regression is ever
    // reintroduced, here or in a future edit to this function.
    const HERO_W = 378; // ~0.35 * CARD_W, matching the brief's own "~0.35 on a phone"
    const HERO_H = 672; // HERO_W * (1920/1080) — same 9:16 ratio as the true card
    const CARD_W = 1080;
    const CARD_H = 1920;

    it('resolves a centred (0,0) background to zero translation at every render size', () => {
        const centred = bg();
        const hero = resolveBackgroundTransform(centred, HERO_W, HERO_H);
        const capture = resolveBackgroundTransform(centred, CARD_W, CARD_H);
        expect(hero.translateX).toBe(0);
        expect(hero.translateY).toBe(0);
        expect(capture.translateX).toBe(0);
        expect(capture.translateY).toBe(0);
    });

    it('resolves an off-centre background PROPORTIONALLY at hero scale and at true export resolution', () => {
        const offCentre = bg({ offsetX: 0.12, offsetY: -0.2 });
        const hero = resolveBackgroundTransform(offCentre, HERO_W, HERO_H);
        const capture = resolveBackgroundTransform(offCentre, CARD_W, CARD_H);

        // Same FRACTION of width/height at both sizes -> pixel offsets that
        // scale exactly with cardW/cardH, not two unrelated numbers.
        expect(hero.translateX / HERO_W).toBeCloseTo(capture.translateX / CARD_W, 10);
        expect(hero.translateY / HERO_H).toBeCloseTo(capture.translateY / CARD_H, 10);

        // Concretely, not just as a ratio: exactly offsetX * cardW/cardH.
        expect(hero.translateX).toBeCloseTo(0.12 * HERO_W, 10);
        expect(capture.translateX).toBeCloseTo(0.12 * CARD_W, 10);
        expect(hero.translateY).toBeCloseTo(-0.2 * HERO_H, 10);
        expect(capture.translateY).toBeCloseTo(-0.2 * CARD_H, 10);
    });

    it('a background scaled 1.5x is 1.5x at both the preview and the export — scale carries no pixel conversion', () => {
        const zoomed = bg({ scale: 1.5 });
        const hero = resolveBackgroundTransform(zoomed, HERO_W, HERO_H);
        const capture = resolveBackgroundTransform(zoomed, CARD_W, CARD_H);
        expect(hero.scale).toBe(1.5);
        expect(capture.scale).toBe(1.5);
        expect(hero.scale).toBe(capture.scale);
    });

    it('rotation resolves identically at both sizes — radians converted to degrees, nothing size-dependent', () => {
        const tilted = bg({ rotation: Math.PI / 6 }); // 30 degrees
        const hero = resolveBackgroundTransform(tilted, HERO_W, HERO_H);
        const capture = resolveBackgroundTransform(tilted, CARD_W, CARD_H);
        expect(hero.rotateDeg).toBeCloseTo(30, 10);
        expect(capture.rotateDeg).toBeCloseTo(30, 10);
    });

    it('REGRESSION GUARD: an off-centre background must NOT resolve to the same raw pixel value at two different card sizes', () => {
        // This is the exact failure mode R29 exists to prevent: if `offsetX`
        // were ever returned verbatim instead of multiplied by cardW (pixel
        // storage reintroduced), hero.translateX and capture.translateX
        // would be EQUAL (both just `offsetX`) despite HERO_W !== CARD_W.
        const offCentre = bg({ offsetX: 0.2, offsetY: 0.2 });
        const hero = resolveBackgroundTransform(offCentre, HERO_W, HERO_H);
        const capture = resolveBackgroundTransform(offCentre, CARD_W, CARD_H);
        expect(hero.translateX).not.toBeCloseTo(capture.translateX, 5);
        expect(hero.translateY).not.toBeCloseTo(capture.translateY, 5);
    });

    it('scales translation linearly with cardW/cardH for a fixed offset fraction', () => {
        const half = bg({ offsetX: 0.5, offsetY: 0.5 });
        expect(resolveBackgroundTransform(half, 100, 200).translateX).toBe(50);
        expect(resolveBackgroundTransform(half, 200, 400).translateX).toBe(100);
        expect(resolveBackgroundTransform(half, 100, 200).translateY).toBe(100);
        expect(resolveBackgroundTransform(half, 200, 400).translateY).toBe(200);
    });

    it('a negative offset (dragged toward the opposite edge) resolves with the correct sign at both sizes', () => {
        const negative = bg({ offsetX: -0.3, offsetY: -0.3 });
        const hero = resolveBackgroundTransform(negative, HERO_W, HERO_H);
        const capture = resolveBackgroundTransform(negative, CARD_W, CARD_H);
        expect(hero.translateX).toBeLessThan(0);
        expect(capture.translateX).toBeLessThan(0);
        expect(hero.translateX / HERO_W).toBeCloseTo(capture.translateX / CARD_W, 10);
    });
});

describe('clampBackgroundScale', () => {
    it('passes an in-range scale through unchanged', () => {
        expect(clampBackgroundScale(1)).toBe(1);
        expect(clampBackgroundScale(2)).toBe(2);
    });

    it('floors at MIN_BACKGROUND_SCALE so a pinch-in can never scale the photo to nothing', () => {
        expect(clampBackgroundScale(0)).toBe(MIN_BACKGROUND_SCALE);
        expect(clampBackgroundScale(-5)).toBe(MIN_BACKGROUND_SCALE);
        expect(clampBackgroundScale(0.1)).toBe(MIN_BACKGROUND_SCALE);
    });

    it('ceils at MAX_BACKGROUND_SCALE', () => {
        expect(clampBackgroundScale(50)).toBe(MAX_BACKGROUND_SCALE);
    });
});

describe('createBackground', () => {
    it('starts a freshly captured photo centred, at exact cover-fit, unrotated', () => {
        expect(createBackground('file:///new.jpg')).toEqual({
            uri: 'file:///new.jpg',
            offsetX: 0,
            offsetY: 0,
            scale: 1,
            rotation: 0,
        });
    });
});

describe('pixelDeltaToFraction', () => {
    it('converts a raw gesture pixel delta into a fraction of the box it was measured over', () => {
        expect(pixelDeltaToFraction(37.8, 378)).toBeCloseTo(0.1, 10);
        expect(pixelDeltaToFraction(108, 1080)).toBeCloseTo(0.1, 10);
    });

    it('the SAME fraction results from the same relative delta at a different box size — the gesture-side half of R29', () => {
        // A drag that moves the photo 10% of the hero's width should convert
        // to the same 0.1 fraction whether the hero happens to be 378px or
        // 500px wide on a given device.
        expect(pixelDeltaToFraction(37.8, 378)).toBeCloseTo(pixelDeltaToFraction(50, 500), 10);
    });

    it('returns 0 rather than Infinity/NaN when the box has not been measured yet', () => {
        expect(pixelDeltaToFraction(100, 0)).toBe(0);
    });
});
