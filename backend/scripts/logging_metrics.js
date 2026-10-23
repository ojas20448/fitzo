#!/usr/bin/env node
// Usage: npm run metrics:logging -- --from=2026-10-01T00:00:00Z --to=2026-11-01T00:00:00Z
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { Pool } = require('pg');
const { databaseOptions } = require('../src/config/databaseOptions');
const { loggingMetrics, reportOptions } = require('../src/services/loggingMetrics');

async function main() {
    const flags = {};
    for (const arg of process.argv.slice(2)) {
        const match = arg.match(/^--(from|to|as-of|exclude)=(.+)$/);
        if (!match) throw new Error('Use --from=UTC_ISO --to=UTC_ISO [--as-of=UTC_ISO] [--exclude=uuid,uuid]');
        flags[match[1]] = match[2];
    }
    const options = reportOptions({ from: flags.from, to: flags.to, asOf: flags['as-of'], excludeUserIds: flags.exclude?.split(',') ?? [] });
    if (Date.parse(options.asOf) > Date.now()) throw new Error('as-of must not be in the future');
    const pool = new Pool({ ...databaseOptions(), max: 1, connectionTimeoutMillis: 10000 });
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await client.query("SET LOCAL statement_timeout = '30s'");
        const report = await loggingMetrics((sql, params) => client.query(sql, params), options);
        await client.query('COMMIT');
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } finally {
        if (client) { await client.query('ROLLBACK').catch(() => {}); client.release(); }
        await pool.end();
    }
}

main().catch(() => {
    // Connection error text can contain credentials or a private hostname.
    process.stderr.write('Could not create the logging report. Check the UTC date arguments and configured database connection.\n');
    process.exitCode = 1;
});
