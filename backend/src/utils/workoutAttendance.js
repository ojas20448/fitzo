const { IST_TODAY_SQL } = require('./dayBoundary');

// A completed workout closes an actual visit. Synthetic streak records must
// never claim a gym visit or prevent a later QR check-in.
async function completeWorkoutAttendance(userId, runQuery) {
    await runQuery(
        `UPDATE attendances SET checked_out_at = NOW()
         WHERE user_id = $1 AND checked_out_at IS NULL AND gym_id IS NOT NULL`,
        [userId]
    );
    const result = await runQuery(
        `INSERT INTO attendances (user_id, gym_id, check_date, checked_out_at)
         VALUES ($1, NULL, ${IST_TODAY_SQL}, NOW())
         ON CONFLICT (user_id, check_date) DO NOTHING
         RETURNING id`,
        [userId]
    );
    return result.rows.length > 0;
}

module.exports = { completeWorkoutAttendance };
