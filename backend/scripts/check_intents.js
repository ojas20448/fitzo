require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { query } = require('../src/config/database');

async function main() {
    const result = await query(
        `SELECT column_name, is_nullable, data_type, character_maximum_length, column_default
         FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'workout_intents'
         ORDER BY ordinal_position`
    );
    console.log('workout_intents columns:');
    result.rows.forEach(r => {
        console.log(`  ${r.column_name}: ${r.data_type}${r.character_maximum_length ? `(${r.character_maximum_length})` : ''} | nullable: ${r.is_nullable} | default: ${r.column_default}`);
    });
    process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
