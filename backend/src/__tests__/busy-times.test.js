/**
 * Busy Times Tests
 * 7x24 hour-of-week grid derived from check-in arrivals.
 */

const {
    computeBusyTimes,
    MIN_TOTAL_SAMPLES,
} = require('../utils/busyTimes');

// Helper: build `count` rows all on the same dow/hour
const row = (dow, hour, arrivals) => ({ dow, hour, arrivals });

describe('computeBusyTimes', () => {
    it('reports no confidence below the sample floor', () => {
        const result = computeBusyTimes([row(1, 7, 5)]);
        expect(result.confidence).toBe('none');
        expect(result.grid).toBeNull();
        expect(result.peak).toBeNull();
        expect(result.totalSamples).toBe(5);
    });

    it('builds a 7x24 grid once past the sample floor', () => {
        const rows = [row(1, 7, 30), row(1, 14, 10)];
        const result = computeBusyTimes(rows);
        expect(result.confidence).not.toBe('none');
        expect(result.grid).toHaveLength(7);
        expect(result.grid[0]).toHaveLength(24);
    });

    it('scores the busiest hour 100 and empty hours 0', () => {
        const rows = [row(1, 7, 30), row(1, 14, 15)];
        const result = computeBusyTimes(rows);
        expect(result.grid[1][7]).toBe(100);
        expect(result.grid[1][14]).toBe(50);
        expect(result.grid[3][3]).toBe(0);
    });

    it('identifies peak and quietest observed hours', () => {
        const rows = [row(2, 18, 40), row(2, 6, 25), row(2, 15, 5)];
        const result = computeBusyTimes(rows);
        expect(result.peak).toMatchObject({ dow: 2, hour: 18, score: 100 });
        expect(result.quietest).toMatchObject({ dow: 2, hour: 15 });
    });

    it('marks low confidence between the floor and the good threshold', () => {
        const result = computeBusyTimes([row(1, 7, MIN_TOTAL_SAMPLES)]);
        expect(result.confidence).toBe('low');
    });

    it('marks good confidence at 60+ samples', () => {
        const result = computeBusyTimes([row(1, 7, 60)]);
        expect(result.confidence).toBe('good');
    });

    it('ignores malformed rows instead of throwing', () => {
        const rows = [row(1, 7, 30), { dow: 9, hour: 99, arrivals: 5 }, { dow: 1 }];
        const result = computeBusyTimes(rows);
        expect(result.totalSamples).toBe(30);
        expect(result.grid[1][7]).toBe(100);
    });

    it('returns none for an empty history', () => {
        const result = computeBusyTimes([]);
        expect(result.confidence).toBe('none');
        expect(result.totalSamples).toBe(0);
    });
});
