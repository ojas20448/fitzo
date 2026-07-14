const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('../config/database');
const contextPackService = require('./contextPack');
const pushNotifications = require('./pushNotifications');

if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️  GEMINI_API_KEY not set — AI Daily Insights will fail');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generates today's proactive daily insight for a user using their 14-day context pack.
 * The note is in plain English, action-oriented, and extremely concise.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<string>} The generated insight string
 */
async function generateDailyInsight(userId) {
    // 1. Fetch user's Context Pack
    const contextPack = await contextPackService.getContextPack(userId);

    // 2. Format Context Pack for Gemini prompt
    let contextStr = '';
    if (contextPack) {
        const { profile, streak, training, nutrition, readiness, activeSplit, todayIntent } = contextPack;
        
        contextStr += `User Details:`;
        if (profile) {
            contextStr += `\n- Goal: ${profile.goal_type || 'maintenance'}. Target Calories: ${profile.target_calories || 'N/A'} kcal/day. Weight: ${profile.current_weight || 'N/A'}kg.`;
            if (profile.ai_profile_summary) {
                contextStr += `\n- Background/Injuries: ${profile.ai_profile_summary}`;
            }
        }
        contextStr += `\n- Current gym streak: ${streak} days.`;

        if (training) {
            contextStr += `\n- Training sets per muscle group (last 14 days): ${JSON.stringify(training.volume || {})}`;
            if (training.skippedMuscleGroups && training.skippedMuscleGroups.length > 0) {
                contextStr += `\n- Skipped muscle groups: ${training.skippedMuscleGroups.join(', ')}`;
            }
            if (training.prs && Object.keys(training.prs).length > 0) {
                contextStr += `\n- Personal Records: ${JSON.stringify(training.prs)}`;
            }
        }

        if (nutrition && nutrition.length > 0) {
            contextStr += `\n- Calorie intakes: ${nutrition.slice(0, 3).map(n => `${n.calories}kcal`).join(', ')}`;
        }

        if (readiness && readiness.length > 0) {
            contextStr += `\n- Readiness score today: ${readiness[0].readiness_score}/100. Recommendation: ${readiness[0].recommendation}.`;
        }

        if (activeSplit) {
            contextStr += `\n- Split Program: ${activeSplit.name}`;
        }
        if (todayIntent) {
            contextStr += `\n- Today's Intent: Focus on ${todayIntent.muscle_group} ("${todayIntent.note || 'No notes'}") label "${todayIntent.session_label || 'Normal'}".`;
        }
    }

    const prompt = `You are an expert fitness coach writing a daily morning insight note for a client. 
You must analyze their fitness logs, calorie intake, check-in streaks, and readiness metrics from the past 14 days, and output one punchy, encouragement-filled advice note.

CRITICAL INSTRUCTIONS:
- The output MUST be written in plain, grammatically correct ENGLISH only. Do NOT use Hinglish or Hindi words.
- Keep it extremely concise. Maximum of 2 short sentences (under 40 words).
- Be highly action-oriented and citation-specific. Directly reference their metric trends (e.g., cite their skipped muscle groups, weight changes, calorie averages, or streak size).
- Tone should be motivating and professional (like an elite personal trainer).

${contextStr}

Write the morning insight:`;

    let generatedNote = '';
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        generatedNote = response.text().trim();
    } catch (error) {
        console.error('Gemini API error generating daily insight:', error.message);
        generatedNote = "Keep showing up and stay consistent with your workout targets today! You've got this.";
    }

    // 3. Persist to database (ON CONFLICT log_date update note)
    const result = await query(
        `INSERT INTO daily_insights (user_id, note, log_date)
         VALUES ($1, $2, CURRENT_DATE)
         ON CONFLICT (user_id, log_date)
         DO UPDATE SET note = EXCLUDED.note
         RETURNING note`,
        [userId, generatedNote]
    );

    const savedNote = result.rows[0]?.note || generatedNote;

    // 4. Send Push Notification if push token exists
    try {
        await pushNotifications.sendToUser(userId, {
            title: "Coach's Daily Insight",
            body: savedNote,
            type: 'general'
        });
    } catch (notificationError) {
        console.error('Failed to trigger daily insight push notification:', notificationError.message);
    }

    return savedNote;
}

/**
 * Retrieves today's cached daily insight for a user.
 * If not already generated, creates it on-the-fly.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<string>} Daily insight note
 */
async function getTodayDailyInsight(userId) {
    const result = await query(
        `SELECT note FROM daily_insights
         WHERE user_id = $1 AND log_date = CURRENT_DATE`,
        [userId]
    );

    if (result.rows.length > 0) {
        return result.rows[0].note;
    }

    // Generate on-the-fly if missing
    return await generateDailyInsight(userId);
}

/**
 * Triggers morning insights generation for all active users (used by daily cron job).
 */
async function generateAllDailyInsights() {
    console.log('Starting batch daily insights generation...');
    // Fetch users who logged a workout, calorie item, or checked in within the last 7 days
    const activeUsers = await query(
        `SELECT DISTINCT u.id FROM users u
         LEFT JOIN workout_sessions s ON s.user_id = u.id AND s.completed_at >= NOW() - INTERVAL '7 days'
         LEFT JOIN calorie_logs c ON c.user_id = u.id AND c.logged_date >= CURRENT_DATE - INTERVAL '7 days'
         LEFT JOIN attendances a ON a.user_id = u.id AND a.check_date >= CURRENT_DATE - INTERVAL '7 days'
         WHERE s.id IS NOT NULL OR c.id IS NOT NULL OR a.id IS NOT NULL`
    );

    console.log(`Found ${activeUsers.rows.length} active users to notify.`);
    for (const user of activeUsers.rows) {
        try {
            await generateDailyInsight(user.id);
            console.log(`Generated daily insight for user: ${user.id}`);
        } catch (err) {
            console.error(`Failed generating daily insight for user ${user.id}:`, err.message);
        }
    }
    console.log('Batch daily insights generation finished.');
}

module.exports = {
    generateDailyInsight,
    getTodayDailyInsight,
    generateAllDailyInsights
};
