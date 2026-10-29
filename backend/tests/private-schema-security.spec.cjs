const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');

(async () => {
    const db = new PGlite();
    try {
        await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
            CREATE TABLE private_records (id INTEGER PRIMARY KEY);
            INSERT INTO private_records VALUES (1);
            GRANT ALL ON private_records TO anon, authenticated;
            CREATE FUNCTION private_count() RETURNS BIGINT LANGUAGE SQL AS 'SELECT count(*) FROM private_records';
            GRANT EXECUTE ON FUNCTION private_count() TO anon, authenticated;`);
        const migration = fs.readFileSync(path.join(__dirname, '../data/migrations/20261028215559_harden_private_application_data.sql'), 'utf8');
        await db.exec(migration);
        await db.exec(migration);
        for (const role of ['anon', 'authenticated']) {
            await db.exec(`SET ROLE ${role}`);
            await assert.rejects(db.query('SELECT * FROM private_records'), { code: '42501' });
            await assert.rejects(db.query('SELECT private_count()'), { code: '42501' });
            await db.exec('RESET ROLE');
        }
        await db.exec('INSERT INTO private_records VALUES (2)');
        assert.equal((await db.query('SELECT private_count() AS n')).rows[0].n, 2);
        assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'private_records'")).rows[0].relrowsecurity, true);
    } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
