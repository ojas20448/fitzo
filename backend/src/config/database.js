const { Pool } = require('pg');

// Supabase direct connection (db.xxx.supabase.co) is IPv6-only.
// Render and many cloud hosts can't reach IPv6.
// Auto-convert to Session Pooler URL (IPv4 compatible) when detected.
let dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const directMatch = dbUrl.match(
    /postgresql:\/\/postgres:(.+)@db\.([a-z0-9]+)\.supabase\.co:5432\/postgres/
  );
  if (directMatch) {
    const password = directMatch[1];
    const projectRef = directMatch[2];
    dbUrl = `postgresql://postgres.${projectRef}:${password}@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`;
    console.log('🔄 Auto-converted to Supabase Session Pooler (IPv4)');
  }
}

const poolConfig = dbUrl
  ? {
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'fitzo',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: false,
    };

console.log('🔌 DB Config:', process.env.DATABASE_URL ? 'Using DATABASE_URL (SSL)' : 'Using local config');
const pool = new Pool(poolConfig);

// Test connection on startup
pool.on('connect', () => {
  console.log('📦 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Query helper with logging in development
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query:', { text: text.substring(0, 50), duration: `${duration}ms`, rows: result.rowCount });
    }

    return result;
  } catch (error) {
    console.error('❌ Query error:', error.message);
    throw error;
  }
};

// Get a client from pool for transactions
const getClient = () => pool.connect();

module.exports = {
  pool,
  query,
  getClient,
};
