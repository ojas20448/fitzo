import { defaultExercises } from '../data/defaultExercises';
import photos from '../data/exercisePhotos.json';
import { exerciseAnimations } from '../data/exerciseAnimations';
import { exerciseStaticPhotos } from '../data/exerciseStaticPhotos';

export interface MediaExercise {
    id?: string; name: string; gifUrl?: string | null; gif_url?: string | null;
    imageUrl?: string | null; custom?: boolean;
}
export interface ExerciseMedia {
    uri: string;
    kind: 'animation' | 'photo';
    poster?: string;
    credit?: { author: string; license: string; licenseUrl: string; sourcePageUrl: string };
}
const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const localNames = new Map(defaultExercises.map(exercise => [normalize(exercise.name), exercise]));
const localIds = new Map(defaultExercises.map(exercise => [exercise.id, exercise]));
const photoIndex: Record<string, string[]> = photos;
const animations = new Map(exerciseAnimations.flatMap(animation => animation.names.map(name => [normalize(name), animation] as const)));

/** Match stable local IDs or exact normalized names, never a fuzzy movement guess. */
export function exerciseMediaCandidates(exercise: MediaExercise): ExerciseMedia[] {
    const result: ExerciseMedia[] = [];
    const add = (media: ExerciseMedia) => { if (!result.some(item => item.uri === media.uri)) result.push(media); };
    const supplied = exercise.gifUrl?.trim() || exercise.gif_url?.trim() || exercise.imageUrl?.trim();
    if (supplied) add({ uri: supplied, kind: /\.gif(?:[?#]|$)/i.test(supplied) ? 'animation' : 'photo' });
    if (exercise.custom) return result;
    const local = (exercise.id && localIds.get(exercise.id)) || localNames.get(normalize(exercise.name));
    const animation = animations.get(normalize(local?.name || exercise.name));
    // Prefer a known bundled demo over provider URLs or another device's local asset URI.
    if (animation) {
        const demo: ExerciseMedia = { uri: animation.animation, poster: animation.poster, kind: 'animation', credit: {
            author: animation.author, license: animation.license, licenseUrl: animation.licenseUrl, sourcePageUrl: animation.sourcePageUrl,
        } };
        if (result[0]?.uri === animation.animation) result.shift();
        result.unshift(demo);
    }
    const bundledPhoto = local && exerciseStaticPhotos[local.id];
    if (bundledPhoto && !result.some(item => item.uri === bundledPhoto)) {
        const firstPhoto = result.findIndex(item => item.kind === 'photo');
        result.splice(firstPhoto < 0 ? result.length : firstPhoto, 0, { uri: bundledPhoto, kind: 'photo' });
    }
    if (local?.gifUrl) add({ uri: local.gifUrl, kind: 'photo' });
    // Display names can differ from source names; the mirrored path identifies the exact original.
    const storedPhotos = 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/';
    if (local?.gifUrl?.startsWith(storedPhotos)) {
        const file = local.gifUrl.slice(storedPhotos.length).split(/[?#]/)[0];
        add({ uri: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/' + file, kind: 'photo' });
    }
    for (const name of new Set([exercise.name, local?.name].filter((value): value is string => !!value))) {
        for (const file of photoIndex[normalize(name)] || []) {
            add({ uri: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/' + file, kind: 'photo' });
        }
    }
    return result;
}

export function withExerciseMedia<T extends MediaExercise>(exercise: T): T & { gifUrl?: string | null } {
    const media = exerciseMediaCandidates(exercise)[0];
    return media ? { ...exercise, gifUrl: media.uri } : exercise;
}
