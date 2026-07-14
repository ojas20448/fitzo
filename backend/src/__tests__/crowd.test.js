/**
 * Crowd Level Tests
 * Green/yellow/red light = active members vs gym capacity.
 */

const { computeCrowd, DEFAULT_CAPACITY } = require('../utils/crowd');

describe('computeCrowd', () => {
    it('is green (low) under 40% occupancy', () => {
        expect(computeCrowd(0, 50)).toMatchObject({ level: 'low', percentage: 0 });
        expect(computeCrowd(19, 50)).toMatchObject({ level: 'low', percentage: 38 });
    });

    it('is yellow (medium) from 40% to 74% occupancy', () => {
        expect(computeCrowd(20, 50)).toMatchObject({ level: 'medium', percentage: 40 });
        expect(computeCrowd(37, 50)).toMatchObject({ level: 'medium', percentage: 74 });
    });

    it('is red (high) at 75%+ occupancy', () => {
        expect(computeCrowd(38, 50)).toMatchObject({ level: 'high', percentage: 76 });
        expect(computeCrowd(50, 50)).toMatchObject({ level: 'high', percentage: 100 });
    });

    it('scales with capacity — same count, different light', () => {
        expect(computeCrowd(30, 200).level).toBe('low');    // 15% of a big gym
        expect(computeCrowd(30, 60).level).toBe('medium');  // 50% of a medium gym
        expect(computeCrowd(30, 35).level).toBe('high');    // 86% of a small studio
    });

    it('caps percentage at 100 even when over capacity', () => {
        expect(computeCrowd(80, 50)).toMatchObject({ level: 'high', percentage: 100 });
    });

    it('falls back to default capacity for null/invalid capacity', () => {
        expect(computeCrowd(10, null).capacity).toBe(DEFAULT_CAPACITY);
        expect(computeCrowd(10, 0).capacity).toBe(DEFAULT_CAPACITY);
        expect(computeCrowd(10, -5).capacity).toBe(DEFAULT_CAPACITY);
        expect(computeCrowd(10, 'abc').capacity).toBe(DEFAULT_CAPACITY);
    });

    it('handles garbage active counts safely', () => {
        expect(computeCrowd(undefined, 50)).toMatchObject({ level: 'low', active_now: 0 });
        expect(computeCrowd(-3, 50)).toMatchObject({ level: 'low', active_now: 0 });
        expect(computeCrowd('12', 50)).toMatchObject({ active_now: 12 });
    });
});
