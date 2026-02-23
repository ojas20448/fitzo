const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { query } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { ValidationError, AuthError, NotFoundError, asyncHandler } = require('../utils/errors');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const { Resend } = require('resend');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../schemas');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID_WEB);
const resend = new Resend(process.env.RESEND_API_KEY);

// Rate limiter for password-based endpoints only (not Google OAuth)
const passwordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: true, message: 'Too many attempts. Please try again in 15 minutes.', code: 'RATE_LIMITED' },
    skip: () => process.env.NODE_ENV === 'development',
});

// Ensure password reset tokens table exists
query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )
`).catch(err => console.error('Could not create password_reset_tokens table:', err.message));

/**
 * POST /api/auth/register
 * Register a new member with gym code
 */
router.post('/register', passwordLimiter, validate({ body: registerSchema }), asyncHandler(async (req, res) => {

    const { email, password, name, gym_code } = req.body;

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
router.post('/login', passwordLimiter, validate({ body: loginSchema }), asyncHandler(async (req, res) => {
    const { email, password } = req.body;

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
    // Block dev-login in production
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: true, message: 'Not found' });
    }

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

    if (process.env.NODE_ENV !== 'production') {
        console.log(`⚠️ Dev Login used for: ${user.email}`);
    }

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

    if (!finalToken) {
        throw new ValidationError('Google token is required');
    }

    // Construct audiences list
    const configuredAudiences = [
        process.env.GOOGLE_CLIENT_ID_WEB,
        process.env.GOOGLE_CLIENT_ID_IOS,
        process.env.GOOGLE_CLIENT_ID_ANDROID,
        process.env.GOOGLE_CLIENT_ID_ANDROID_DEBUG
    ].filter(Boolean);

    console.log('🔐 Google Auth: Verifying token with audiences:', configuredAudiences);

    if (configuredAudiences.length === 0) {
        console.error('❌ No Google Client IDs configured in environment!');
        throw new AuthError('Google authentication not configured on server');
    }

    let email, name, picture, googleId;

    try {
        // First try: Verify as ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: finalToken,
            audience: configuredAudiences
        });

        const payload = ticket.getPayload();
        ({ email, name, picture, sub: googleId } = payload); // Destructure directly

        console.log('✅ Google Token Verified for:', email);
    } catch (idTokenError) {
        if (process.env.NODE_ENV !== 'production') {
            console.log('⚠️  ID token verification failed, trying access token...', idTokenError.message);

            // Attempt to decode the token to log its audience if verification fails
            try {
                const decodedToken = JSON.parse(Buffer.from(finalToken.split('.')[1], 'base64').toString());
                console.log('⚠️  Decoded token audience (aud):', decodedToken.aud);
            } catch (decodeError) {
                console.log('⚠️  Could not decode token for audience check:', decodeError.message);
            }
        }

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
        } catch (accessTokenError) {
            console.error('❌ Google token verification failed:', idTokenError.message, '|', accessTokenError.message);
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
router.post('/forgot-password', passwordLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(async (req, res) => {
    const { email } = req.body;

    const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);

    // Always return success to avoid leaking user existence
    if (userResult.rows.length === 0) {
        return res.json({ success: true, message: 'If an account exists, a reset code has been sent.' });
    }

    // Generate a secure 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Invalidate any existing codes for this email
    await query('UPDATE password_reset_tokens SET used = TRUE WHERE email = $1', [email]);

    // Store new code
    await query(
        'INSERT INTO password_reset_tokens (email, code, expires_at) VALUES ($1, $2, $3)',
        [email, code, expiresAt]
    );

    // Send email via Resend
    await resend.emails.send({
        from: 'Fitzo <noreply@fitzoapp.in>',
        to: email,
        subject: 'Your Fitzo Password Reset Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f172a; color: #f1f5f9; border-radius: 16px;">
                <h1 style="font-size: 24px; margin-bottom: 8px;">🏋️ Reset Your Password</h1>
                <p style="color: #94a3b8; margin-bottom: 32px;">Use the code below to reset your Fitzo password. It expires in 15 minutes.</p>
                <div style="background: #1e293b; border-radius: 12px; padding: 24px; text-align: center; letter-spacing: 0.3em; font-size: 40px; font-weight: bold; color: #6366f1;">
                    ${code}
                </div>
                <p style="color: #64748b; font-size: 13px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
            </div>
        `
    });

    res.json({ success: true, message: 'If an account exists, a reset code has been sent.' });
}));

/**
 * POST /api/auth/reset-password
 * Reset password (Mock implementation for now)
 */
router.post('/reset-password', passwordLimiter, validate({ body: resetPasswordSchema }), asyncHandler(async (req, res) => {
    const { email, newPassword: password, code } = req.body;
    if (password.length < 6) {
        throw new ValidationError('Password must be at least 6 characters');
    }

    // Validate the OTP code
    const tokenResult = await query(
        `SELECT id FROM password_reset_tokens
         WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [email, code]
    );

    if (tokenResult.rows.length === 0) {
        throw new ValidationError('Invalid or expired reset code. Please request a new one.');
    }

    // Mark code as used
    await query('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [tokenResult.rows[0].id]);

    // Update user password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    await query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);

    res.json({ success: true, message: 'Password updated successfully. Please log in.' });
}));

module.exports = router;
