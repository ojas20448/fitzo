const fs = require('fs');
const path = require('path');

function databaseOptions(env = process.env) {
    const url = env.DATABASE_URL ? new URL(env.DATABASE_URL) : null;
    const host = url ? url.hostname : (env.DB_HOST || 'localhost');
    const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
    const mode = env.DB_SSL_MODE || (local ? 'disable' : 'verify-full');
    if (!['disable', 'verify-full'].includes(mode)) {
        throw new Error('DB_SSL_MODE must be disable or verify-full');
    }
    // pg URL SSL options replace the ssl object. Keep one explicit source of
    // truth so sslmode=require cannot silently discard a configured CA.
    if (url) {
        for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert']) {
            if (['sslcert', 'sslkey', 'sslrootcert'].includes(key) && url.searchParams.has(key)) {
                throw new Error('Configure TLS certificates outside DATABASE_URL; use DB_SSL_CA_FILE for the trusted CA.');
            }
            url.searchParams.delete(key);
        }
    }
    const ssl = mode === 'disable' ? false : { rejectUnauthorized: true };
    if (ssl && (env.DB_SSL_CA || env.DB_SSL_CA_FILE)) {
        ssl.ca = env.DB_SSL_CA || fs.readFileSync(env.DB_SSL_CA_FILE, 'utf8');
    } else if (ssl && (/^db\.[a-z0-9]+\.supabase\.co$/.test(host) || /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(host))) {
        ssl.ca = fs.readFileSync(path.join(__dirname, '../../certs/supabase-prod-ca-2021.crt'), 'utf8');
    }
    return {
        ...(url ? { connectionString: url.toString() } : {
            host, port: env.DB_PORT || 5432, database: env.DB_NAME || 'fitzo',
            user: env.DB_USER || 'postgres', password: env.DB_PASSWORD || 'password',
        }),
        ssl,
    };
}
module.exports = { databaseOptions };
