const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

async function runSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected!');

        const schemaSql = fs.readFileSync(path.join(__dirname, 'src', 'db', 'schema.sql'), 'utf8');

        console.log('Applying schema...');
        // Split by semicolon and filter out empty strings to run queries sequentially if needed,
        // but for now let's try running the whole block.
        await client.query(schemaSql);
        console.log('✅ Schema applied successfully!');

        // Also run seed data if needed
        const seedSql = fs.readFileSync(path.join(__dirname, 'src', 'db', 'seed.sql'), 'utf8');
        console.log('Applying seed data...');
        await client.query(seedSql);
        console.log('✅ Seed data applied successfully!');

    } catch (err) {
        console.error('❌ Error applying schema/seed:', err);
    } finally {
        await client.end();
    }
}

runSchema();
