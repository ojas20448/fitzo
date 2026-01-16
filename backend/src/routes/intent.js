const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { ValidationError, asyncHandler } = require('../utils/errors');

// Valid training patterns (optional)
const VALID_PATTERNS = [
    'push', 'pull', 'legs', 'upper', 'lower',
    'anterior', 'posterior', 'full_body', 'bro_split',
    'ppl', 'upper_lower', 'cardio', 'rest', 'custom'
];

// Valid emphasis options (multi-select)
const VALID_EMPHASIS = [
    'chest', 'back', 'shoulders', 'arms',
    'quads', 'hamstrings', 'glutes', 'calves',
    'cardio', 'rest'
];

const VALID_VISIBILITY = ['public', 'friends', 'private'];
const VALID_SESSION_LABELS = ['A', 'B', null];

// Format pattern for display
const formatPattern = (p) => {
    if (!p) return null;
    const labels = {
        push: 'Push', pull: 'Pull', legs: 'Legs',
        upper: 'Upper', lower: 'Lower',
        anterior: 'Anterior', posterior: 'Posterior',
        full_body: 'Full Body', bro_split: 'Bro Split', custom: 'Custom'
    };
    return labels[p] || p;
};

// Format emphasis for display
const formatEmphasis = (arr) => {
    if (!arr || arr.length === 0) return 'Training';
    const labels = {
        chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
        quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
        cardio: 'Cardio', rest: 'Rest'
    };
    return arr.map(e => labels[e] || e).join(' & ');
};

// Build display string
const buildDisplay = (pattern, emphasis, label) => {
    const parts = [];
    if (pattern) parts.push(formatPattern(pattern));
    parts.push(formatEmphasis(emphasis));
    if (label) parts.push(label);
    return parts.join(' · ');
};

/**
 * POST /api/intent
 * Set today's workout intent with composable emphasis
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
        training_pattern = null,
        emphasis = [],
        session_label = null,
        visibility = 'friends'
    } = req.body;

    // Validation
    if (training_pattern && !VALID_PATTERNS.includes(training_pattern)) {
        throw new ValidationError('Invalid training pattern');
    }

    if (!Array.isArray(emphasis) || emphasis.length === 0) {
        throw new ValidationError('Please select at least one focus area');
    }

    if (!emphasis.every(e => VALID_EMPHASIS.includes(e))) {
        throw new ValidationError('Invalid emphasis selection');
    }

    if (session_label && !['A', 'B'].includes(session_label)) {
        throw new ValidationError('Session label must be A or B');
    }

    if (!VALID_VISIBILITY.includes(visibility)) {
        throw new ValidationError('Invalid visibility setting');
    }

    // Calculate expires_at (end of today)
    const expiresAt = new Date();
    expiresAt.setHours(23, 59, 59, 999);

    // Delete any existing intent for today first
    await query(
        `DELETE FROM workout_intents 
         WHERE user_id = $1 AND expires_at > NOW()`,
        [userId]
    );

    // Create new intent
    const result = await query(
        `INSERT INTO workout_intents (user_id, split_type, emphasis, session_label, visibility, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, split_type, emphasis, session_label, visibility, expires_at`,
        [userId, training_pattern, emphasis, session_label, visibility, expiresAt]
    );

    const intent = result.rows[0];

    res.status(201).json({
        message: "Let's go! 💪",
        intent: {
            id: intent.id,
            training_pattern: intent.split_type,
            emphasis: intent.emphasis,
            session_label: intent.session_label,
            display: buildDisplay(intent.split_type, intent.emphasis, intent.session_label),
            visibility: intent.visibility,
            expires_at: intent.expires_at
        }
    });
}));

/**
 * GET /api/intent
 * Get current user's today's intent
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(
        `SELECT id, split_type, emphasis, session_label, visibility, expires_at, created_at
         FROM workout_intents 
         WHERE user_id = $1 AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return res.json({ intent: null });
    }

    const intent = result.rows[0];

    res.json({
        intent: {
            id: intent.id,
            training_pattern: intent.split_type,
            emphasis: intent.emphasis || [],
            session_label: intent.session_label,
            display: buildDisplay(intent.split_type, intent.emphasis, intent.session_label),
            visibility: intent.visibility,
            expires_at: intent.expires_at
        }
    });
}));

/**
 * GET /api/intent/feed
 * Get friends' workout intents for today
 */
router.get('/feed', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const gymId = req.user.gym_id;

    // Get friend IDs
    const friendsResult = await query(
        `SELECT friend_id 
         FROM friendships 
         WHERE user_id = $1 AND status = 'accepted'`,
        [userId]
    );

    const friendIds = friendsResult.rows.map(r => r.friend_id);

    // Get intents based on visibility rules
    const intentsResult = await query(
        `SELECT 
           wi.id,
           wi.split_type,
           wi.emphasis,
           wi.session_label,
           wi.visibility,
           wi.created_at,
           u.id as user_id,
           u.name as user_name,
           u.avatar_url
         FROM workout_intents wi
         JOIN users u ON wi.user_id = u.id
         WHERE wi.expires_at > NOW()
           AND u.gym_id = $1
           AND wi.user_id != $2
           AND (
             wi.visibility = 'public'
             OR (wi.visibility = 'friends' AND wi.user_id = ANY($3))
           )
         ORDER BY wi.created_at DESC`,
        [gymId, userId, friendIds]
    );

    const intents = intentsResult.rows.map(row => ({
        id: row.id,
        user: {
            id: row.user_id,
            name: row.user_name,
            avatar_url: row.avatar_url
        },
        training_pattern: row.split_type,
        emphasis: row.emphasis || [],
        session_label: row.session_label,
        display: buildDisplay(row.split_type, row.emphasis, row.session_label),
        visibility: row.visibility
    }));

    res.json({ intents });
}));

/**
 * DELETE /api/intent
 * Clear today's intent
 */
router.delete('/', authenticate, asyncHandler(async (req, res) => {
    const userId = req.user.id;

    await query(
        `DELETE FROM workout_intents 
         WHERE user_id = $1 AND expires_at > NOW()`,
        [userId]
    );

    res.json({ message: 'Intent cleared' });
}));

module.exports = router;
