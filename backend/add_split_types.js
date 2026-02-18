const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addSplitTypes() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Adding new split types to database...');
        
        // New split types to add
        const newSplits = [
            'anterior_posterior',
            'push_pull',
            'arnold_split',
            'phul',
            'phat'
        ];
        
        for (const splitType of newSplits) {
            try {
                // Check if the value already exists
                const checkQuery = `
                    SELECT EXISTS (
                        SELECT 1 FROM pg_enum 
                        WHERE enumlabel = $1 
                        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'split_type')
                    );
                `;
                const result = await client.query(checkQuery, [splitType]);
                
                if (!result.rows[0].exists) {
                    console.log(`  Adding '${splitType}'...`);
                    await client.query(`ALTER TYPE split_type ADD VALUE '${splitType}'`);
                    console.log(`  ✅ Added '${splitType}'`);
                } else {
                    console.log(`  ⏭️  '${splitType}' already exists`);
                }
            } catch (err) {
                console.error(`  ❌ Error adding '${splitType}':`, err.message);
            }
        }
        
        // Show all current split types
        const allSplits = await client.query(`
            SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'split_type')
            ORDER BY enumlabel;
        `);
        
        console.log('\n✅ Current split types in database:');
        allSplits.rows.forEach(row => console.log(`  - ${row.enumlabel}`));
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

addSplitTypes()
    .then(() => {
        console.log('\n🎉 Migration completed successfully!');
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n💥 Migration failed:', err);
        process.exit(1);
    });
