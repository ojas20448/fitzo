/**
 * Migration script to create posts tables
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://fitzo_admin:fitness123@localhost:5432/fitzo'
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Running posts migration...');
        
        // Read SQL file
        const sqlPath = path.join(__dirname, 'data', 'migrations', 'add_posts_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Execute SQL
        await client.query(sql);
        
        console.log('✅ Posts migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the migration
runMigration()
    .then(() => {
        console.log('🎉 Migration script finished!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Migration script failed:', error);
        process.exit(1);
    });
