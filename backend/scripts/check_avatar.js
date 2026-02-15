require('dotenv').config();
const { query } = require('../src/config/database');

async function main() {
    // Check if updated_at column exists in public.users
    const cols = await query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'users'
         ORDER BY ordinal_position`
    );
    console.log('Public users columns:', cols.rows.map(r => r.column_name));

    process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
