jest.mock('../config/database', () => ({ query: jest.fn(), getClient: jest.fn() }));
jest.mock('../middleware/auth', () => ({
    authenticate: (req, res, next) => { req.user = { id: 'sender' }; next(); },
}));
jest.mock('../services/pushNotifications', () => ({
    sendToUser: jest.fn(async () => {}), NotificationType: { FRIEND_ACTIVITY: 'friend_activity' },
}));
const express = require('express');
const request = require('supertest');
const { query, getClient } = require('../config/database');
const pushNotifications = require('../services/pushNotifications');
const app = express();
app.use(express.json());
app.use('/api/friends', require('../routes/friends'));
app.use(require('../utils/errors').errorHandler);
beforeEach(() => { jest.clearAllMocks(); query.mockReset(); });

test('cancels only the authenticated sender\'s outgoing pending request', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'request' }] });
    const response = await request(app).post('/api/friends/cancel').send({ friend_id: 'recipient', user_id: 'someone-else' });
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Friend request cancelled');
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/DELETE FROM friendships\s+WHERE user_id = \$1 AND friend_id = \$2 AND status = 'pending'/);
    expect(params).toEqual(['sender', 'recipient']);
    expect(pushNotifications.sendToUser).not.toHaveBeenCalled();
});

test.each([undefined, '', '  ', 123, ['recipient']])('rejects an invalid recipient %p before querying', async friendId => {
    const response = await request(app).post('/api/friends/cancel').send({ friend_id: friendId });
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
});

test('returns not found when the request is no longer outgoing and pending', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const response = await request(app).post('/api/friends/cancel').send({ friend_id: 'recipient' });
    expect(response.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
});

test('cannot accept a request cancelled before acceptance claims it', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const response = await request(app).post('/api/friends/accept').send({ friend_id: 'recipient' });
    expect(response.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/UPDATE friendships SET status = 'accepted'[\s\S]*status = 'pending'\s+RETURNING id/);
    expect(query.mock.calls[0][1]).toEqual(['recipient', 'sender']);
    expect(pushNotifications.sendToUser).not.toHaveBeenCalled();
});

test('still accepts an available request and creates the reverse friendship', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'request' }] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ name: 'Alex' }] });
    const response = await request(app).post('/api/friends/accept').send({ friend_id: 'recipient' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('accepted');
    expect(query.mock.calls[1][0]).toContain('INSERT INTO friendships');
    expect(query.mock.calls[1][1]).toEqual(['sender', 'recipient']);
});

test('cannot auto-accept an outgoing request cancelled while the other person sends a request', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'recipient' }] })
        .mockResolvedValueOnce({ rows: [{ user_id: 'recipient', status: 'pending' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'request' }] });
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    getClient.mockResolvedValueOnce(client);
    const response = await request(app).post('/api/friends/request').send({ friend_id: 'recipient' });
    expect(response.status).toBe(404);
    expect(client.query.mock.calls[1][0]).toMatch(/status = 'pending'\s+RETURNING id/);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO friendships'))).toBe(false);
    expect(client.release).toHaveBeenCalled();
});
