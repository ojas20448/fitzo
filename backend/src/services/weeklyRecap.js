const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('../config/database');

if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️  GEMINI_API_KEY not set — AI Weekly Recaps will fail');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Calculates the Monday date string for a given date.
 *
 * @param {Date} date
 * @returns {string} Monday ISO date string (YYYY-MM-DD)
 */
function getStartOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    // Monday is 1, Sunday is 0. If Sunday, adjust back by 6 days. Otherwise, adjust to Monday.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
}

/**
 * Generates a weekly recap summary and metrics for a user.
 *
 * @param {string} userId - User UUID
 * @param {string} [weekStartDate] - YYYY-MM-DD Monday start date (defaults to current week)
 * @returns {Promise<Object>} The persisted recap object
 */
async function generateWeeklyRecap(userId, weekStartDate) {
    const startOfRecapWeek = weekStartDate || getStartOfWeek();

    // 1. Fetch user targets
    const profileResult = await query(
        `SELECT goal_type, target_calories, current_weight, target_weight
         FROM fitness_profiles WHERE user_id = $1`,
        [userId]
    );
    const profile = profileResult.rows[0] || null;

    // 2. Fetch workout session count for the week
    const workoutsResult = await query(
        `SELECT COUNT(id)::int as count FROM workout_sessions
         WHERE user_id = $1 AND completed_at::date >= $2 AND completed_at::date <= $2::date + INTERVAL '6 days'`,
        [userId, startOfRecapWeek]
    );
    const workoutsCount = workoutsResult.rows[0]?.count || 0;

    // 3. Fetch gym attendance count for the week
    const checkinResult = await query(
        `SELECT COUNT(id)::int as count FROM attendances
         WHERE user_id = $1 AND check_date >= $2 AND check_date <= $2::date + INTERVAL '6 days'`,
        [userId, startOfRecapWeek]
    );
    const checkinCount = checkinResult.rows[0]?.count || 0;

    // 4. Fetch average weekly calorie intake
    const nutritionResult = await query(
        `SELECT AVG(calories)::int as avg_calories, AVG(protein)::int as avg_protein,
                AVG(carbs)::int as avg_carbs, AVG(fat)::int as avg_fat
         FROM (
             SELECT logged_date, SUM(calories) as calories, SUM(protein) as protein,
                    SUM(carbs) as carbs, SUM(fat) as fat
             FROM calorie_logs
             WHERE user_id = $1 AND logged_date >= $2 AND logged_date <= $2::date + INTERVAL '6 days'
             GROUP BY logged_date
         ) daily_totals`,
        [userId, startOfRecapWeek]
    );
    const nutritionAvg = nutritionResult.rows[0] || { avg_calories: 0, avg_protein: 0, avg_carbs: 0, avg_fat: 0 };

    // 5. Fetch weight change
    const weightResult = await query(
        `SELECT weight FROM body_measurements
         WHERE user_id = $1 AND weight IS NOT NULL 
           AND recorded_at::date >= $2 AND recorded_at::date <= $2::date + INTERVAL '6 days'
         ORDER BY recorded_at DESC`,
        [userId, startOfRecapWeek]
    );
    const weights = weightResult.rows.map(w => parseFloat(w.weight));
    let weightTrend = 'stable';
    if (weights.length > 1) {
        const diff = weights[0] - weights[weights.length - 1];
        if (diff > 0.2) weightTrend = 'loss';
        else if (diff < -0.2) weightTrend = 'gain';
    }

    // 6. Fetch check-in streak
    const streakResult = await query(`SELECT get_user_streak($1) as streak`, [userId]);
    const streakDays = streakResult.rows[0]?.streak || 0;

    // 7. Compose data payload
    const recapData = {
        workouts_count: workoutsCount,
        checkin_count: checkinCount,
        avg_calories: nutritionAvg.avg_calories || 0,
        avg_protein: nutritionAvg.avg_protein || 0,
        avg_carbs: nutritionAvg.avg_carbs || 0,
        avg_fat: nutritionAvg.avg_fat || 0,
        streak_days: streakDays,
        weight_trend: weightTrend,
        target_calories: profile?.target_calories || 0
    };

    // 8. Generate summary using Gemini
    const prompt = `You are an expert fitness coach writing a weekly recap report for a gym member.
Analyze their stats for this past week and generate a motivating summary.

Weekly Stats:
- Workouts completed: ${workoutsCount}
- Gym check-ins: ${checkinCount}
- Average daily calorie intake: ${recapData.avg_calories} kcal (Target: ${recapData.target_calories} kcal)
- Average macronutrients: Protein ${recapData.avg_protein}g, Carbs ${recapData.avg_carbs}g, Fat ${recapData.avg_fat}g
- Gym streak: ${streakDays} days
- Weight trend: ${weightTrend}

CRITICAL SUMMARY INSTRUCTIONS:
- The text must be in plain, grammatically correct ENGLISH only. Do NOT use Hinglish or Hindi.
- Keep it extremely concise. Maximum of 3 sentences (under 60 words).
- Reference their exact weekly metrics in the report. Highlight successes (e.g. workouts completed, calorie alignment, streaks) and suggest a focus for the next week.
- Sound encouraging, expert, and professional.

Provide the weekly summary report:`;

    let summaryText = '';
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        summaryText = response.text().trim();
    } catch (err) {
        console.error('Gemini error generating weekly recap:', err.message);
        summaryText = `Great job completing ${workoutsCount} workouts and checking in ${checkinCount} times this week. Keep up the high consistency to maintain your ${streakDays}-day streak!`;
    }

    // 9. Persist to database
    const dbResult = await query(
        `INSERT INTO weekly_recaps (user_id, recap_data, summary_text, week_start_date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, week_start_date)
         DO UPDATE SET recap_data = EXCLUDED.recap_data, summary_text = EXCLUDED.summary_text
         RETURNING id, user_id, recap_data, summary_text, week_start_date`,
        [userId, JSON.stringify(recapData), summaryText, startOfRecapWeek]
    );

    return dbResult.rows[0];
}

/**
 * Gets the most recent weekly recap for a user.
 * If today is Monday/Tuesday and no recap exists yet, generates it on-the-fly.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} The weekly recap object or null
 */
async function getLatestWeeklyRecap(userId) {
    const startOfWeek = getStartOfWeek();

    // Query for the current week's recap
    const result = await query(
        `SELECT id, recap_data, summary_text, week_start_date
         FROM weekly_recaps
         WHERE user_id = $1 AND week_start_date = $2`,
        [userId, startOfWeek]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    // Generate on-the-fly if missing
    try {
        return await generateWeeklyRecap(userId, startOfWeek);
    } catch (err) {
        console.error('Failed generating weekly recap on-the-fly:', err.message);
        return null;
    }
}

module.exports = {
    generateWeeklyRecap,
    getLatestWeeklyRecap,
    getStartOfWeek
};
