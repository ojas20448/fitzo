/**
 * Sentry Error Tracking
 *
 * Captures unhandled errors, rejected promises, and manual reports.
 * Initialize early in app lifecycle (before routes).
 */

const Sentry = require('@sentry/node');

const SENTRY_DSN = process.env.SENTRY_DSN || null;

function initSentry(app) {
    if (!SENTRY_DSN) {
        console.log('⚠️  Sentry DSN not configured — error tracking disabled');
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
        sendDefaultPii: false,
        // Disable auto-instrumentation of postgres to prevent connection issues
        autoSessionTracking: false,
    });

    console.log('🛡️  Sentry error tracking initialized');
}

/**
 * Must be added AFTER all routes but BEFORE the error handler
 * Uses setupExpressErrorHandler in Sentry SDK v8+
 */
function sentryErrorHandler() {
    if (!SENTRY_DSN) {
        return (err, req, res, next) => next(err);
    }
    // Only report unexpected/server errors to Sentry
    // Skip expected operational errors (auth, validation, 404) — they aren't bugs
    return (err, req, res, next) => {
        if (!err.isOperational || (err.statusCode && err.statusCode >= 500)) {
            Sentry.captureException(err);
        }
        next(err);
    };
}

/**
 * Manually capture an error with context
 */
function captureError(error, context = {}) {
    if (!SENTRY_DSN) return;
    Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
        });
        Sentry.captureException(error);
    });
}

/**
 * Set user context for subsequent error reports
 */
function setUser(user) {
    if (!SENTRY_DSN) return;
    Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.name,
    });
}

module.exports = {
    initSentry,
    sentryErrorHandler,
    captureError,
    setUser,
};
