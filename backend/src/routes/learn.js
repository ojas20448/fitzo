const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, NotFoundError, asyncHandler } = require('../utils/errors');

/**
 * GET /api/learn/lessons
 * Get all lessons grouped by unit
 */
router.get('/lessons', authenticate, asyncHandler(async (req, res) => {
    try {
        const userId = req.user.id;
        if (process.env.NODE_ENV !== 'production') console.log('GET /lessons request for user:', userId);

        // Get all lessons with completion status
        const lessonsResult = await query(
            `SELECT 
       l.id,
       l.title,
       l.unit,
       l.unit_title,
       l.order_index,
       l.description,
       l.xp_reward,
       CASE WHEN la.completed THEN true ELSE false END as completed,
       la.score as last_score
     FROM learn_lessons l
     LEFT JOIN (
       SELECT DISTINCT ON (lesson_id) lesson_id, completed, score
       FROM learn_attempts
       WHERE user_id = $1
       ORDER BY lesson_id, attempted_at DESC
     ) la ON l.id = la.lesson_id
     ORDER BY l.unit, l.order_index`,
            [userId]
        );

        if (process.env.NODE_ENV !== 'production') console.log('Lessons query successful, row count:', lessonsResult.rows.length);

        // Group by unit
        const unitsMap = new Map();
        let foundNext = false;

        for (const lesson of lessonsResult.rows) {
            if (!unitsMap.has(lesson.unit)) {
                unitsMap.set(lesson.unit, {
                    number: lesson.unit,
                    title: lesson.unit_title,
                    lessons: []
                });
            }

            const isNext = !foundNext && !lesson.completed;
            if (isNext) foundNext = true;

            unitsMap.get(lesson.unit).lessons.push({
                id: lesson.id,
                title: lesson.title,
                description: lesson.description,
                completed: lesson.completed,
                last_score: lesson.last_score,
                xp_reward: lesson.xp_reward,
                is_next: isNext
            });
        }

        // Get user progress
        const progressResult = await query(
            `SELECT 
       (SELECT xp_points FROM users WHERE id = $1) as total_xp,
       COUNT(*) FILTER (WHERE la.completed) as lessons_completed
     FROM learn_attempts la
     WHERE la.user_id = $1`,
            [userId]
        );

        if (process.env.NODE_ENV !== 'production') console.log('Progress query successful');

        const progress = progressResult.rows[0];

        res.json({
            units: Array.from(unitsMap.values()),
            progress: {
                total_xp: progress.total_xp || 0,
                lessons_completed: parseInt(progress.lessons_completed) || 0,
                current_streak: 0 // Could track learning streak separately
            }
        });
    } catch (error) {
        console.error('CRITICAL ERROR in GET /lessons:', error);
        throw error;
    }
}));

/**
 * GET /api/learn/lessons/:id
 * Get a specific lesson with questions
 */
router.get('/lessons/:id', authenticate, asyncHandler(async (req, res) => {
    const lessonId = req.params.id;

    const result = await query(
        `SELECT id, title, unit, unit_title, description, content, questions, xp_reward
     FROM learn_lessons
     WHERE id = $1`,
        [lessonId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError("Lesson not found");
    }

    const lesson = result.rows[0];

    // Parse questions and remove correct answers for client
    const questions = lesson.questions.map((q, index) => ({
        index,
        question: q.question,
        options: q.options
        // Don't send 'correct' to client
    }));

    res.json({
        lesson: {
            id: lesson.id,
            title: lesson.title,
            unit: lesson.unit,
            unit_title: lesson.unit_title,
            description: lesson.description,
            content: lesson.content,
            xp_reward: lesson.xp_reward,
            questions
        }
    });
}));

/**
 * POST /api/learn/attempt
 * Submit a lesson attempt
 */
router.post('/attempt', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { lesson_id, answers } = req.body;

    if (!lesson_id || !answers || !Array.isArray(answers)) {
        throw new ValidationError('Please answer all questions');
    }

    // Get lesson with questions
    const lessonResult = await query(
        `SELECT id, questions, xp_reward FROM learn_lessons WHERE id = $1`,
        [lesson_id]
    );

    if (lessonResult.rows.length === 0) {
        throw new NotFoundError("Lesson not found");
    }

    const lesson = lessonResult.rows[0];
    const questions = lesson.questions;

    if (answers.length !== questions.length) {
        throw new ValidationError('Please answer all questions');
    }

    // Calculate score
    let correct = 0;
    const correctAnswers = [];

    for (let i = 0; i < questions.length; i++) {
        correctAnswers.push(questions[i].correct);
        if (answers[i] === questions[i].correct) {
            correct++;
        }
    }

    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= 70;
    const xpEarned = passed ? lesson.xp_reward : Math.floor(lesson.xp_reward * 0.25);

    // Record attempt
    await query(
        `INSERT INTO learn_attempts (user_id, lesson_id, score, completed, xp_earned)
     VALUES ($1, $2, $3, $4, $5)`,
        [userId, lesson_id, score, passed, xpEarned]
    );

    // Update user XP
    await query(
        `UPDATE users SET xp_points = xp_points + $1 WHERE id = $2`,
        [xpEarned, userId]
    );

    res.json({
        score,
        correct_count: correct,
        total_questions: questions.length,
        correct_answers: correctAnswers,
        passed,
        xp_earned: xpEarned,
        message: passed ? "Great job! 🎉" : "Keep practicing! 💪"
    });
}));

/**
 * GET /api/learn/progress
 * Get user's learning progress
 */
router.get('/progress', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT 
       u.xp_points,
       COUNT(DISTINCT la.lesson_id) FILTER (WHERE la.completed) as lessons_completed,
       COUNT(DISTINCT l.id) as total_lessons
     FROM users u
     LEFT JOIN learn_attempts la ON u.id = la.user_id
     LEFT JOIN learn_lessons l ON true
     WHERE u.id = $1
     GROUP BY u.xp_points`,
        [userId]
    );

    const progress = result.rows[0] || { xp_points: 0, lessons_completed: 0, total_lessons: 0 };

    res.json({
        xp_points: progress.xp_points || 0,
        lessons_completed: parseInt(progress.lessons_completed) || 0,
        total_lessons: parseInt(progress.total_lessons) || 0,
        percentage: progress.total_lessons > 0
            ? Math.round((progress.lessons_completed / progress.total_lessons) * 100)
            : 0
    });
}));

module.exports = router;
