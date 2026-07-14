const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini');
const { authenticate } = require('../middleware/auth');
const { aiQuota, getUsage } = require('../middleware/aiQuota');
const { asyncHandler } = require('../utils/errors');
const { validate } = require('../middleware/validate');
const { aiWorkoutPlanSchema, aiChatSchema, aiFormAnalysisSchema, aiTranscribeSchema } = require('../schemas');
const { query } = require('../config/database');
const contextPackService = require('../services/contextPack');
const dailyInsightService = require('../services/dailyInsight');
const weeklyRecapService = require('../services/weeklyRecap');

// All AI routes require auth. Generation routes also burn quota.
router.use(authenticate);

// Check remaining AI quota (free — does not count against limits)
router.get('/quota', asyncHandler(async (req, res) => {
    const usage = await getUsage(req.user.id);
    res.json({ success: true, ...usage });
}));

// Generate personalized workout plan
router.post('/workout-plan', aiQuota, validate({ body: aiWorkoutPlanSchema }), asyncHandler(async (req, res) => {
    const { goal, fitnessLevel, daysPerWeek, equipment } = req.body;

    const plan = await geminiService.generateWorkoutPlan({
        goal, fitnessLevel, daysPerWeek, equipment
    });
    res.json({ success: true, plan });
}));

// Get nutrition advice
router.post('/nutrition-advice', aiQuota, asyncHandler(async (req, res) => {
    const { goal, currentWeight, targetWeight, activityLevel } = req.body;

    const userProfile = {
        goal: goal || 'maintain weight',
        currentWeight: currentWeight || 70,
        targetWeight: targetWeight || 70,
        activityLevel: activityLevel || 'moderate'
    };

    const advice = await geminiService.getNutritionAdvice(userProfile);
    res.json({ success: true, advice });
}));

// Get chat history with AI coach
router.get('/chat/history', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const result = await query(
        `SELECT id, sender, message, created_at
         FROM coach_messages
         WHERE user_id = $1
         ORDER BY created_at ASC
         LIMIT 50`,
        [userId]
    );
    res.json({ success: true, history: result.rows });
}));

// Get today's proactive daily insight
router.get('/daily-insight', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const insight = await dailyInsightService.getTodayDailyInsight(userId);
    res.json({ success: true, insight });
}));

// Get today's weekly recap
router.get('/weekly-recap', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const recap = await weeklyRecapService.getLatestWeeklyRecap(userId);
    res.json({ success: true, recap });
}));

// Chat with AI coach
router.post('/chat', aiQuota, validate({ body: aiChatSchema }), asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { question } = req.body;

    // 1. Gather context pack (14-day history, targets, streaks, weight, splits)
    const contextPack = await contextPackService.getContextPack(userId);

    // 2. Fetch last 10 turns of message history (ordered chronologically)
    const historyResult = await query(
        `SELECT sender, message, created_at
         FROM coach_messages
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [userId]
    );
    const history = historyResult.rows.reverse();

    // 3. Send query to Gemini
    const aiResponse = await geminiService.chatWithCoach(question, contextPack, history);

    // 4. Persist turns to database
    await query(
        `INSERT INTO coach_messages (user_id, sender, message) VALUES ($1, 'user', $2)`,
        [userId, question]
    );
    await query(
        `INSERT INTO coach_messages (user_id, sender, message) VALUES ($1, 'ai', $2)`,
        [userId, aiResponse]
    );

    res.json({ success: true, response: aiResponse });
}));

// Analyze exercise form
router.post('/analyze-form', aiQuota, validate({ body: aiFormAnalysisSchema }), asyncHandler(async (req, res) => {
    const { exerciseName, description } = req.body;

    const analysis = await geminiService.analyzeForm(exerciseName, description);
    res.json({ success: true, analysis });
}));

// Transcribe audio using Gemini
router.post('/transcribe', aiQuota, validate({ body: aiTranscribeSchema }), asyncHandler(async (req, res) => {
    const { audio, mimeType } = req.body;

    const text = await geminiService.transcribeAudio(audio, mimeType);
    res.json({ success: true, text });
}));

module.exports = router;
