const jwt = require('jsonwebtoken');
const { AuthError } = require('../utils/errors');
const { query } = require('../config/database');
const cache = require('../services/cache');

// Security state must be fresh: cached principals survive password resets/deletion.
const userAuthKey = (userId) => `user:${userId}:auth`;
async function getCurrentUser(userId) {
    const result = await query(
        'SELECT id, email, name, role, gym_id, trainer_id, xp_points, avatar_url, token_version FROM users WHERE id = $1',
        [userId]
    );
    return result.rows[0] || null;
}
function assertCurrentSession(user, decoded) {
    if (!user || (decoded.tokenVersion || 0) !== (user.token_version || 0)) {
        throw new AuthError('Please log in again', 'SESSION_REVOKED');
    }
}

/**
 * Invalidate cached user data (call after profile updates, xp changes, etc.)
 */
async function invalidateUserCache(userId) {
    await cache.del(userAuthKey(userId));
}

/**
 * JWT Authentication Middleware
 * Extracts and verifies JWT from Authorization header.
 * Security state is read fresh so revocation and deletion take effect immediately.
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

        // Get user (from cache or DB)
        const user = await getCurrentUser(decoded.userId);

        if (!user) {
            throw new AuthError('User not found. Please log in again', 'USER_NOT_FOUND');
        }

        // Attach user to request
        assertCurrentSession(user, decoded);
        req.user = user;
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
            req.user = await getCurrentUser(decoded.userId);
            assertCurrentSession(req.user, decoded);
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
const generateToken = async (userId, expectedVersion) => {
    const user = await getCurrentUser(userId);
    if (!user) throw new AuthError();
    if (expectedVersion !== undefined && expectedVersion !== user.token_version) throw new AuthError('Please log in again', 'SESSION_REVOKED');
    return jwt.sign(
        { userId, tokenVersion: user.token_version || 0 },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '90d' }
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

        const user = await getCurrentUser(decoded.userId);

        if (!user) {
            throw new AuthError('User not found. Please log in again', 'USER_NOT_FOUND');
        }

        // Check if user is admin/manager
        if (user.role !== 'manager' && user.role !== 'admin') {
            throw new AuthError('Admin access required', 'ADMIN_REQUIRED');
        }

        assertCurrentSession(user, decoded);
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
    invalidateUserCache,
};
