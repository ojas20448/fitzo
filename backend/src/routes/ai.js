const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini');
const { authenticate } = require('../middleware/auth');

// Generate personalized workout plan
router.post('/workout-plan', authenticate, async (req, res) => {
    try {
        const { goal, fitnessLevel, daysPerWeek, equipment } = req.body;

        const userProfile = {
            goal: goal || 'general fitness',
            fitnessLevel: fitnessLevel || 'beginner',
            daysPerWeek: daysPerWeek || 3,
            equipment: equipment || 'bodyweight'
        };

        const plan = await geminiService.generateWorkoutPlan(userProfile);
        res.json({ success: true, plan });
    } catch (error) {
        console.error('Error generating workout plan:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get nutrition advice
router.post('/nutrition-advice', authenticate, async (req, res) => {
    try {
        const { goal, currentWeight, targetWeight, activityLevel } = req.body;

        const userProfile = {
            goal: goal || 'maintain weight',
            currentWeight: currentWeight || 70,
            targetWeight: targetWeight || 70,
            activityLevel: activityLevel || 'moderate'
        };

        const advice = await geminiService.getNutritionAdvice(userProfile);
        res.json({ success: true, advice });
    } catch (error) {
        console.error('Error getting nutrition advice:', error);
        res.status(500).json({ error: error.message });
    }
});

// Chat with AI coach
router.post('/chat', authenticate, async (req, res) => {
    try {
        const { question, context } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        const response = await geminiService.chatWithCoach(question, context || {});
        res.json({ success: true, response });
    } catch (error) {
        console.error('Error in AI chat:', error);
        res.status(500).json({ error: error.message });
    }
});

// Analyze exercise form
router.post('/analyze-form', authenticate, async (req, res) => {
    try {
        const { exerciseName, description } = req.body;

        if (!exerciseName || !description) {
            return res.status(400).json({ error: 'Exercise name and description are required' });
        }

        const analysis = await geminiService.analyzeForm(exerciseName, description);
        res.json({ success: true, analysis });
    } catch (error) {
        console.error('Error analyzing form:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
