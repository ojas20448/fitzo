const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { ValidationError, AuthError, asyncHandler } = require('../utils/errors');

/**
 * POST /api/auth/register
 * Register a new member with gym code
 */
router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, name, gym_code } = req.body;

    // Validation
    if (!email || !password || !name || !gym_code) {
        throw new ValidationError('Please fill in all fields');
    }

    if (password.length < 6) {
        throw new ValidationError('Password must be at least 6 characters');
    }

    // Find gym by QR code
    const gymResult = await query(
        'SELECT id, name FROM gyms WHERE qr_code = $1',
        [gym_code.toUpperCase()]
    );

    if (gymResult.rows.length === 0) {
        throw new ValidationError('Invalid gym code. Please check and try again.');
    }

    const gym = gymResult.rows[0];

    // Check if email already exists
    const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
        throw new ValidationError('An account with this email already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Generate username from email (ensure it's unique-ish by appending random if needed, but for now simple)
    let username = email.split('@')[0];
    // Check if username exists, if so append random string
    const existingUsername = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUsername.rows.length > 0) {
        username += Math.floor(Math.random() * 1000);
    }

    // Create user
    const result = await query(
        `INSERT INTO users (email, password_hash, name, role, gym_id, username)
         VALUES ($1, $2, $3, 'member', $4, $5)
         RETURNING id, email, name, role, gym_id, xp_points, username`,
        [email.toLowerCase(), password_hash, name, gym.id, username]
    );

    const user = result.rows[0];
    const token = generateToken(user.id);


    res.status(201).json({
        message: 'Welcome to Fitzo! 💪',
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            gym_id: user.gym_id,
            gym_name: gym.name,
            xp_points: user.xp_points || 0
        }
    });
}));

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new ValidationError('Please enter your email and password');
    }

    // Find user
    const result = await query(
        `SELECT u.id, u.email, u.password_hash, u.name, u.role, u.gym_id, u.xp_points, u.avatar_url, g.name as gym_name
     FROM users u
     LEFT JOIN gyms g ON u.gym_id = g.id
     WHERE u.email = $1`,
        [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
        throw new AuthError('Email or password is incorrect', 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
        throw new AuthError('Email or password is incorrect', 'INVALID_CREDENTIALS');
    }

    const token = generateToken(user.id);

    res.json({
        message: `Welcome back, ${user.name}! 💪`,
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            gym_id: user.gym_id,
            gym_name: user.gym_name,
            xp_points: user.xp_points || 0,
            avatar_url: user.avatar_url
        }
    });
}));

/**
 * GET /api/auth/me
 * Get current user info (requires auth)
 */
router.get('/me', require('../middleware/auth').authenticate, asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT u.id, u.email, u.name, u.role, u.gym_id, u.xp_points, u.avatar_url, g.name as gym_name
     FROM users u
     LEFT JOIN gyms g ON u.gym_id = g.id
     WHERE u.id = $1`,
        [req.user.id]
    );

    const user = result.rows[0];

    res.json({
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            gym_id: user.gym_id,
            gym_name: user.gym_name,
            xp_points: user.xp_points || 0,
            avatar_url: user.avatar_url
        }
    });
}));

module.exports = router;
