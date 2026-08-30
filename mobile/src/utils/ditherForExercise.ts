import type { ShareExercise } from '../components/share/SharePayload';

/**
 * 12 of the 16 bundled dither assets were unused, while the receipt picked art
 * by sniffing substrings out of the caption text. Mapping on the exercise's
 * target muscle makes the card feel specific to what was actually trained, at
 * no size cost — the PNGs already ship in the bundle.
 */
export const DITHER_BY_MUSCLE = {
    chest: require('../../assets/barbell_dither.png'),
    back: require('../../assets/dumbbell_dither.png'),
    shoulders: require('../../assets/kettlebell_dither.png'),
    arms: require('../../assets/dumbbell_dither.png'),
    legs: require('../../assets/treadmill_dither.png'),
    core: require('../../assets/yoga_mat_dither.png'),
    cardio: require('../../assets/running_shoe_dither.png'),
    kettlebell: require('../../assets/kettlebell_dither.png'),
    bike: require('../../assets/bicycle_dither.png'),
    trophy: require('../../assets/trophy_dither.png'),
    default: require('../../assets/barbell_dither.png'),
} as const;

const NAME_HINTS: [RegExp, keyof typeof DITHER_BY_MUSCLE][] = [
    [/kettlebell/i, 'kettlebell'],
    [/bike|cycl|spin/i, 'bike'],
    [/run|treadmill|jog/i, 'cardio'],
    [/squat|leg|lunge|calf/i, 'legs'],
    [/bench|chest|fly|press/i, 'chest'],
    [/row|pull|deadlift|lat/i, 'back'],
    [/curl|tricep|bicep/i, 'arms'],
    [/plank|crunch|ab/i, 'core'],
];

export function ditherForExercise(ex: ShareExercise) {
    const target = ex.target?.toLowerCase();
    if (target && target in DITHER_BY_MUSCLE) {
        return DITHER_BY_MUSCLE[target as keyof typeof DITHER_BY_MUSCLE];
    }
    for (const [re, key] of NAME_HINTS) {
        if (re.test(ex.name)) return DITHER_BY_MUSCLE[key];
    }
    return DITHER_BY_MUSCLE.default;
}
