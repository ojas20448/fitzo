const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./utils/errors');
const { initSentry, sentryErrorHandler } = require('./services/sentry');

// Initialize express
const app = express();

// Sentry must be initialized before any other middleware
initSentry(app);

// ===========================================
// MIDDLEWARE
// ===========================================

// CORS
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Development: Allow localhost and local IP
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        // Check against defined origins
        const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',');
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.CORS_ORIGIN === '*') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// Body parsing.
//
// ORDER IS LOAD-BEARING. `express.json` sets `req._body = true` once it has
// consumed the stream, and every later json parser short-circuits on that flag.
// So the FIRST parser to run wins, and a route-level `express.json({limit})`
// mounted further down can never raise the ceiling — it is dead code, and the
// global limit below would reject the request with a 413 long before the router
// is ever reached.
//
// Therefore: large-body routes (base64 image / audio uploads) must declare
// their parser HERE, above the global default.
const LARGE_BODY_ROUTES = [
    '/api/food/analyze-photo',  // base64 food photo -> Gemini Vision
    '/api/ai/transcribe',       // base64 audio -> speech-to-text
];
LARGE_BODY_ROUTES.forEach((route) => {
    app.use(route, express.json({ limit: '10mb' }));
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging (development only)
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`📥 ${req.method} ${req.path}`);
        next();
    });
}

// ===========================================
// ROUTES
// ===========================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: '💪 Fitzo API is running!',
        timestamp: new Date().toISOString()
    });
});

// API Health check (more detailed)
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        services: {
            database: 'unknown',
            api: 'ok'
        }
    };

    // Check database connection
    try {
        const pool = require('./config/database');
        await pool.query('SELECT 1');
        health.services.database = 'ok';
    } catch (err) {
        health.services.database = 'error';
        health.status = 'degraded';
        const sentry = require('./services/sentry');
        sentry.captureError(err, { service: 'database_health_check' });
    }

    res.status(health.status === 'ok' ? 200 : 503).json(health);
});

// API Routes — auth rate limiter is applied per-route inside auth.js (not here)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/member', require('./routes/member'));
app.use('/api/checkin', require('./routes/checkin'));
app.use('/api/intent', require('./routes/intent'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/learn', require('./routes/learn'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/trainer', require('./routes/trainer'));
app.use('/api/manager', require('./routes/manager'));
app.use('/api/workouts', require('./routes/workouts'));
app.use('/api/calories', require('./routes/calories'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/food', require('./routes/food'));
app.use('/api/nutrition', require('./routes/nutrition'));
app.use('/api/workout-sessions', require('./routes/workout-sessions'));
app.use('/api/workouts/published', require('./routes/workouts-published'));
app.use('/api/recipes', require('./routes/recipes'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/exercises', require('./routes/exercises'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/measurements', require('./routes/measurements'));
app.use('/api/calories-burned', require('./routes/calories-burned'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/health', require('./routes/health'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/buddy-activity', require('./routes/buddy-activity'));
app.use('/api/readiness', require('./routes/readiness'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/cron', require('./routes/cron'));

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: true,
        message: "This endpoint doesn't exist",
        code: 'NOT_FOUND'
    });
});

// Sentry error handler must be before the app error handler
app.use(sentryErrorHandler());

// Global error handler
app.use(errorHandler);

// ===========================================
// START SERVER
// ===========================================

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`
  🏋️ ═══════════════════════════════════════

     FITZO API SERVER
     Running on port ${PORT}
     Environment: ${process.env.NODE_ENV || 'development'}

  ═══════════════════════════════════════ 🏋️
  `);

        // Keep-alive self-ping: prevent Render free tier from sleeping (pings every 14 min).
        // IMPORTANT: must hit /api/health (runs SELECT 1) — NOT /health — so Supabase
        // free tier sees database activity and never auto-pauses the project.
        // (The July 2026 outage was caused by pinging /health, which never touched the DB.)
        if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
            const KEEP_ALIVE_MS = 14 * 60 * 1000; // 14 minutes
            setInterval(() => {
                const https = require('https');
                https.get(`${process.env.RENDER_EXTERNAL_URL}/api/health`, () => {}).on('error', () => {});
            }, KEEP_ALIVE_MS);
            console.log('🔄 Keep-alive ping enabled (every 14 min, DB-touching)');
        }
    });
}

module.exports = app;
