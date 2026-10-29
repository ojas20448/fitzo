const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { pg_trgm } = require('@electric-sql/pglite/contrib/pg_trgm');

(async () => {
    const db = new PGlite({ extensions: { pg_trgm } });
    try {
        await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
            CREATE TABLE private_records (id INTEGER PRIMARY KEY);
            INSERT INTO private_records VALUES (1);
            GRANT ALL ON private_records TO anon, authenticated;
            CREATE FUNCTION private_count() RETURNS BIGINT LANGUAGE SQL AS 'SELECT count(*) FROM private_records';
            GRANT EXECUTE ON FUNCTION private_count() TO anon, authenticated;
            CREATE EXTENSION pg_trgm WITH SCHEMA public;
            CREATE TABLE extension_records (name TEXT);
            INSERT INTO extension_records VALUES ('chickpeas');
            CREATE INDEX extension_search ON extension_records USING GIN (name gin_trgm_ops);`);
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
        const functionMigration = fs.readFileSync(path.join(__dirname, '../data/migrations/20261029155245_harden_function_search_paths.sql'), 'utf8');
        await db.exec(functionMigration);
        await db.exec(functionMigration);
        await db.exec(`CREATE SCHEMA caller_schema;
            CREATE TABLE caller_schema.private_records AS SELECT 1;
            CREATE TEMP TABLE private_records AS SELECT 1;
            SET search_path = caller_schema, public;`);
        assert.equal((await db.query('SELECT public.private_count() AS n')).rows[0].n, 2);
        assert.deepEqual((await db.query("SELECT proconfig FROM pg_proc WHERE proname = 'private_count'")).rows[0].proconfig,
            ['search_path=pg_catalog, public, pg_temp']);
        assert.equal((await db.query("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm'")).rows[0].nspname, 'extensions');
        assert.equal((await db.query("SELECT name FROM public.extension_records WHERE name ILIKE '%chick%'")).rows[0].name, 'chickpeas');
        assert.equal((await db.query("SELECT indisvalid FROM pg_index WHERE indexrelid = 'public.extension_search'::regclass")).rows[0].indisvalid, true);
    } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
