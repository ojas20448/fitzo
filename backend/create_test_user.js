require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function createTestUser() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database...');

        // 1. Check/Create Gym
        let gymRes = await client.query('SELECT id FROM gyms LIMIT 1');
        let gymId;

        if (gymRes.rows.length === 0) {
            console.log('No gyms found. Creating "Fitzo HQ"...');
            const newGym = await client.query(`
                INSERT INTO gyms (name, qr_code)
                VALUES ('Fitzo HQ', 'FITZOHQ')
                RETURNING id
            `);
            gymId = newGym.rows[0].id;
            console.log('Created Gym ID:', gymId);
        } else {
            gymId = gymRes.rows[0].id;
            console.log('Using existing Gym ID:', gymId);
        }

        // 2. Create User
        const email = 'rahul@example.com';
        const password = 'test123';
        const hash = await bcrypt.hash(password, 10);

        const userRes = await client.query(
            `INSERT INTO users (email, password_hash, name, username, role, gym_id, xp_points)
             VALUES ($1, $2, $3, $5, 'member', $4, 0)
             RETURNING id, email`,
            [email, hash, 'Rahul', gymId, 'rahul']
        );

        console.log('✅ Created User:', userRes.rows[0]);

    } catch (err) {
        if (err.code === '23505') { // Unique violation
            console.log('User already exists! (This shouldn\'t happen if list_users returned 0)');
        } else {
            console.error('Error:', err);
        }
    } finally {
        await client.end();
        process.exit(0);
    }
}

createTestUser();
