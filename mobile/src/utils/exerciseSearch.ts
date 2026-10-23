export interface SearchExercise {
    id: string; name: string; bodyPart?: string; category?: string; target?: string; equipment?: string;
    gifUrl?: string | null; instructions?: string | string[]; custom?: boolean;
}
export function isExerciseSelected(exercise: Pick<SearchExercise, 'id' | 'name'>, selected: readonly Pick<SearchExercise, 'id' | 'name'>[] = []): boolean {
    return selected.some(item => item.id === exercise.id || item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase());
}
export function canonicalBodyPart(value: string): string {
    const part = value.toLowerCase().trim();
    if (part === 'upper arms' || part === 'lower arms') return 'arms';
    if (part === 'upper legs' || part === 'lower legs') return 'legs';
    if (part === 'waist' || part === 'abs') return 'core';
    return part;
}
export function apiBodyParts(value: string): string[] {
    const part = canonicalBodyPart(value);
    if (part === 'arms') return ['upper arms', 'lower arms'];
    if (part === 'legs') return ['upper legs', 'lower legs'];
    if (part === 'core') return ['waist'];
    if (part === 'full body') return []; // The provider has no full-body endpoint.
    return [part];
}
export function exerciseMatches(exercise: SearchExercise, query = '', selectedBodyPart: string | null = null, allowedBodyParts?: string[]): boolean {
    const part = canonicalBodyPart(exercise.bodyPart || exercise.category || '');
    if (selectedBodyPart && part !== canonicalBodyPart(selectedBodyPart)) return false;
    if (allowedBodyParts?.length && !allowedBodyParts.some(allowed => canonicalBodyPart(allowed) === part)) return false;
    const searchable = [exercise.name, exercise.target, exercise.equipment, part].filter(Boolean).join(' ').toLowerCase();
    return query.toLowerCase().trim().split(/\s+/).filter(Boolean).every(word => searchable.includes(word));
}
export function mergeExerciseResults(first: readonly SearchExercise[], next: readonly SearchExercise[]): SearchExercise[] {
    const results: SearchExercise[] = [];
    const ids = new Map<string, number>();
    const names = new Map<string, number>();
    for (const exercise of [...first, ...next]) {
        const name = exercise.name.toLowerCase().trim();
        const index = ids.get(exercise.id) ?? names.get(name);
        if (index === undefined) {
            ids.set(exercise.id, results.length); names.set(name, results.length); results.push(exercise);
        } else {
            const current = results[index];
            results[index] = { ...exercise, ...current, gifUrl: current.gifUrl || exercise.gifUrl, instructions: current.instructions || exercise.instructions };
            ids.set(exercise.id, index);
        }
    }
    return results;
}
