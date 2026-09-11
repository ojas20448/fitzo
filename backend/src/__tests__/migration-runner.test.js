jest.mock('pg', () => ({ Client: jest.fn() }));
const { buildPlan, applyPlan } = require('../../apply_migrations');
const fs = require('fs');
const os = require('os');
const path = require('path');
let dir;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fitzo-migration-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });
function migration(sql) {
    const file = path.join(dir, 'test.sql'); fs.writeFileSync(file, sql);
    return [{ label: 'test.sql', path: file }];
}
function clientFor(handler = () => ({ rows: [] })) {
    return { query: jest.fn(async (sql, params) => handler(sql, params)) };
}
test('normal plan never includes the destructive base schema', () => {
    expect(buildPlan().some(file => file.label === 'src/db/schema.sql')).toBe(false);
});
test('bootstrap refuses a populated database before running any DDL', async () => {
    const client = clientFor(sql => ({ rows: sql.includes('pg_class') ? [{ name: 'users' }] : [] }));
    await expect(applyPlan(client, migration('DROP TABLE users;'), { bootstrap: true })).rejects.toThrow(/empty database/i);
    expect(client.query.mock.calls.some(([sql]) => sql.includes('DROP TABLE'))).toBe(false);
});
test('duplicate errors roll back and stop without recording success or running the next file', async () => {
    const duplicate = Object.assign(new Error('already exists'), { code: '42701' });
    const client = clientFor(sql => { if (sql === 'ALTER TABLE users ADD COLUMN foo TEXT;') throw duplicate; return { rows: [] }; });
    await expect(applyPlan(client, migration('ALTER TABLE users ADD COLUMN foo TEXT;'))).rejects.toThrow(/already exists/);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO fitzo_schema_migrations'))).toBe(false);
});
test('file body and checksum record commit in the same transaction', async () => {
    const client = clientFor();
    await applyPlan(client, migration('-- header\nBEGIN;\nSELECT 1;\nCOMMIT;\n'));
    const calls = client.query.mock.calls.map(([sql]) => sql);
    expect(calls.filter(sql => sql === 'BEGIN')).toHaveLength(1);
    expect(calls.some(sql => sql.includes('SELECT 1;') && /COMMIT;/.test(sql))).toBe(false);
    expect(calls.findIndex(sql => sql.startsWith('INSERT INTO fitzo_schema_migrations'))).toBeLessThan(calls.indexOf('COMMIT'));
});
test('changed applied files fail instead of silently skipping', async () => {
    const client = clientFor(sql => ({ rows: sql.startsWith('SELECT checksum') ? [{ checksum: 'old' }] : [] }));
    await expect(applyPlan(client, migration('SELECT 1;'))).rejects.toThrow(/checksum/i);
});
