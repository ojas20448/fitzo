require('dotenv').config();
const { query } = require('./src/config/database');

console.log('Current directory:', process.cwd());
console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'Yes' : 'No');
async function checkContent() {
    try {
        console.log('Checking learn_lessons table...');
        const result = await query('SELECT count(*) FROM learn_lessons');
        console.log('Total lessons:', result.rows[0].count);

        const units = await query('SELECT DISTINCT unit, unit_title FROM learn_lessons ORDER BY unit');
        console.log('Units found:', units.rows);
    } catch (error) {
        console.error('Error checking content:', error);
    }
    process.exit();
}

checkContent();
