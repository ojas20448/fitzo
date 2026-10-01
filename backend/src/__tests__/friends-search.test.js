jest.mock('../config/database', () => ({ query: jest.fn(async () => ({ rows: [] })) }));
jest.mock('../middleware/auth', () => ({
    authenticate: (req, res, next) => {
        req.user = { id: 'viewer-uuid-1', gym_id: 'gym-uuid-1' };
        next();
    }
}));
jest.mock('../services/cache', () => ({ del: jest.fn(), keys: { homeData: id => id } }));
jest.mock('../services/xpService', () => ({ awardXP: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { query } = require('../config/database');

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/friends', require('../routes/friends'));
    app.use(require('../utils/errors').errorHandler);
    return app;
}

describe('Friend Search API (GET /api/friends/search)', () => {
    let app;

    beforeEach(() => {
        query.mockReset();
        query.mockResolvedValue({ rows: [] });
        app = createApp();
    });

    it('returns empty list when query is shorter than 2 characters', async () => {
        const res = await request(app).get('/api/friends/search?q=a');
        expect(res.status).toBe(200);
        expect(res.body.users).toEqual([]);
        expect(query).not.toHaveBeenCalled();
    });

    it('searches with leading @ stripped and lowercase', async () => {
        query.mockResolvedValueOnce({
            rows: [
                {
                    id: 'user-uuid-2',
                    name: 'Ojas Narang',
                    username: 'ojas4123narang',
                    avatar_url: null,
                    friendship_status: 'none'
                }
            ]
        });

        const res = await request(app).get('/api/friends/search?q=@ojas');
        expect(res.status).toBe(200);
        expect(res.body.users).toHaveLength(1);
        expect(res.body.users[0].username).toBe('ojas4123narang');

        expect(query).toHaveBeenCalledTimes(1);
        const [sql, params] = query.mock.calls[0];
        // Must search username, name, and user ID
        expect(sql).toContain('LOWER(u.username) ILIKE $2');
        expect(sql).toContain('u.id::text ILIKE $2');
        expect(params).toEqual([
            'viewer-uuid-1',
            '%ojas%',
            'ojas',
            'gym-uuid-1',
            'ojas%'
        ]);
    });

    it('finds user by user ID without @', async () => {
        query.mockResolvedValueOnce({
            rows: [
                {
                    id: 'km274nfmpv',
                    name: 'Target Buddy',
                    username: 'targetuser',
                    avatar_url: null,
                    friendship_status: 'none'
                }
            ]
        });

        const res = await request(app).get('/api/friends/search?q=km274nfmpv');
        expect(res.status).toBe(200);
        expect(res.body.users).toHaveLength(1);
        expect(res.body.users[0].id).toBe('km274nfmpv');

        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain('u.id::text = $3');
        expect(params[2]).toBe('km274nfmpv');
    });

    it('does not exclude users from other gyms or without gym', async () => {
        const res = await request(app).get('/api/friends/search?q=alex');
        expect(res.status).toBe(200);
        const [sql] = query.mock.calls[0];
        // u.gym_id is used for sorting priority, NOT for filtering out non-gym users
        expect(sql).not.toContain('WHERE u.gym_id =');
        expect(sql).toContain('CASE WHEN u.gym_id = $4 THEN 0 ELSE 1 END');
    });
});
