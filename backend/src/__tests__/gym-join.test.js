jest.mock('../config/database', () => ({ query: jest.fn() }));
let mockGymId = null;
let mockRole = 'member';
jest.mock('../middleware/auth', () => ({
    authenticate: (req, res, next) => { req.user = { id: 'member', role: mockRole, gym_id: mockGymId }; next(); },
    invalidateUserCache: jest.fn(async () => {}),
}));
jest.mock('../services/cache', () => ({ del: jest.fn(async () => {}), keys: { homeData: id => `home:${id}` } }));
const express = require('express');
const request = require('supertest');
const { query } = require('../config/database');
const { invalidateUserCache } = require('../middleware/auth');
const cache = require('../services/cache');
const app = express();
app.use(express.json());
app.use('/api/settings', require('../routes/settings'));
app.use(require('../utils/errors').errorHandler);
const gym = { id: '11111111-1111-1111-1111-111111111111', name: 'My Club', capacity: 40 };

beforeEach(() => {
    jest.clearAllMocks(); mockGymId = null; mockRole = 'member';
    query.mockReset().mockResolvedValueOnce({ rows: [gym] }).mockResolvedValue({ rows: [] });
});

test.each([
    [{ gym_code: ' club ' }, 'qr_code', 'CLUB'],
    [{ gym_qr: ' club ' }, 'qr_code', 'CLUB'],
    [{ gym_qr: '123456' }, 'qr_code', '123456'],
    [{ gym_qr: JSON.stringify({ gym_code: 'CLUB' }) }, 'qr_code', 'CLUB'],
    [{ gym_qr: JSON.stringify({ gym_code: ' club ' }) }, 'qr_code', 'CLUB'],
    [{ gym_qr: JSON.stringify({ gym_id: gym.id }) }, 'id', gym.id],
    [{ gym_qr: gym.id }, 'id', gym.id],
])('joins using %p without creating attendance', async (body, field, value) => {
    const response = await request(app).post('/api/settings/gym').send(body);
    expect(response.status).toBe(200);
    expect(response.body.gym).toEqual({ id: gym.id, name: gym.name });
    expect(query.mock.calls[0]).toEqual([`SELECT id, name, capacity FROM gyms WHERE ${field} = $1`, [value]]);
    expect(query.mock.calls[1]).toEqual(['UPDATE users SET gym_id = $1, trainer_id = NULL WHERE id = $2', [gym.id, 'member']]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(invalidateUserCache).toHaveBeenCalledWith('member');
    expect(cache.del).toHaveBeenCalledWith('home:member');
});

test.each([null, 123, [], {}, '', '  ', '{}', '[]', '{broken', '{"gym_id":123}', '{"gym_id":"wrong"}', '{"gym_code":[]}', 'https://example.com', 'x'.repeat(1025)])('rejects invalid QR %p before querying', async gymQR => {
    const response = await request(app).post('/api/settings/gym').send({ gym_qr: gymQR });
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
    expect(invalidateUserCache).not.toHaveBeenCalled();
});

test('rejects an unknown gym QR without changing membership', async () => {
    query.mockReset().mockResolvedValueOnce({ rows: [] });
    const response = await request(app).post('/api/settings/gym').send({ gym_qr: JSON.stringify({ gym_id: gym.id }) });
    expect(response.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
    expect(invalidateUserCache).not.toHaveBeenCalled();
});

test('scanning the current gym QR is idempotent', async () => {
    mockGymId = gym.id;
    const response = await request(app).post('/api/settings/gym').send({ gym_qr: JSON.stringify({ gym_id: gym.id }) });
    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(1);
    expect(invalidateUserCache).not.toHaveBeenCalled();
});

test.each(['manager', 'trainer'])('prevents %s from transferring privileges through self-service gym changes', async role => {
    mockRole = role;
    expect((await request(app).post('/api/settings/gym').send({ gym_code: 'CLUB' })).status).toBe(403);
    expect((await request(app).delete('/api/settings/gym')).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
});
