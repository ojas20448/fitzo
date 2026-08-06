// Mirror of backend/src/utils/lessonFilter.js — keep behaviour in step. Tests live with the backend copy.
/**
 * Lesson Search and Filtering
 *
 * Pure, so it is testable without a renderer and runs identically on the
 * client. Search is client-side by design: at 22 lessons a round trip is
 * slower than typing, and filtering a cached list keeps working with no signal
 * — which matters inside a gym building.
 */

export interface FilterableLesson {
    title?: string | null;
    description?: string | null;
    topics?: string[] | null;
}

export interface FilterLessonsOptions {
    query?: string;
    topic?: string | null;
}

export function filterLessons<T extends FilterableLesson>(
    lessons: T[] | null | undefined,
    opts?: FilterLessonsOptions
): T[] {
    const list = Array.isArray(lessons) ? lessons : [];
    const { query = '', topic = null } = opts || {};

    const q = typeof query === 'string' ? query.trim().toLowerCase() : '';

    return list.filter((l) => {
        if (!l) return false;

        // Topic and text combine with AND. A lesson must satisfy both.
        if (topic) {
            const topics = Array.isArray(l.topics) ? l.topics : [];
            if (!topics.includes(topic)) return false;
        }

        if (!q) return true;

        const haystack = [
            l.title,
            l.description,
            ...(Array.isArray(l.topics) ? l.topics : []),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return haystack.includes(q);
    });
}

/**
 * Every distinct topic across the given lessons, sorted. Derived from the data
 * rather than hardcoded so the chips can never drift from what exists.
 */
export function collectTopics<T extends FilterableLesson>(lessons: T[] | null | undefined): string[] {
    const list = Array.isArray(lessons) ? lessons : [];
    const seen = new Set<string>();
    for (const l of list) {
        if (!l || !Array.isArray(l.topics)) continue;
        for (const t of l.topics) if (t) seen.add(t);
    }
    return [...seen].sort();
}
