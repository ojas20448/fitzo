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
            // BYPASS AUTH FOR TESTING (Dev only)
            if (process.env.NODE_ENV !== 'production' && req.headers['x-bypass-auth']) {
                console.log('⚠️ Using Auth Bypass');
                const demoUser = await query('SELECT * FROM users LIMIT 1');
                if (demoUser.rows.length > 0) {
                    req.user = demoUser.rows[0];
                    return next();
                }
            }
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

/**
 * Admin Authentication Middleware
 * Requires user to be authenticated AND have manager role
 */
const authenticateAdmin = async (req, res, next) => {
    try {
        // First, authenticate the user
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AuthError('Please log in to continue', 'AUTH_REQUIRED');
        }

        const token = authHeader.split(' ')[1];

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                throw new AuthError('Your session has expired. Please log in again', 'TOKEN_EXPIRED');
            }
            throw new AuthError('Please log in again', 'INVALID_TOKEN');
        }

        const result = await query(
            'SELECT id, email, name, role, gym_id, trainer_id, xp_points, avatar_url FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            throw new AuthError('User not found. Please log in again', 'USER_NOT_FOUND');
        }

        const user = result.rows[0];
        
        // Check if user is admin/manager
        if (user.role !== 'manager' && user.role !== 'admin') {
            throw new AuthError('Admin access required', 'ADMIN_REQUIRED');
        }

        req.user = user;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    authenticate,
    optionalAuth,
    generateToken,
    authenticateAdmin,
};
