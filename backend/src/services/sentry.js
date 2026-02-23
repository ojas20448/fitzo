/**
 * Sentry Error Tracking
 *
 * Captures unhandled errors, rejected promises, and manual reports.
 * Initialize early in app lifecycle (before routes).
 */

const Sentry = require('@sentry/node');

const SENTRY_DSN = process.env.SENTRY_DSN || 'https://c6de2076e3087751f3a8d7d282a3fe99@o4510936143953920.ingest.de.sentry.io/4510936149327952';

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
    });

    // The request handler must be the first middleware
    app.use(Sentry.Handlers.requestHandler());

    console.log('🛡️  Sentry error tracking initialized');
}

/**
 * Must be added AFTER all routes but BEFORE the error handler
 */
function sentryErrorHandler() {
    if (!SENTRY_DSN) {
        return (err, req, res, next) => next(err);
    }
    return Sentry.Handlers.errorHandler();
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
