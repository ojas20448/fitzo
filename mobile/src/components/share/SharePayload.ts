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
    isPr?: boolean;
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
    date: Date;
}

/** 9:16 at story resolution. Every theme renders at exactly this size. */
export const CARD_W = 1080;
export const CARD_H = 1920;
