// Quick check: do the new feature tables exist in the connected DB?
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const expected = ['coach_messages', 'daily_insights', 'weekly_recaps', 'kudos', 'xp_logs'];

pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
).then(r => {
    const have = r.rows.map(x => x.table_name);
    console.log('TOTAL TABLES:', have.length);
    for (const t of expected) {
        console.log(have.includes(t) ? `  ✅ ${t}` : `  ❌ MISSING: ${t}`);
    }
    pool.end();
}).catch(e => { console.error('ERROR:', e.message); pool.end(); process.exit(1); });
