const { databaseOptions } = require('../config/databaseOptions');
test('preserves the configured Supabase host and verifies TLS', () => {
    const url = 'postgresql://postgres:example@db.example.supabase.co:5432/postgres';
    const config = databaseOptions({ DATABASE_URL: url });
    expect(config.connectionString).toBe(url);
    expect(config.ssl.rejectUnauthorized).toBe(true);
    expect(config.ssl.ca).toContain('BEGIN CERTIFICATE');
});
test('does not trust the Supabase CA for unrelated hosts', () => {
    expect(databaseOptions({ DATABASE_URL: 'postgresql://user:example@db.example.supabase.co.evil.test/db' }).ssl.ca).toBeUndefined();
});
test('allows plain local development PostgreSQL', () => {
    expect(databaseOptions({ DATABASE_URL: 'postgresql://user:example@localhost/fitzo' }).ssl).toBe(false);
});
test('URL sslmode cannot override certificate verification', () => {
    const config = databaseOptions({ DATABASE_URL: 'postgresql://user:example@db.example/db?sslmode=require', DB_SSL_CA: 'certificate' });
    expect(config.connectionString).not.toContain('sslmode');
    expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: 'certificate' });
});
test('requires explicit configuration for private-network plaintext and rejects unknown modes', () => {
    expect(databaseOptions({ DB_HOST: 'private-db', DB_SSL_MODE: 'disable' }).ssl).toBe(false);
    expect(() => databaseOptions({ DB_SSL_MODE: 'typo' })).toThrow(/DB_SSL_MODE/);
});
