const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');
const { validate } = require('../middleware/validate');
const { aiWorkoutPlanSchema, aiChatSchema, aiFormAnalysisSchema } = require('../schemas');

// Generate personalized workout plan
router.post('/workout-plan', authenticate, validate({ body: aiWorkoutPlanSchema }), asyncHandler(async (req, res) => {
    const { goal, fitnessLevel, daysPerWeek, equipment } = req.body;

    const plan = await geminiService.generateWorkoutPlan({
        goal, fitnessLevel, daysPerWeek, equipment
    });
    res.json({ success: true, plan });
}));

// Get nutrition advice
router.post('/nutrition-advice', authenticate, asyncHandler(async (req, res) => {
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

// Chat with AI coach
router.post('/chat', authenticate, validate({ body: aiChatSchema }), asyncHandler(async (req, res) => {
    const { question, context } = req.body;

    const response = await geminiService.chatWithCoach(question, context);
    res.json({ success: true, response });
}));

// Analyze exercise form
router.post('/analyze-form', authenticate, validate({ body: aiFormAnalysisSchema }), asyncHandler(async (req, res) => {
    const { exerciseName, description } = req.body;

    const analysis = await geminiService.analyzeForm(exerciseName, description);
    res.json({ success: true, analysis });
}));

module.exports = router;
