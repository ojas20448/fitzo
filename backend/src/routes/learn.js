const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, NotFoundError, asyncHandler } = require('../utils/errors');
const xpService = require('../services/xpService');

/**
 * GET /api/learn/lessons
 * Get the flat lesson library with per-lesson completion status.
 * Every lesson is reachable; suggested_next_id is a suggestion, not a gate.
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
                l.topics,
                l.connects_to,
                l.read_seconds,
                -- Real count. The client previously fell through
                -- lesson.questions?.length || 5 to the literal 5 on every
                -- card, contradicting the reader one tap later.
                jsonb_array_length(l.questions)::int AS question_count,
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

        // Flat list: every lesson is reachable. Ordering is preserved so the
        // optional "Start here" strip can suggest a sequence without gating.
        const lessons = lessonsResult.rows.map((l) => ({
            id: l.id,
            title: l.title,
            description: l.description,
            unit: l.unit,
            unit_title: l.unit_title,
            order_index: l.order_index,
            topics: l.topics || [],
            connects_to: l.connects_to,
            read_seconds: l.read_seconds,
            question_count: l.question_count,
            completed: l.completed,
            last_score: l.last_score,
            xp_reward: l.xp_reward,
        }));

        // Suggestion, not a gate. Named to stop implying the rest are locked.
        const suggested = lessons.find((l) => !l.completed) || null;

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
            lessons,
            progress: {
                total_xp: parseInt(progress.total_xp) || 0,
                lessons_completed: parseInt(progress.lessons_completed) || 0,
                total_lessons: lessons.length,
            },
            suggested_next_id: suggested ? suggested.id : null,
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
    const explanations = [];

    for (let i = 0; i < questions.length; i++) {
        correctAnswers.push(questions[i].correct);
        // Plumbing only. NO seeded question currently carries an explanation
        // (verified: 0 of 22). This stays null until content is authored, at
        // which point it appears with no further code change. Do not invent
        // explanation text here.
        explanations.push(questions[i].explanation ?? null);
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
    await xpService.awardXP(userId, xpEarned, 'lesson', lesson_id);

    res.json({
        score,
        correct_count: correct,
        total_questions: questions.length,
        correct_answers: correctAnswers,
        explanations,
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
