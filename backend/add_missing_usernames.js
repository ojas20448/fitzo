/**
 * Migration Script: Add usernames for users that don't have them
 * Handles existing users created through Google OAuth before username field was added
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://fitzo_admin:fitness123@localhost:5432/fitzo'
});

async function addMissingUsernames() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Checking for users without usernames...');
        
        // Find users without usernames
        const usersWithoutUsername = await client.query(
            'SELECT id, email FROM users WHERE username IS NULL'
        );
        
        if (usersWithoutUsername.rows.length === 0) {
            console.log('✅ All users already have usernames!');
            return;
        }
        
        console.log(`📝 Found ${usersWithoutUsername.rows.length} users without usernames. Generating...`);
        
        // Process each user
        for (const user of usersWithoutUsername.rows) {
            let username = user.email.split('@')[0];
            
            // Check if username exists
            let usernameResult = await client.query(
                'SELECT id FROM users WHERE username = $1',
                [username]
            );
            
            // If username exists, add a random number
            if (usernameResult.rows.length > 0) {
                username += Math.floor(Math.random() * 1000);
                
                // Keep trying until we find a unique username
                while (true) {
                    usernameResult = await client.query(
                        'SELECT id FROM users WHERE username = $1',
                        [username]
                    );
                    
                    if (usernameResult.rows.length === 0) break;
                    username = user.email.split('@')[0] + Math.floor(Math.random() * 1000);
                }
            }
            
            // Update user with new username
            await client.query(
                'UPDATE users SET username = $1 WHERE id = $2',
                [username, user.id]
            );
            
            console.log(`  ✓ User ${user.email} → @${username}`);
        }
        
        console.log('✅ All users now have usernames!');
        
    } catch (error) {
        console.error('❌ Error adding usernames:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the migration
addMissingUsernames()
    .then(() => {
        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    });
