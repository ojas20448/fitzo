const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('../config/database');
const contextPackService = require('./contextPack');
const pushNotifications = require('./pushNotifications');

if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️  GEMINI_API_KEY not set — AI Daily Insights will fail');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Mirrors gemini.js. This module builds its own client, so it did not inherit the
// timeout that was added there specifically to stop Gemini calls hanging (observed:
// 150s, zero bytes, no error). Unguarded, a hung generation holds a Render worker.
const REQUEST_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10);
const REQUEST_OPTIONS = { timeout: REQUEST_TIMEOUT_MS };

/** Shown when generation fails. Deliberately never written to daily_insights. */
const FALLBACK_NOTE = "Keep showing up and stay consistent with your workout targets today! You've got this.";

/**
 * Generates today's proactive daily insight for a user using their 14-day context pack.
 * The note is in plain English, action-oriented, and extremely concise.
 *
 * @param {string} userId - User UUID
 * @returns {Promise<string>} The generated insight string
 */
async function generateDailyInsight(userId, options = {}) {
    const { sendPush = true } = options;
    // 1. Fetch user's Context Pack
    const contextPack = await contextPackService.getContextPack(userId);

    // 2. Format Context Pack for Gemini prompt
    let contextStr = '';
    if (contextPack) {
        const { profile, streak, training, nutrition, readiness, activeSplit, todayIntent, wearables, weightHistory } = contextPack;
        
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

        if (wearables && wearables.length > 0) {
            contextStr += `\n- Wearable tracking: ${wearables.slice(0, 3).map(w => `${w.date}: ${w.steps} steps, ${w.active_calories} cal`).join('; ')}`;
        }

        if (weightHistory && weightHistory.length > 0) {
            contextStr += `\n- Weight history: ${weightHistory.slice(0, 3).map(w => `${w.log_date}: ${w.weight}kg`).join(', ')}`;
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
        const model = genAI.getGenerativeModel(
            { model: process.env.GEMINI_MODEL || 'gemini-flash-latest' },
            REQUEST_OPTIONS,
        );
        const result = await model.generateContent(prompt);
        const response = await result.response;
        generatedNote = response.text().trim();

        // `.text()` can return empty rather than throw when the candidate was
        // blocked or truncated. Treat that as a failure instead of caching "".
        if (!generatedNote) {
            const finishReason = response.candidates?.[0]?.finishReason;
            throw new Error(
                `empty candidate (finishReason=${finishReason}, ` +
                `blockReason=${response.promptFeedback?.blockReason})`,
            );
        }
    } catch (error) {
        console.error(`Gemini daily insight failed for user ${userId}:`, error.message);

        // Return the fallback for display, but DO NOT persist it.
        //
        // This used to fall through to the INSERT below, which has
        // ON CONFLICT DO UPDATE — so a single transient failure wrote the generic
        // string into today's row and locked the user into it for the rest of the
        // day, long after Gemini recovered. That is why production insights read
        // "Keep showing up and stay consistent…" instead of anything personal.
        // Leaving the row absent means the next request simply tries again.
        return FALLBACK_NOTE;
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

    // 4. Send Push Notification (only for scheduled/batch generation —
    //    skip when the user requested it in-app, they're already looking at it)
    if (sendPush) {
        try {
            await pushNotifications.sendToUser(userId, {
                title: "Coach's Daily Insight",
                body: savedNote,
                type: 'general'
            });
        } catch (notificationError) {
            console.error('Failed to trigger daily insight push notification:', notificationError.message);
        }
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

    // Miss: warm the cache in the background and answer immediately.
    //
    // This used to `await generateDailyInsight(...)`, putting a live Gemini call
    // (~6-7s measured in production) on the critical path of the home screen. The
    // nightly cron only covers users active in the last 7 days, so 44 of 47 users —
    // every new install — hit this path on their first open of the day and waited out
    // the generation behind a "Server is waking up" banner. Nobody should wait on
    // Gemini for a decorative strip; the next open reads the row this warms.
    generateDailyInsight(userId, { sendPush: false }).catch((err) => {
        console.error(`Background daily insight failed for user ${userId}:`, err.message);
    });
    return null;
}

/**
 * Triggers morning insights generation for all active users (used by daily cron job).
 */
async function generateAllDailyInsights() {
    console.log('Starting batch daily insights generation...');
    // Users who logged a workout, calorie item, or checked in within the last 7 days —
    // plus anyone who signed up in that window. Activity alone left every new install
    // uncovered (they have none yet), so the people arriving from the store were exactly
    // the ones with no precomputed insight on their first open.
    const activeUsers = await query(
        `SELECT DISTINCT u.id FROM users u
         LEFT JOIN workout_sessions s ON s.user_id = u.id AND s.completed_at >= NOW() - INTERVAL '7 days'
         LEFT JOIN calorie_logs c ON c.user_id = u.id AND c.logged_date >= CURRENT_DATE - INTERVAL '7 days'
         LEFT JOIN attendances a ON a.user_id = u.id AND a.check_date >= CURRENT_DATE - INTERVAL '7 days'
         WHERE s.id IS NOT NULL OR c.id IS NOT NULL OR a.id IS NOT NULL
            OR u.created_at >= NOW() - INTERVAL '7 days'`
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
