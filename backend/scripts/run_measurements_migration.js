require('dotenv').config({ path: './backend/.env' }); // Adjust path as we'll run from root
const { query, pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

const runMigration = async () => {
    try {
        console.log('Running Body Measurements Migration...');
        const sqlPath = path.join(__dirname, '../src/db/alter_measurements.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        const res = await query(sql);

        console.log('Migration Result:', res.rows || 'Success');
        console.log('Done!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
};

runMigration();
