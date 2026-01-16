const { ForbiddenError } = require('../utils/errors');

/**
 * Role-based Access Control Middleware
 * Only allows users with specific roles to access the route
 * 
 * Usage: roleGuard('trainer', 'manager') - allows trainers and managers
 */
const roleGuard = (...allowedRoles) => {
    return (req, res, next) => {
        // Must be used after authenticate middleware
        if (!req.user) {
            return next(new ForbiddenError('Please log in first'));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError("You don't have access to this feature"));
        }

        next();
    };
};

/**
 * Gym-specific access guard
 * Ensures user belongs to the same gym as the resource
 */
const sameGymGuard = (getGymId) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return next(new ForbiddenError('Please log in first'));
            }

            const resourceGymId = typeof getGymId === 'function'
                ? await getGymId(req)
                : req.params.gymId;

            if (req.user.gym_id !== resourceGymId) {
                return next(new ForbiddenError("You can only access data from your own gym"));
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Trainer access to member guard
 * Ensures trainer can only access their assigned members
 */
const trainerMemberGuard = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(new ForbiddenError('Please log in first'));
        }

        // Managers can access all members
        if (req.user.role === 'manager') {
            return next();
        }

        // Trainers can only access their assigned members
        if (req.user.role === 'trainer') {
            const { query } = require('../config/database');
            const memberId = req.params.memberId || req.params.id;

            const result = await query(
                'SELECT trainer_id FROM users WHERE id = $1',
                [memberId]
            );

            if (result.rows.length === 0) {
                return next(new ForbiddenError("Member not found"));
            }

            if (result.rows[0].trainer_id !== req.user.id) {
                return next(new ForbiddenError("You can only view your assigned members"));
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    roleGuard,
    sameGymGuard,
    trainerMemberGuard,
};
