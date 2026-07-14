const { query } = require('../config/database');

/**
 * Awards XP points to a user, logs the transaction, and updates the user's lifetime total.
 *
 * @param {string} userId - User UUID
 * @param {number} amount - XP amount to award
 * @param {string} activityType - 'workout', 'nutrition', 'lesson', 'checkin'
 * @param {string} [referenceId] - Optional UUID reference to the source entity
 * @returns {Promise<void>}
 */
async function awardXP(userId, amount, activityType, referenceId = null) {
    if (!userId || amount <= 0) return;

    try {
        // 1. Insert transaction log
        await query(
            `INSERT INTO xp_logs (user_id, amount, activity_type, reference_id)
             VALUES ($1, $2, $3, $4)`,
            [userId, amount, activityType, referenceId]
        );

        // 2. Increment lifetime XP points in users table
        await query(
            `UPDATE users SET xp_points = xp_points + $1 WHERE id = $2`,
            [amount, userId]
        );
    } catch (err) {
        console.error('Error in awardXP service:', err.message);
    }
}

module.exports = {
    awardXP
};
