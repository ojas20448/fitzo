const { checkDeployment } = require('../../scripts/check_deployment');

const revision = 'a'.repeat(40);
const healthy = { status: 'ok', commit: revision, services: { database: 'ok', api: 'ok' } };
const jsonResponse = (body, status = 200) => ({ status, json: async () => body });
const run = (fetchImpl, extra = {}) => checkDeployment({
    baseUrl: 'https://api.example.test/api', expectedCommit: revision, fetchImpl, ...extra,
});

test('accepts the expected healthy release and checks protected routes without credentials', async () => {
    const fetchImpl = jest.fn(async (url, options) => {
        expect(options.method).toBe('GET');
        expect(options.redirect).toBe('error');
        expect(options.headers.Authorization).toBeUndefined();
        return url.pathname === '/api/health'
            ? jsonResponse(healthy)
            : jsonResponse({ code: 'AUTH_REQUIRED' }, 401);
    });
    await expect(run(fetchImpl)).resolves.toEqual({ origin: 'https://api.example.test', commit: revision, checks: 3 });
    expect(fetchImpl.mock.calls.map(([url]) => url.pathname)).toEqual([
        '/api/health', '/api/member/home', '/api/workout-sessions/sessions',
    ]);
});

test('rejects a healthy endpoint from the wrong deployed release', async () => {
    await expect(run(async () => jsonResponse({ ...healthy, commit: 'b'.repeat(40) })))
        .rejects.toThrow('expected Git revision');
});

test('rejects database degradation before probing protected routes', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({ ...healthy, services: { database: 'error', api: 'ok' } }, 503));
    await expect(run(fetchImpl)).rejects.toThrow('not ready for cutover');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('rejects a host loading page or suspension HTML', async () => {
    await expect(run(async () => ({ status: 503, json: async () => { throw new Error('HTML'); } })))
        .rejects.toThrow('without an API JSON response');
});

test('rejects an accidentally public protected route', async () => {
    await expect(run(async (url) => jsonResponse(url.pathname === '/api/health' ? healthy : { sessions: [] })))
        .rejects.toThrow('authentication requirement');
});

test('rejects plaintext public hosts, credentials in URLs and incomplete revisions without making requests', async () => {
    const fetchImpl = jest.fn();
    for (const baseUrl of ['http://api.example.test', 'https://user:secret@api.example.test', 'https://api.example.test?token=secret']) {
        await expect(run(fetchImpl, { baseUrl })).rejects.toThrow('without credentials');
    }
    await expect(run(fetchImpl, { expectedCommit: 'abcdef0' })).rejects.toThrow('40-character');
    expect(fetchImpl).not.toHaveBeenCalled();
});
