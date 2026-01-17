require('dotenv').config();
const { Client } = require('pg');

async function checkQuestions() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();

        const res = await client.query('SELECT id, title, questions FROM learn_lessons LIMIT 1');
        if (res.rows.length === 0) {
            console.log('No lessons found!');
        } else {
            console.log('Lesson:', res.rows[0].title);
            console.log('Questions Type:', typeof res.rows[0].questions);
            console.log('Questions Content:', JSON.stringify(res.rows[0].questions, null, 2));
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

checkQuestions();
