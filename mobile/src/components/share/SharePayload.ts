/** One personal record, after both backend shapes are collapsed. */
export interface SharePr {
    exercise: string;
    current: string;            // "80 kg x 5" or "100 kg"
    previous?: string;
}

export interface ShareSet {
    weight_kg?: number;
    reps?: number;
}

export interface ShareExercise {
    id: string;
    name: string;
    target?: string;            // muscle group — drives dither art selection
    volumeKg: number;
    setCount: number;
    topSet?: ShareSet;
}

/**
 * A camera photo placed behind a card, positioned and sized by gesture in
 * the composer — Task 10.
 *
 * RULING R29 — every field here is NORMALIZED, never a pixel value. The
 * composer renders the active theme TWICE, at two different physical sizes:
 * a hero preview scaled to `heroWidth` (device-dependent, ~0.35x on a phone)
 * and a separate hidden capture target at the true CARD_W x CARD_H. A pixel
 * offset that looks right at one size is wrong at the other by whatever
 * ratio separates them. Normalized values sidestep that: the same fraction
 * resolves correctly at ANY render size. See utils/backgroundTransform.ts
 * for the pure math that resolves this to pixels, and its test suite for
 * the proof that the same ShareBackground resolves proportionally at both
 * sizes — that test is the actual R29 guarantee, not this comment.
 */
export interface ShareBackground {
    uri: string;
    /** Offset as a FRACTION of card width/height. 0 = centred. R29. */
    offsetX: number;
    offsetY: number;
    /** Unitless multiplier over cover-fit. 1 = exactly covers. */
    scale: number;
    /** Radians. */
    rotation: number;
}

/** Everything a theme may render. Themes read from this and nothing else. */
export interface SharePayload {
    headline: string;           // "1,240 KG"
    caption?: string;           // "The weight of 3 auto-rickshaws"
    subtitle?: string;          // "Push - 24 Aug"
    rows: { label: string; value: string }[];
    prs: SharePr[];
    exercises: ShareExercise[];
    /** Per-muscle set counts, for the ANATOMY theme. Lowercase keys only. */
    muscleVolume?: Record<string, number>;
    /** Camera photo behind the card — Task 10. Absent/null renders nothing (CardBackground.tsx). */
    background?: ShareBackground | null;
    date: Date;
}

/** 9:16 at story resolution. Every theme renders at exactly this size. */
export const CARD_W = 1080;
export const CARD_H = 1920;
