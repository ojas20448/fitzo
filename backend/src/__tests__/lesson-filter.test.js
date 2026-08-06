/**
 * Lesson Filter Tests
 *
 * The search predicate behind the Learn library. Fixtures deliberately include
 * a lesson with ZERO questions and one with no topics — three defects earlier
 * in this codebase survived because the fixture happened to be the benign case.
 */

const { filterLessons, collectTopics } = require('../utils/lessonFilter');

const lessons = [
    { id: '1', title: 'Understanding RPE', description: 'Rate of perceived exertion', topics: ['training'], question_count: 4 },
    { id: '2', title: 'What Actually Works', description: 'Creatine and the rest', topics: ['supplements', 'nutrition'], question_count: 4 },
    { id: '3', title: 'Sleep: The Natural Steroid', description: 'Recovery happens at night', topics: ['recovery'], question_count: 0 },
    { id: '4', title: 'Untagged Lesson', description: 'No topics yet', topics: [], question_count: 4 },
];

describe('filterLessons', () => {
    it('returns everything for an empty query and no topic', () => {
        expect(filterLessons(lessons, {})).toHaveLength(4);
        expect(filterLessons(lessons, { query: '', topic: null })).toHaveLength(4);
    });

    it('returns everything for a whitespace-only query', () => {
        expect(filterLessons(lessons, { query: '   ' })).toHaveLength(4);
    });

    it('matches on title', () => {
        const r = filterLessons(lessons, { query: 'sleep' });
        expect(r.map((l) => l.id)).toEqual(['3']);
    });

    it('matches on description', () => {
        const r = filterLessons(lessons, { query: 'creatine' });
        expect(r.map((l) => l.id)).toEqual(['2']);
    });

    it('matches on topic text', () => {
        const r = filterLessons(lessons, { query: 'recovery' });
        expect(r.map((l) => l.id)).toEqual(['3']);
    });

    it('is case-insensitive', () => {
        expect(filterLessons(lessons, { query: 'RPE' })).toHaveLength(1);
        expect(filterLessons(lessons, { query: 'rpe' })).toHaveLength(1);
    });

    it('returns an empty array when nothing matches — not everything', () => {
        expect(filterLessons(lessons, { query: 'zzzznomatch' })).toEqual([]);
    });

    it('filters by topic', () => {
        const r = filterLessons(lessons, { topic: 'nutrition' });
        expect(r.map((l) => l.id)).toEqual(['2']);
    });

    it('combines query and topic with AND, not OR', () => {
        // 'training' topic contains only lesson 1; query 'sleep' matches only 3.
        // OR would return two; AND returns none.
        expect(filterLessons(lessons, { query: 'sleep', topic: 'training' })).toEqual([]);
        expect(filterLessons(lessons, { query: 'RPE', topic: 'training' })).toHaveLength(1);
    });

    it('handles a lesson with no topics without throwing', () => {
        expect(filterLessons(lessons, { query: 'untagged' })).toHaveLength(1);
        expect(filterLessons(lessons, { topic: 'training' }).map((l) => l.id)).toEqual(['1']);
    });

    it('survives malformed input', () => {
        expect(filterLessons(null, { query: 'x' })).toEqual([]);
        expect(filterLessons(undefined, {})).toEqual([]);
        expect(filterLessons(lessons, null)).toHaveLength(4);
    });
});

describe('collectTopics', () => {
    it('returns sorted unique topics and skips untagged lessons', () => {
        expect(collectTopics(lessons)).toEqual(['nutrition', 'recovery', 'supplements', 'training']);
    });

    it('returns an empty array for empty or malformed input', () => {
        expect(collectTopics([])).toEqual([]);
        expect(collectTopics(null)).toEqual([]);
    });
});
