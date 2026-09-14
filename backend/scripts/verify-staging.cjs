// Read-only checks. Set STAGING_API_URL and STAGING_TEST_TOKEN in the process environment.
// Database isolation must also be verified in the hosting dashboards before write tests.
const assert = require('node:assert/strict');
async function main() {
  const base = new URL(process.env.STAGING_API_URL || '');
  assert(base.protocol === 'https:' && base.hostname !== 'fitzo.onrender.com' && base.pathname === '/api', 'Use an isolated staging HTTPS API URL ending in /api');
  assert(!base.username && !base.password && !base.search && !base.hash, 'API URL must not contain credentials or query parameters');
  const request = (path, token) => fetch(`${base.href}/health${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}, redirect: 'error', signal: AbortSignal.timeout(60000),
  });
  const health = await request('');
  assert.equal(health.status, 200, 'Staging health endpoint');
  const status = await health.json();
  assert.equal(status.services?.database, 'ok', 'Database connectivity');
  const denied = await request('/today');
  assert.equal(denied.status, 401, 'Health readings require authentication');
  assert(process.env.STAGING_TEST_TOKEN, 'Set STAGING_TEST_TOKEN for a synthetic staging account to complete authenticated checks');
  const today = new Date().toISOString().slice(0, 10);
  for (const path of [`/today?date=${today}`, `/history?days=30&date=${today}`]) {
    const response = await request(path, process.env.STAGING_TEST_TOKEN);
    assert.equal(response.status, 200, `Authenticated read ${path.split('?')[0]}`);
  }
  console.log('PASS: staging database connectivity, authentication boundary, daily health and 30-day history reads. No writes performed.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
