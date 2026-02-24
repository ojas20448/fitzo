/**
 * Zod Validation Middleware
 *
 * Validates request body, query, and params against Zod schemas.
 * Returns user-friendly error messages.
 */

const { ZodError } = require('zod');

/**
 * Express middleware factory for Zod validation
 * @param {Object} schemas - { body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }
 */
function validate(schemas) {
    return (req, res, next) => {
        try {
            if (schemas.body) {
                req.body = schemas.body.parse(req.body);
            }
            if (schemas.query) {
                req.query = schemas.query.parse(req.query);
            }
            if (schemas.params) {
                req.params = schemas.params.parse(req.params);
            }
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const messages = (error.issues || error.errors || []).map(e => {
                    const field = e.path.join('.');
                    return field ? `${field}: ${e.message}` : e.message;
                });

                return res.status(400).json({
                    error: true,
                    message: messages[0], // Show first error as main message
                    code: 'VALIDATION_ERROR',
                    details: messages,
                });
            }
            next(error);
        }
    };
}

module.exports = { validate };
