/**
 * Quiet Hours Tests
 * Decides whether a "your gym is quiet now" push is warranted.
 */

const { shouldAlertQuiet, QUIET_SCORE_THRESHOLD } = require('../services/quietHours');

const base = {
    currentScore: 20,
    confidence: 'good',
    alreadyCheckedIn: false,
    lastAlertHoursAgo: 48,
};

describe('shouldAlertQuiet', () => {
    it('alerts when the gym is quiet and the member has not been in', () => {
        expect(shouldAlertQuiet(base)).toBe(true);
    });

    it('stays silent when the gym is busy', () => {
        expect(shouldAlertQuiet({ ...base, currentScore: 80 })).toBe(false);
    });

    it('stays silent when the member already checked in today', () => {
        expect(shouldAlertQuiet({ ...base, alreadyCheckedIn: true })).toBe(false);
    });

    it('stays silent when confidence is too low to be trusted', () => {
        expect(shouldAlertQuiet({ ...base, confidence: 'none' })).toBe(false);
        expect(shouldAlertQuiet({ ...base, confidence: 'low' })).toBe(false);
    });

    it('does not nag — respects a 24h cooldown', () => {
        expect(shouldAlertQuiet({ ...base, lastAlertHoursAgo: 3 })).toBe(false);
    });

    it('treats "never alerted" (null) as cooldown satisfied', () => {
        // users.quiet_alert_sent_at is NULL until the first send — this must
        // read as eligible, not as "0 hours ago".
        expect(shouldAlertQuiet({ ...base, lastAlertHoursAgo: null })).toBe(true);
        expect(shouldAlertQuiet({ ...base, lastAlertHoursAgo: undefined })).toBe(true);
    });

    it('alerts again once the cooldown has fully elapsed', () => {
        expect(shouldAlertQuiet({ ...base, lastAlertHoursAgo: 23.9 })).toBe(false);
        expect(shouldAlertQuiet({ ...base, lastAlertHoursAgo: 24 })).toBe(true);
    });

    it('alerts exactly at the threshold boundary', () => {
        expect(shouldAlertQuiet({ ...base, currentScore: QUIET_SCORE_THRESHOLD })).toBe(true);
        expect(shouldAlertQuiet({ ...base, currentScore: QUIET_SCORE_THRESHOLD + 1 })).toBe(false);
    });
});
