const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runSql() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Please provide a SQL file path');
        process.exit(1);
    }

    try {
        const fullPath = path.resolve(process.cwd(), filePath);
        console.log(`Reading SQL file from: ${fullPath}`);
        const sql = fs.readFileSync(fullPath, 'utf8');

        console.log('Connecting to database...');
        const client = await pool.connect();

        console.log('Executing SQL...');
        await client.query(sql);

        console.log('✅ SQL executed successfully!');
        client.release();
    } catch (err) {
        console.error('❌ SQL execution failed:', err);
    } finally {
        await pool.end();
    }
}

runSql();
