import { filterLessons, collectTopics } from '../lessonFilter';

const lessons = [
    { id: 1, title: 'Protein 101', description: 'How much protein you need.', topics: ['nutrition'] },
    { id: 2, title: 'Bench Press', description: 'Chest strength basics.', topics: ['training'] },
    { id: 3, title: 'Sleep & Gains', description: null, topics: ['recovery', 'nutrition'] },
    { id: 4, title: null, description: 'Meal prep for fat loss', topics: ['nutrition'] },
];

describe('filterLessons', () => {
    it('returns everything when there is no query or topic', () => {
        expect(filterLessons(lessons)).toHaveLength(4);
        expect(filterLessons(lessons, {})).toHaveLength(4);
    });

    it('is case-insensitive across title, description and topics', () => {
        expect(filterLessons(lessons, { query: 'PROTEIN' })).toHaveLength(1);
        expect(filterLessons(lessons, { query: 'fat loss' })).toHaveLength(1);
        expect(filterLessons(lessons, { query: 'recovery' })).toHaveLength(1);
    });

    it('filters by topic', () => {
        expect(filterLessons(lessons, { topic: 'training' })).toHaveLength(1);
        expect(filterLessons(lessons, { topic: 'nutrition' })).toHaveLength(3);
    });

    it('combines topic and query with AND', () => {
        expect(filterLessons(lessons, { topic: 'nutrition', query: 'sleep' })).toHaveLength(1);
        expect(filterLessons(lessons, { topic: 'nutrition', query: 'bench' })).toHaveLength(0);
    });

    it('tolerates null/undefined input', () => {
        expect(filterLessons(null as any)).toEqual([]);
        expect(filterLessons(undefined as any)).toEqual([]);
    });

    it('skips falsy lessons', () => {
        expect(filterLessons([null as any, lessons[0]])).toHaveLength(1);
    });
});

describe('collectTopics', () => {
    it('returns every distinct topic, sorted', () => {
        expect(collectTopics(lessons)).toEqual(['nutrition', 'recovery', 'training']);
    });

    it('handles empty and null input', () => {
        expect(collectTopics([])).toEqual([]);
        expect(collectTopics(null as any)).toEqual([]);
    });
});
