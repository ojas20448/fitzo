jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../services/pushNotifications', () => ({ sendToUser: jest.fn(async () => ({ ok: true })), sendBroadcast: jest.fn(async () => ({ ok: true })) }));
let mockPrincipal;
jest.mock('../middleware/auth', () => ({ authenticateAdmin: (req, res, next) => { req.user = mockPrincipal; next(); }, authenticate: (req, res, next) => next() }));
const { query } = require('../config/database');
const { trainerMemberGuard } = require('../middleware/roleGuard');
const notifications = require('../services/pushNotifications');
const express = require('express');
const request = require('supertest');
const app = express();
app.use(express.json());
app.use(require('../routes/notifications'));
app.use(require('../utils/errors').errorHandler);
beforeEach(() => { jest.clearAllMocks(); mockPrincipal = { id: 'staff', role: 'manager', gym_id: 'gym-a' }; });

test.each([
    ['manager', 'gym-a', null, true], ['manager', 'gym-b', null, false],
    ['trainer', 'gym-a', 'staff', true], ['trainer', 'gym-a', 'other', false],
    ['trainer', 'gym-b', 'staff', false], ['member', 'gym-a', 'staff', false],
])('%s access to a member in %s assigned to %s is %s', async (role, gym, trainer, allowed) => {
    query.mockResolvedValue({ rows: [{ role: 'member', gym_id: gym, trainer_id: trainer }] });
    const next = jest.fn();
    await trainerMemberGuard({ user: { ...mockPrincipal, role }, params: { id: 'target' } }, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    if (allowed) expect(next).toHaveBeenCalledWith();
    else expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
});

test('missing staff gym assignment fails closed', async () => {
    const next = jest.fn();
    await trainerMemberGuard({ user: { ...mockPrincipal, gym_id: null }, params: { id: 'target' } }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    expect(query).not.toHaveBeenCalled();
});

test.each(['gym-b', null])('manager cannot notify a target in %s', async gym => {
    query.mockResolvedValue({ rows: [{ gym_id: gym }] });
    expect((await request(app).post('/send/target').send({ title: 'Hi', body: 'Hi' })).status).toBe(403);
    expect(notifications.sendToUser).not.toHaveBeenCalled();
});

test('manager can notify a target within the assigned gym', async () => {
    query.mockResolvedValue({ rows: [{ gym_id: 'gym-a' }] });
    expect((await request(app).post('/send/target').send({ title: 'Hi', body: 'Hi' })).status).toBe(200);
    expect(notifications.sendToUser).toHaveBeenCalledTimes(1);
});

test('gym managers cannot send a platform broadcast', async () => {
    expect((await request(app).post('/broadcast').send({ title: 'Hi', body: 'Hi' })).status).toBe(403);
    expect(notifications.sendBroadcast).not.toHaveBeenCalled();
});
