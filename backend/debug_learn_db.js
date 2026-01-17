require('dotenv').config();
const { Client } = require('pg');

async function checkLearnStructure() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();

        // Get column names
        const columns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'learn_lessons';
        `);
        console.log('Columns:', columns.rows.map(r => r.column_name).join(', '));

        // Get one row to see content length
        const row = await client.query(`SELECT * FROM learn_lessons LIMIT 1`);
        if (row.rows.length > 0) {
            const lesson = row.rows[0];
            console.log('Sample Lesson Keys:', Object.keys(lesson));
            console.log('Description Length:', lesson.description ? lesson.description.length : 0);
            console.log('Description Preview:', lesson.description ? lesson.description.substring(0, 50) : 'NULL');
            if (lesson.content) {
                console.log('Content Length:', lesson.content.length);
                console.log('Content Preview:', lesson.content.substring(0, 50));
            } else {
                console.log('No "content" field in row data.');
            }
        } else {
            console.log('No lessons found.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

checkLearnStructure();
