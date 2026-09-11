jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../services/cache', () => ({ get: jest.fn(), set: jest.fn(), del: jest.fn() }));
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const cache = require('../services/cache');
const { authenticate, optionalAuth, authenticateAdmin, generateToken } = require('../middleware/auth');
beforeEach(() => { jest.clearAllMocks(); process.env.JWT_SECRET = 'local-test-only'; });
for (const [name, middleware] of [['required', authenticate], ['admin', authenticateAdmin]]) {
    it(`${name} authentication rejects a token issued before password reset`, async () => {
        query.mockResolvedValue({ rows: [{ id: 'u', role: 'manager', token_version: 1 }] });
        const token = jwt.sign({ userId: 'u' }, process.env.JWT_SECRET);
        const next = jest.fn();
        await middleware({ headers: { authorization: `Bearer ${token}` } }, {}, next);
        expect(next.mock.calls[0][0]?.statusCode).toBe(401);
    });
}
it('does not authorize a deleted account from stale Redis data', async () => {
    cache.get.mockResolvedValue({ id: 'u', token_version: 0 }); query.mockResolvedValue({ rows: [] });
    const next = jest.fn();
    await authenticate({ headers: { authorization: `Bearer ${jwt.sign({ userId: 'u' }, process.env.JWT_SECRET)}` } }, {}, next);
    expect(next.mock.calls[0][0]?.statusCode).toBe(401);
});
it('issues a usable token after a reset', async () => {
    query.mockResolvedValue({ rows: [{ id: 'u', token_version: 3 }] });
    const token = await generateToken('u');
    expect(jwt.verify(token, process.env.JWT_SECRET).tokenVersion).toBe(3);
    const req = { headers: { authorization: `Bearer ${token}` } }; const next = jest.fn();
    await authenticate(req, {}, next); expect(req.user.id).toBe('u'); expect(next).toHaveBeenCalledWith();
});
it('optional auth ignores revoked credentials', async () => {
    query.mockResolvedValue({ rows: [{ id: 'u', token_version: 2 }] });
    const req = { headers: { authorization: `Bearer ${jwt.sign({ userId: 'u', tokenVersion: 0 }, process.env.JWT_SECRET)}` } };
    await optionalAuth(req, {}, jest.fn()); expect(req.user).toBeNull();
});
it('does not turn an old password proof into a new session during a concurrent reset', async () => {
    query.mockResolvedValue({ rows: [{ id: 'u', token_version: 4 }] });
    await expect(generateToken('u', 3)).rejects.toMatchObject({ statusCode: 401 });
});
