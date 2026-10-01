import { healthDayWindow, recentHealthDates } from '../healthDate';

it('uses full local calendar days for history and caps today at now', () => {
    const now = new Date(2026, 8, 14, 13, 30);
    expect(healthDayWindow('2026-09-13', now)).toEqual({ start: new Date(2026, 8, 13), end: new Date(2026, 8, 14) });
    expect(healthDayWindow('2026-09-14', now).end).toEqual(now);
    expect(recentHealthDates(3, now)).toEqual(['2026-09-14', '2026-09-13', '2026-09-12']);
});
it('rejects invalid dates, future imports and unbounded backfills', () => {
    const now = new Date(2026, 8, 14, 13);
    expect(() => healthDayWindow('2026-02-30', now)).toThrow();
    expect(() => healthDayWindow('2026-09-15', now)).toThrow();
    expect(() => recentHealthDates(31, now)).toThrow();
    expect(() => recentHealthDates(0, now)).toThrow();
});

it('keeps consecutive dates over a daylight-saving boundary', () => {
    expect(recentHealthDates(3, new Date(2026, 2, 9, 10))).toEqual(['2026-03-09', '2026-03-08', '2026-03-07']);
    const window = healthDayWindow('2026-03-08', new Date(2026, 2, 9, 10));
    expect(window.start).toEqual(new Date(2026, 2, 8));
    expect(window.end).toEqual(new Date(2026, 2, 9));
});
