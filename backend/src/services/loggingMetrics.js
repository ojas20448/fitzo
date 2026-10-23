// Internal, aggregate-only measurement from confirmed database writes. No
// client SDK, food descriptions, body metrics, or external analytics vendor.
const LOGGING_METRICS_SQL = `
WITH accounts AS (
    SELECT id, created_at FROM users
    WHERE role = 'member' AND created_at >= $1::timestamptz
      AND created_at < $2::timestamptz AND created_at < $3::timestamptz
      AND NOT (id = ANY($4::uuid[]))
), activity AS (
    SELECT l.user_id, l.created_at AS saved_at, 'food' AS kind
    FROM calorie_logs l JOIN accounts a ON a.id = l.user_id
    WHERE l.created_at >= a.created_at AND l.created_at < $3::timestamptz
    UNION ALL
    SELECT l.user_id, l.created_at AS saved_at, 'workout' AS kind
    FROM workout_logs l JOIN accounts a ON a.id = l.user_id
    WHERE l.completed = true AND l.created_at >= a.created_at AND l.created_at < $3::timestamptz
    UNION ALL
    SELECT s.user_id, s.completed_at AS saved_at, 'workout' AS kind
    FROM workout_sessions s JOIN accounts a ON a.id = s.user_id
    WHERE s.completed_at >= a.created_at AND s.completed_at < $3::timestamptz
      AND s.source_workout_log_id IS NULL
), first_logs AS (
    SELECT user_id, MIN(saved_at) AS first_saved_at FROM activity GROUP BY user_id
), outcomes AS (
    SELECT a.created_at, f.first_saved_at,
           a.created_at <= $3::timestamptz - INTERVAL '7 days' AS activation_eligible,
           f.first_saved_at < a.created_at + INTERVAL '7 days' AS activated_in_7_days,
           f.first_saved_at <= $3::timestamptz - INTERVAL '14 days' AS retention_eligible,
           EXISTS (
               SELECT 1 FROM activity r WHERE r.user_id = a.id
               AND r.saved_at >= f.first_saved_at + INTERVAL '7 days'
               AND r.saved_at < f.first_saved_at + INTERVAL '14 days'
           ) AS returned_week_2
    FROM accounts a LEFT JOIN first_logs f ON f.user_id = a.id
)
SELECT CASE WHEN GROUPING(DATE_TRUNC('week', created_at AT TIME ZONE 'Asia/Kolkata')::date) = 1
            THEN 'all' ELSE DATE_TRUNC('week', created_at AT TIME ZONE 'Asia/Kolkata')::date::text END AS cohort,
       COUNT(*)::int AS signups,
       COUNT(first_saved_at)::int AS first_log_users,
       COUNT(*) FILTER (WHERE activation_eligible)::int AS activation_eligible,
       COUNT(*) FILTER (WHERE activation_eligible AND activated_in_7_days)::int AS activated_in_7_days,
       COUNT(*) FILTER (WHERE NOT activation_eligible)::int AS activation_pending,
       COUNT(*) FILTER (WHERE retention_eligible)::int AS retention_eligible,
       COUNT(*) FILTER (WHERE retention_eligible AND returned_week_2)::int AS returned_week_2,
       COUNT(*) FILTER (WHERE first_saved_at IS NOT NULL AND NOT retention_eligible)::int AS retention_pending
FROM outcomes
GROUP BY GROUPING SETS ((), (DATE_TRUNC('week', created_at AT TIME ZONE 'Asia/Kolkata')::date))
ORDER BY cohort`;

const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
function reportOptions({ from, to, asOf = new Date().toISOString(), excludeUserIds = [] }) {
    for (const [name, value] of Object.entries({ from, to, asOf })) {
        if (typeof value !== 'string' || !datePattern.test(value) || !Number.isFinite(Date.parse(value))) {
            throw new Error(`${name} must be a UTC ISO timestamp, e.g. 2026-10-01T00:00:00Z`);
        }
    }
    if (Date.parse(from) >= Date.parse(to)) throw new Error('from must be before to');
    if (!Array.isArray(excludeUserIds) || excludeUserIds.some(id => !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))) {
        throw new Error('Excluded accounts must be UUIDs');
    }
    return { from, to, asOf, excludeUserIds };
}

function percentage(numerator, denominator) {
    return denominator > 0 ? Math.round(numerator / denominator * 1000) / 10 : null;
}

async function loggingMetrics(query, options) {
    const clean = reportOptions(options);
    const result = await query(LOGGING_METRICS_SQL, [clean.from, clean.to, clean.asOf, clean.excludeUserIds]);
    return {
        from: clean.from, to: clean.to, as_of: clean.asOf,
        definitions: {
            first_log: 'A saved food entry or completed workout. Health imports and incomplete workouts are excluded.',
            activation: 'First saved log in [signup, signup + 7 days); rate includes only accounts with a full 7-day observation window.',
            retention: 'Another saved log in [first log + 7 days, first log + 14 days); rate includes only accounts with a full 14-day observation window.',
            cohorts: 'Monday signup weeks in Asia/Kolkata. Activation and retention windows are rolling 24-hour days.',
            history: 'Current saved history; deleting a log can change historical results. Deleted accounts are excluded.',
        },
        cohorts: result.rows.map(row => ({
            ...row,
            activation_percent: percentage(row.activated_in_7_days, row.activation_eligible),
            week_2_retention_percent: percentage(row.returned_week_2, row.retention_eligible),
        })),
    };
}

module.exports = { LOGGING_METRICS_SQL, loggingMetrics, reportOptions };
