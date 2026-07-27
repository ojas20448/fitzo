/**
 * Crowd Level Tests
 * Green/yellow/red light = active members vs gym capacity.
 */

const {
    computeCrowd,
    DEFAULT_CAPACITY,
    presenceWindowEnd,
    isPresent,
    DEFAULT_SESSION_MINUTES,
} = require('../utils/crowd');

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

describe('presenceWindowEnd', () => {
    it('uses the explicit checkout time when present', () => {
        const inAt = new Date('2026-07-27T06:00:00Z');
        const outAt = new Date('2026-07-27T07:15:00Z');
        expect(presenceWindowEnd(inAt, outAt).toISOString()).toBe(outAt.toISOString());
    });

    it('auto-expires after the default session length when no checkout', () => {
        const inAt = new Date('2026-07-27T06:00:00Z');
        const end = presenceWindowEnd(inAt, null);
        expect(end.toISOString()).toBe('2026-07-27T07:30:00.000Z');
        expect(DEFAULT_SESSION_MINUTES).toBe(90);
    });

    it('respects explicit checkout time even if beyond default session length', () => {
        const inAt = new Date('2026-07-27T06:00:00Z');
        const outAt = new Date('2026-07-27T08:30:00Z');
        expect(presenceWindowEnd(inAt, outAt).toISOString()).toBe(outAt.toISOString());
    });

    it('falls back to auto-expiry if checkout is unparseable', () => {
        const inAt = new Date('2026-07-27T06:00:00Z');
        const invalidOut = 'not a date';
        const end = presenceWindowEnd(inAt, invalidOut);
        expect(end.toISOString()).toBe('2026-07-27T07:30:00.000Z');
    });
});

describe('isPresent', () => {
    const inAt = new Date('2026-07-27T06:00:00Z');

    it('counts a member still inside their session window', () => {
        const now = new Date('2026-07-27T07:00:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: null }, now)).toBe(true);
    });

    it('counts a member who arrived 80 min ago — the old 60 min rule missed this', () => {
        const now = new Date('2026-07-27T07:20:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: null }, now)).toBe(true);
    });

    it('drops a member past the auto-expiry', () => {
        const now = new Date('2026-07-27T08:00:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: null }, now)).toBe(false);
    });

    it('drops a member who explicitly checked out — the old rule still counted them', () => {
        const now = new Date('2026-07-27T06:40:00Z');
        const out = new Date('2026-07-27T06:30:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: out }, now)).toBe(false);
    });

    it('does not count a future check-in', () => {
        const now = new Date('2026-07-27T05:00:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: null }, now)).toBe(false);
    });

    it('returns false for malformed rows instead of throwing', () => {
        const now = new Date('2026-07-27T07:00:00Z');
        expect(isPresent({ checked_in_at: null, checked_out_at: null }, now)).toBe(false);
        expect(isPresent(null, now)).toBe(false);
    });

    it('counts a member at the exact check-in time (boundary)', () => {
        expect(isPresent({ checked_in_at: inAt, checked_out_at: null }, inAt)).toBe(true);
    });

    it('excludes a member at the exact window end time (boundary)', () => {
        const end = presenceWindowEnd(inAt, null);
        expect(isPresent({ checked_in_at: inAt, checked_out_at: null }, end)).toBe(false);
    });

    it('respects long explicit checkout beyond default session length', () => {
        const longOut = new Date('2026-07-27T08:30:00Z');
        const stillInside = new Date('2026-07-27T07:30:00Z');
        const afterLongOut = new Date('2026-07-27T09:00:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: longOut }, stillInside)).toBe(true);
        expect(isPresent({ checked_in_at: inAt, checked_out_at: longOut }, afterLongOut)).toBe(false);
    });

    it('falls back to auto-expiry if checked_out_at is unparseable', () => {
        const now = new Date('2026-07-27T07:00:00Z');
        expect(isPresent({ checked_in_at: inAt, checked_out_at: 'invalid date' }, now)).toBe(true);
    });
});
