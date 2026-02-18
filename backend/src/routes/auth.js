const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { ValidationError, AuthError, asyncHandler } = require('../utils/errors');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID_WEB);

/**
 * POST /api/auth/register
 * Register a new member with gym code
 */
router.post('/register', asyncHandler(async (req, res) => {
    const { email, password, name, gym_code } = req.body;

    // Validation
    if (!email || !password || !name) {
        throw new ValidationError('Please fill in all required fields');
    }

    if (password.length < 6) {
        throw new ValidationError('Password must be at least 6 characters');
    }

    // Find gym by QR code (optional)
    let gym = null;
    if (gym_code && gym_code.trim()) {
        const gymResult = await query(
            'SELECT id, name FROM gyms WHERE qr_code = $1',
            [gym_code.trim().toUpperCase()]
        );

        if (gymResult.rows.length === 0) {
            throw new ValidationError('Invalid gym code. Please check and try again.');
        }
        gym = gymResult.rows[0];
    }

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
        [email.toLowerCase(), password_hash, name, gym ? gym.id : null, username]
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
            gym_name: gym ? gym.name : null,
            xp_points: user.xp_points || 0,
            onboarding_completed: false
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
        `SELECT u.id, u.email, u.password_hash, u.name, u.username, u.role, u.gym_id, u.xp_points, u.avatar_url, g.name as gym_name
     FROM users u
     LEFT JOIN gyms g ON u.gym_id = g.id
     WHERE u.email = $1`,
        [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
        throw new AuthError('Email or password is incorrect', 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];

    // Check onboarding status
    const profileResult = await query('SELECT id FROM nutrition_profiles WHERE user_id = $1', [user.id]);
    const onboarding_completed = profileResult.rows.length > 0;

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
            username: user.username,
            role: user.role,
            gym_id: user.gym_id,
            gym_name: user.gym_name,
            xp_points: user.xp_points || 0,
            avatar_url: user.avatar_url,
            onboarding_completed
        }
    });
}));

/**
 * GET /api/auth/me
 * Get current user info (requires auth)
 */
router.get('/me', require('../middleware/auth').authenticate, asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT u.id, u.email, u.name, u.username, u.role, u.gym_id, u.xp_points, u.avatar_url, g.name as gym_name
     FROM users u
     LEFT JOIN gyms g ON u.gym_id = g.id
     WHERE u.id = $1`,
        [req.user.id]
    );

    const user = result.rows[0];

    // Check onboarding status
    const profileResult = await query('SELECT id FROM nutrition_profiles WHERE user_id = $1', [user.id]);
    const onboarding_completed = profileResult.rows.length > 0;

    res.json({
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username,
            role: user.role,
            gym_id: user.gym_id,
            gym_name: user.gym_name,
            xp_points: user.xp_points || 0,
            avatar_url: user.avatar_url,
            onboarding_completed
        }
    });
}));


/**
 * POST /api/auth/dev-login
 * Bypass login for development (auto-login as first user)
 */
router.post('/dev-login', asyncHandler(async (req, res) => {
    // Dev/demo login - get the demo user for quick access
    // Get any user (preferably demo)
    const result = await query(
        `SELECT u.id, u.email, u.password_hash, u.name, u.username, u.role, u.gym_id, u.xp_points, u.avatar_url, g.name as gym_name
         FROM users u
         LEFT JOIN gyms g ON u.gym_id = g.id
         ORDER BY u.created_at ASC
         LIMIT 1`
    );

    if (result.rows.length === 0) {
        throw new AuthError('No users found in database', 'USER_NOT_FOUND');
    }

    const user = result.rows[0];
    const token = generateToken(user.id);

    console.log(`⚠️ Dev Login used for: ${user.email}`);

    res.json({
        message: `Dev Login: Welcome ${user.name}! 🛠️`,
        token,
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            username: user.username,
            role: user.role,
            gym_id: user.gym_id,
            gym_name: user.gym_name,
            xp_points: user.xp_points || 0,
            avatar_url: user.avatar_url
        }
    });
}));


/**
 * POST /api/auth/google
 * Google OAuth Login
 */
router.post('/google', asyncHandler(async (req, res) => {
    const { token, idToken } = req.body;
    const finalToken = token || idToken;

    console.log('🔐 Google OAuth request received');
    console.log('Token type:', idToken ? 'idToken' : 'accessToken');
    console.log('Token length:', finalToken?.length || 0);

    if (!finalToken) {
        throw new ValidationError('Google token is required');
    }

    // Check if environment variables are set
    const configuredAudiences = [
        process.env.GOOGLE_CLIENT_ID_WEB,
        process.env.GOOGLE_CLIENT_ID_IOS,
        process.env.GOOGLE_CLIENT_ID_ANDROID
    ].filter(Boolean);

    console.log('📋 Configured audiences count:', configuredAudiences.length);
    if (configuredAudiences.length === 0) {
        console.error('❌ No Google Client IDs configured in environment!');
        throw new AuthError('Google authentication not configured on server');
    }

    let email, name, picture, googleId;

    try {
        // First try: Verify as ID token
        console.log('🔍 Attempting ID token verification...');
        const ticket = await googleClient.verifyIdToken({
            idToken: finalToken,
            audience: configuredAudiences
        });

        const payload = ticket.getPayload();
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
        googleId = payload.sub;
        console.log('✅ ID token verified successfully for:', email);
    } catch (idTokenError) {
        console.log('⚠️  ID token verification failed:', idTokenError.message);
        console.log('🔄 Trying as access token...');
        
        try {
            // Fallback: Treat as access_token and fetch user info from Google
            const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${finalToken}` }
            });
            
            const userInfo = userInfoResponse.data;
            email = userInfo.email;
            name = userInfo.name;
            picture = userInfo.picture;
            googleId = userInfo.sub;
            
            if (!email) {
                throw new Error('Could not get email from Google token');
            }
            console.log('✅ Access token verified successfully for:', email);
        } catch (accessTokenError) {
            console.error('❌ Both token verification methods failed');
            console.error('ID Token Error:', idTokenError.message);
            console.error('Access Token Error:', accessTokenError.message);
            if (accessTokenError.response) {
                console.error('Access Token Response:', accessTokenError.response.data);
            }
            throw new AuthError('Google login failed: Invalid authentication token');
        }
    }

    try {

        // Check if user exists
        const userResult = await query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        let user = userResult.rows[0];

        if (!user) {
            // Create new user from Google
            // Generate unique username from email
            let username = email.split('@')[0];
            const existingUsername = await query('SELECT id FROM users WHERE username = $1', [username]);
            if (existingUsername.rows.length > 0) {
                username += Math.floor(Math.random() * 1000);
            }

            // Generate random password since they use Google
            const randomPassword = Math.random().toString(36).slice(-8);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);

            const newUser = await query(
                `INSERT INTO users (email, password_hash, name, username, avatar_url, role)
                 VALUES ($1, $2, $3, $4, $5, 'member')
                 RETURNING id, email, name, username, role, avatar_url, xp_points`,
                [email, hashedPassword, name, username, picture]
            );
            user = newUser.rows[0];

            // Create fitness profile
            await query(
                `INSERT INTO fitness_profiles (user_id) VALUES ($1)`,
                [user.id]
            );
        } else {
            // Update avatar if not set
            if (!user.avatar_url && picture) {
                await query(
                    'UPDATE users SET avatar_url = $1 WHERE id = $2',
                    [picture, user.id]
                );
                user.avatar_url = picture;
            }
        }

        // Check onboarding status
        const profileCheck = await query('SELECT id FROM nutrition_profiles WHERE user_id = $1', [user.id]);
        const onboarding_completed = profileCheck.rows.length > 0;

        // Generate Token using helper
        const jwtToken = generateToken(user.id);

        res.json({
            message: `Welcome ${user.name}! 💪`,
            token: jwtToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                username: user.username,
                role: user.role,
                avatar_url: user.avatar_url,
                xp_points: user.xp_points || 0,
                onboarding_completed
            }
        });

    } catch (error) {
        console.error('Google Auth Error:', error);
        throw new AuthError('Google login failed: ' + error.message);
    }
}));

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) throw new ValidationError('Email is required');

    const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
        // Don't reveal user existence
        return res.json({
            success: true,
            message: 'If an account exists, a reset code has been sent.'
        });
    }

    // In a real app, generate token/code and email it.
    // For this MVP, we'll just return success and log for debugging
    console.log(`[DEV] Forgot Password requested for: ${email}`);

    res.json({
        success: true,
        message: 'If an account exists, a reset code has been sent.'
    });
}));

/**
 * POST /api/auth/reset-password
 * Reset password (Mock implementation for now)
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
    const { email, password, code } = req.body;

    // Validate inputs...

    // For MVP, just update password directly if email matches
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await query(
        'UPDATE users SET password_hash = $1 WHERE email = $2',
        [hashedPassword, email]
    );

    res.json({ success: true, message: 'Password updated successfully' });
}));

module.exports = router;
