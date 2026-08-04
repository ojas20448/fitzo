/**
 * Day Boundary Tests
 *
 * The app's day is IST. The database is UTC, so a naive CURRENT_DATE is
 * wrong for 5.5 hours every night — a meal logged at 01:00 IST would file
 * under the previous day. These tests pin the exact edges, because the
 * middle of the day works under either rule and proves nothing.
 */

const {
    istDateString,
    isValidDateString,
    IST_TODAY_SQL,
    IST_DAY_OF_SQL,
    APP_TIMEZONE,
} = require('../utils/dayBoundary');

describe('istDateString', () => {
    it('rolls to the next day at exactly 18:30 UTC', () => {
        // 18:29 UTC is 23:59 IST the same day; 18:30 UTC is 00:00 IST the next.
        expect(istDateString(new Date('2026-08-02T18:29:59Z'))).toBe('2026-08-02');
        expect(istDateString(new Date('2026-08-02T18:30:00Z'))).toBe('2026-08-03');
    });

    it('treats 00:00 UTC as the same IST day, not the next', () => {
        // 00:00 UTC = 05:30 IST, still the same calendar day in India.
        expect(istDateString(new Date('2026-08-03T00:00:00Z'))).toBe('2026-08-03');
    });

    it('puts 23:59 IST and 00:01 IST on different days', () => {
        expect(istDateString(new Date('2026-08-02T18:29:00Z'))).toBe('2026-08-02'); // 23:59 IST
        expect(istDateString(new Date('2026-08-02T18:31:00Z'))).toBe('2026-08-03'); // 00:01 IST
    });

    it('crosses a month boundary correctly', () => {
        expect(istDateString(new Date('2026-07-31T18:30:00Z'))).toBe('2026-08-01');
    });

    it('crosses a year boundary correctly', () => {
        expect(istDateString(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
    });

    it('accepts an ISO string as well as a Date', () => {
        expect(istDateString('2026-08-02T18:30:00Z')).toBe('2026-08-03');
    });

    it('returns null for an invalid date instead of throwing', () => {
        expect(istDateString('not a date')).toBeNull();
        expect(istDateString(new Date('nonsense'))).toBeNull();
    });
});

describe('isValidDateString', () => {
    it('accepts a well-formed date', () => {
        expect(isValidDateString('2026-08-03')).toBe(true);
    });

    it('rejects malformed input', () => {
        expect(isValidDateString('2026-8-3')).toBe(false);
        expect(isValidDateString('03-08-2026')).toBe(false);
        expect(isValidDateString('2026-08-03T00:00:00Z')).toBe(false);
        expect(isValidDateString('')).toBe(false);
        expect(isValidDateString(null)).toBe(false);
        expect(isValidDateString('2026-13-01')).toBe(false);
        expect(isValidDateString('2026-02-30')).toBe(false);
    });

    it("rejects anything that could reach SQL as something other than a date", () => {
        expect(isValidDateString("2026-08-03'; DROP TABLE calorie_logs;--")).toBe(false);
    });
});

describe('SQL fragments', () => {
    it('name the app timezone', () => {
        expect(IST_TODAY_SQL).toContain(APP_TIMEZONE);
        expect(IST_DAY_OF_SQL).toContain(APP_TIMEZONE);
    });

    it('reference the column each one needs', () => {
        expect(IST_DAY_OF_SQL).toContain('created_at');
        expect(IST_TODAY_SQL).toContain('NOW()');
    });
});
