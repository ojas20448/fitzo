require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./utils/errors');

// Initialize express
const app = express();

// ===========================================
// MIDDLEWARE
// ===========================================

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/member', require('./routes/member'));
app.use('/api/checkin', require('./routes/checkin'));
app.use('/api/intent', require('./routes/intent'));
app.use('/api/friends', require('./routes/friends'));
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
app.use('/api/workouts', require('./routes/calories-burned'));

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: true,
        message: "This endpoint doesn't exist",
        code: 'NOT_FOUND'
    });
});

// Global error handler
app.use(errorHandler);

// ===========================================
// START SERVER
// ===========================================

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`
  🏋️ ═══════════════════════════════════════
  
     FITZO API SERVER
     Running on port ${PORT}
     Environment: ${process.env.NODE_ENV || 'development'}
     
  ═══════════════════════════════════════ 🏋️
  `);
});

module.exports = app;
