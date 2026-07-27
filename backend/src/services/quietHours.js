/**
 * Quiet Hours Alerts
 *
 * Pushes "your gym is quiet right now" when the current hour is historically
 * unbusy and the member hasn't trained today.
 *
 * This is the one notification no consumer fitness app can send — it requires
 * knowing the physical gym. Treat it as scarce: one per member per day, max,
 * and only when the history is trustworthy.
 */

const { query } = require('../config/database');
const { computeBusyTimes } = require('../utils/busyTimes');
const pushNotifications = require('./pushNotifications');

const QUIET_SCORE_THRESHOLD = 35;   // <=35% of peak counts as quiet
const ALERT_COOLDOWN_HOURS = 24;

/**
 * Pure decision — unit tested.
 * @param {Object} params
 * @param {number} params.currentScore - Busyness score (0-100) for the current IST hour.
 * @param {'none'|'low'|'good'} params.confidence - Confidence level from computeBusyTimes.
 * @param {boolean} params.alreadyCheckedIn - Whether the member has already checked in today.
 * @param {number|null|undefined} params.lastAlertHoursAgo - Hours since the last alert was
 *   sent to this member, or null/undefined if never alerted.
 * @returns {boolean}
 */
function shouldAlertQuiet({ currentScore, confidence, alreadyCheckedIn, lastAlertHoursAgo }) {
    if (confidence !== 'good') return false;      // don't guess at people's evenings
    if (alreadyCheckedIn) return false;
    if (typeof currentScore !== 'number') return false;
    if (currentScore > QUIET_SCORE_THRESHOLD) return false;
    if (typeof lastAlertHoursAgo === 'number' && lastAlertHoursAgo < ALERT_COOLDOWN_HOURS) return false;
    return true;
}

/** Current IST day-of-week (0=Sun) and hour. */
function istNowParts(now = new Date()) {
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return { dow: ist.getUTCDay(), hour: ist.getUTCHours() };
}

/**
 * Batch: one pass per gym, then per member of that gym.
 * @returns {Promise<{sent: number, skipped: number}>}
 */
async function runQuietAlerts() {
    let sent = 0;
    let skipped = 0;
    const { dow, hour } = istNowParts();

    const gyms = await query(`SELECT id FROM gyms`);

    for (const gym of gyms.rows) {
        const history = await query(
            `SELECT
               EXTRACT(DOW  FROM checked_in_at AT TIME ZONE 'Asia/Kolkata')::int AS dow,
               EXTRACT(HOUR FROM checked_in_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
               COUNT(*)::int AS arrivals
             FROM attendances
             WHERE gym_id = $1 AND checked_in_at > NOW() - INTERVAL '8 weeks'
             GROUP BY 1, 2`,
            [gym.id]
        );

        const busy = computeBusyTimes(history.rows);
        if (busy.confidence !== 'good' || !busy.grid) { skipped++; continue; }

        const currentScore = busy.grid[dow][hour];

        const members = await query(
            `SELECT u.id,
                    EXTRACT(EPOCH FROM (NOW() - u.quiet_alert_sent_at)) / 3600 AS hours_since_alert,
                    EXISTS (
                      SELECT 1 FROM attendances a
                       WHERE a.user_id = u.id
                         AND DATE(a.checked_in_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE
                    ) AS checked_in_today
               FROM users u
              WHERE u.gym_id = $1 AND u.role = 'member'`,
            [gym.id]
        );

        for (const m of members.rows) {
            // NULL (never alerted) must read as "cooldown satisfied", not 0 hours.
            const lastAlertHoursAgo = m.hours_since_alert === null
                ? null
                : Number(m.hours_since_alert);

            const decision = shouldAlertQuiet({
                currentScore,
                confidence: busy.confidence,
                alreadyCheckedIn: m.checked_in_today,
                lastAlertHoursAgo,
            });
            if (!decision) { skipped++; continue; }

            try {
                const result = await pushNotifications.sendToUser(m.id, {
                    title: 'Your gym is quiet right now',
                    body: 'Good window for a session — fewer people than usual.',
                    // Top level: sendToUser reads notification.type to check the
                    // user's mute toggle. Nested in `data` it would be invisible.
                    type: 'quiet_hours',
                    data: { type: 'quiet_hours' },
                });

                // Only stamp the cooldown when something was actually delivered.
                // Stamping on a muted/tokenless user would suppress a future
                // alert they never received.
                if (result && result.success) {
                    await query(
                        `UPDATE users SET quiet_alert_sent_at = NOW() WHERE id = $1`,
                        [m.id]
                    );
                    sent++;
                } else {
                    skipped++;
                }
            } catch {
                skipped++;
            }
        }
    }

    return { sent, skipped };
}

module.exports = {
    shouldAlertQuiet,
    runQuietAlerts,
    QUIET_SCORE_THRESHOLD,
    ALERT_COOLDOWN_HOURS,
};
