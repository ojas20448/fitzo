const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { PGlite } = require('@electric-sql/pglite');
(async () => {
    const db = new PGlite();
    const databasePath = require.resolve('../src/config/database');
    const original = Module._load;
    Module._load = function(name, parent) {
        if (Module._resolveFilename(name, parent) === databasePath) return { query: (sql, params) => db.query(sql, params) };
        return original.apply(this, arguments);
    };
    try {
        await db.exec(fs.readFileSync(path.join(__dirname, '../data/migrations/20261029094102_durable_ai_quota.sql'), 'utf8'));
        const quotaPath = require.resolve('../src/middleware/aiQuota');
        let quota = require(quotaPath);
        const context = require('../src/services/aiContext');
        const res = { status() { return this; }, json() {}, set() {} };
        await context.run({ userId: 'owner' }, async () => {
            await quota.aiQuota({ user: { id: 'owner' } }, res, error => { if (error) throw error; });
            await quota.reserveProviderCall('owner');
            assert.equal((await quota.getUsage('owner')).daily.used, 1);
            await quota.reserveProviderCall('owner');
            await quota.reserveProviderCall('owner');
            await assert.rejects(quota.reserveProviderCall('owner'), { code: 'AI_LIMIT_REACHED' });
        });
        delete require.cache[quotaPath]; quota = require(quotaPath);
        assert.equal((await quota.getUsage('owner')).daily.used, 3);
        const calls = await Promise.allSettled(Array.from({ length: 12 }, () => quota.reserveProviderCall('parallel')));
        assert.equal(calls.filter(call => call.status === 'fulfilled').length, 3);
        assert.equal((await quota.getUsage('parallel')).daily.used, 3);
    } finally { Module._load = original; await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
