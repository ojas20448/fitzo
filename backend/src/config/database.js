const { Pool } = require('pg');
const dns = require('dns');
const net = require('net');

// Force IPv4 DNS resolution globally to avoid ENETUNREACH on Render/cloud hosts
dns.setDefaultResultOrder('ipv4first');

// Monkey-patch net.connect to force IPv4 for pg connections
const origConnect = net.connect;
net.connect = function(...args) {
  if (args[0] && typeof args[0] === 'object') {
    args[0].family = 4;
  }
  return origConnect.apply(this, args);
};

// Use DATABASE_URL exclusively when available; only fall back to individual params otherwise
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
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
