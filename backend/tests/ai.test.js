const request = require('supertest');
const express = require('express');
const aiRoutes = require('../src/routes/ai');

// Mock dependencies
jest.mock('../src/services/gemini', () => ({
    chatWithCoach: jest.fn().mockResolvedValue('Mocked coach response bhai!'),
    analyzeForm: jest.fn().mockResolvedValue({ correct: true }),
    transcribeAudio: jest.fn().mockResolvedValue('Mocked audio transcription text')
}));

jest.mock('../src/config/database', () => ({
    query: jest.fn().mockImplementation((sql, params) => {
        if (sql.includes('SELECT id, sender, message')) {
            // Route queries ORDER BY created_at DESC (newest first), then reverses
            // to oldest-first for rendering. Mock rows in DESC order accordingly.
            return {
                rows: [
                    { id: '2', sender: 'ai', message: 'Hi there', created_at: new Date() },
                    { id: '1', sender: 'user', message: 'Hello', created_at: new Date() }
                ]
            };
        }
        if (sql.includes('INSERT INTO coach_messages')) {
            return { rowCount: 1 };
        }
        return { rows: [] };
    })
}));

jest.mock('../src/services/contextPack', () => ({
    getContextPack: jest.fn().mockResolvedValue({
        streak: 5,
        profile: { goal_type: 'deficit' },
        training: { volume: { chest: 2 }, skippedMuscleGroups: ['legs'] }
    })
}));

jest.mock('../src/middleware/aiQuota', () => ({
    aiQuota: (req, res, next) => next(),
    getUsage: jest.fn().mockResolvedValue({ daily: 0, dailyLimit: 10 })
}));

jest.mock('../src/services/dailyInsight', () => ({
    getTodayDailyInsight: jest.fn().mockResolvedValue('Mock daily insight note')
}));

jest.mock('../src/services/weeklyRecap', () => ({
    getLatestWeeklyRecap: jest.fn().mockResolvedValue({
        id: 'recap-uuid',
        recap_data: { workouts_count: 4, streak_days: 7, avg_calories: 2000 },
        summary_text: 'Mock weekly recap summary note'
    })
}));

jest.mock('../src/middleware/auth', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 'test_user_id' };
        next();
    }
}));

const app = express();
app.use(express.json());
app.use('/api/ai', aiRoutes);

describe('AI Route Endpoints', () => {
    describe('GET /api/ai/chat/history', () => {
        it('should return chat history for the user', async () => {
            const res = await request(app).get('/api/ai/chat/history');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.history).toHaveLength(2);
            expect(res.body.history[0].sender).toBe('user');
        });
    });

    describe('GET /api/ai/daily-insight', () => {
        it('should return today\'s cached or generated daily insight', async () => {
            const res = await request(app).get('/api/ai/daily-insight');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.insight).toBe('Mock daily insight note');
        });
    });

    describe('GET /api/ai/weekly-recap', () => {
        it('should return the user\'s weekly recap', async () => {
            const res = await request(app).get('/api/ai/weekly-recap');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.recap.summary_text).toBe('Mock weekly recap summary note');
            expect(res.body.recap.recap_data.workouts_count).toBe(4);
        });
    });

    describe('POST /api/ai/chat', () => {
        it('should accept a question, retrieve context pack, call gemini, and save history', async () => {
            const res = await request(app)
                .post('/api/ai/chat')
                .send({ question: 'How is my chest volume?' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.response).toBe('Mocked coach response bhai!');
        });
    });

    describe('POST /api/ai/transcribe', () => {
        it('should accept base64 audio and return transcription text', async () => {
            const res = await request(app)
                .post('/api/ai/transcribe')
                .send({ audio: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=', mimeType: 'audio/wav' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.text).toBe('Mocked audio transcription text');
        });
    });
});
