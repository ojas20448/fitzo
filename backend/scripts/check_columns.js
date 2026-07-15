// Compare live DB columns against what the code expects
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const table = process.argv[2] || 'calorie_logs';

pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table]
).then(r => {
    console.log(`Columns of ${table}:`);
    for (const row of r.rows) console.log(`  ${row.column_name} (${row.data_type})`);
    pool.end();
}).catch(e => { console.error('ERROR:', e.message); pool.end(); process.exit(1); });
