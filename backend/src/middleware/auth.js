const jwt = require('jsonwebtoken');
const { AuthError } = require('../utils/errors');
const { query } = require('../config/database');

/**
 * JWT Authentication Middleware
 * Extracts and verifies JWT from Authorization header
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AuthError('Please log in to continue', 'AUTH_REQUIRED');
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                throw new AuthError('Your session has expired. Please log in again', 'TOKEN_EXPIRED');
            }
            throw new AuthError('Please log in again', 'INVALID_TOKEN');
        }

        // Get user from database
        const result = await query(
            'SELECT id, email, name, role, gym_id, trainer_id, xp_points, avatar_url FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            throw new AuthError('User not found. Please log in again', 'USER_NOT_FOUND');
        }

        // Attach user to request
        req.user = result.rows[0];
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Optional Authentication Middleware
 * Attaches user if token present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = null;
            return next();
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const result = await query(
                'SELECT id, email, name, role, gym_id, trainer_id, xp_points, avatar_url FROM users WHERE id = $1',
                [decoded.userId]
            );
            req.user = result.rows.length > 0 ? result.rows[0] : null;
        } catch {
            req.user = null;
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Generate JWT Token
 */
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

module.exports = {
    authenticate,
    optionalAuth,
    generateToken,
};
