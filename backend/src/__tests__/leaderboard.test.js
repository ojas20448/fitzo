/**
 * Leaderboard & Kudos Tests
 * Verifies weekly XP queries and kudos social interaction logic.
 */

const request = require('supertest');
const express = require('express');
const leaderboardRouter = require('../routes/leaderboard');
const { query } = require('../config/database');
const { errorHandler } = require('../utils/errors');
const pushNotifications = require('../services/pushNotifications');

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../services/pushNotifications', () => ({
    sendToUser: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../middleware/auth', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 'user-sender-123', name: 'Sender Member', gym_id: 'gym-uuid-456' };
        next();
    }
}));

const app = express();
app.use(express.json());
app.use('/api/leaderboard', leaderboardRouter);
app.use(errorHandler);

describe('Leaderboard & Kudos Router', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/leaderboard', () => {
        it('returns gym leaderboard ranked by weekly XP', async () => {
            query.mockResolvedValueOnce({
                rows: [
                    { id: 'buddy-1', name: 'Buddy One', avatar_url: null, weekly_xp: 150, kudos_count: 2, has_kudoed: false },
                    { id: 'user-sender-123', name: 'Sender Member', avatar_url: null, weekly_xp: 80, kudos_count: 1, has_kudoed: false }
                ]
            });

            const res = await request(app).get('/api/leaderboard');

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.leaderboard).toHaveLength(2);
            expect(res.body.leaderboard[0].name).toBe('Buddy One');
            expect(res.body.leaderboard[0].weekly_xp).toBe(150);
        });
    });

    describe('POST /api/leaderboard/kudos', () => {
        it('rejects kudos if receiverId is missing', async () => {
            const res = await request(app).post('/api/leaderboard/kudos').send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Receiver ID is required');
        });

        it('rejects self-kudos', async () => {
            const res = await request(app)
                .post('/api/leaderboard/kudos')
                .send({ receiverId: 'user-sender-123' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('You cannot give kudos to yourself');
        });

        it('rejects kudos if buddy is not in the same gym', async () => {
            query.mockResolvedValueOnce({
                rows: [{ gym_id: 'different-gym-789', name: 'Stranger' }]
            });

            const res = await request(app)
                .post('/api/leaderboard/kudos')
                .send({ receiverId: 'buddy-diff-gym' });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('Receiver is not in your gym');
        });

        it('saves kudos and sends push notification on success', async () => {
            query
                // 1. Verify receiver profile
                .mockResolvedValueOnce({
                    rows: [{ gym_id: 'gym-uuid-456', name: 'Buddy One' }]
                })
                // 2. Insert query
                .mockResolvedValueOnce({ rowCount: 1 });

            const res = await request(app)
                .post('/api/leaderboard/kudos')
                .send({ receiverId: 'buddy-1' });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(pushNotifications.sendToUser).toHaveBeenCalledWith('buddy-1', expect.objectContaining({
                title: 'Kudos fist-bump! 👊',
                body: expect.stringContaining('Sender Member')
            }));
        });
    });
});
