#!/usr/bin/env node
'use strict';

const PROTECTED_PATHS = ['/api/member/home', '/api/workout-sessions/sessions'];

// Read-only checks. No login credentials or application writes are required.
async function checkDeployment({ baseUrl, expectedCommit, fetchImpl = fetch }) {
    const base = new URL(baseUrl);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && loopback))
        || base.username || base.password || base.search || base.hash
        || !['/', '/api', '/api/'].includes(base.pathname)) {
        throw new Error('Use an HTTPS API origin or /api URL without credentials or query parameters.');
    }
    if (!/^[a-f0-9]{40}$/.test(expectedCommit || '')) {
        throw new Error('Supply the full 40-character Git revision expected on the server.');
    }

    const get = async (path) => {
        const response = await fetchImpl(new URL(path, base.origin), {
            method: 'GET',
            redirect: 'error',
            signal: AbortSignal.timeout(15000),
            headers: { Accept: 'application/json' },
        });
        let body;
        try {
            body = await response.json();
        } catch {
            throw new Error(`${path} returned HTTP ${response.status} without an API JSON response.`);
        }
        return { path, status: response.status, body };
    };

    const health = await get('/api/health');
    if (health.status !== 200 || health.body.status !== 'ok'
        || health.body.services?.database !== 'ok' || health.body.services?.api !== 'ok') {
        throw new Error('API or database health is not ready for cutover.');
    }
    if (health.body.commit !== expectedCommit) {
        throw new Error('The server is not running the expected Git revision.');
    }

    const protectedResponses = await Promise.all(PROTECTED_PATHS.map(get));
    for (const response of protectedResponses) {
        if (response.status !== 401 || response.body.code !== 'AUTH_REQUIRED') {
            throw new Error(`${response.path} did not enforce the expected authentication requirement.`);
        }
    }
    return { origin: base.origin, commit: health.body.commit, checks: 1 + protectedResponses.length };
}

if (require.main === module) {
    const [baseUrl, expectedCommit] = process.argv.slice(2);
    if (!baseUrl || !expectedCommit) {
        console.error('Usage: node backend/scripts/check_deployment.js https://api.fitzoapp.in <full-git-revision>');
        process.exitCode = 1;
    } else {
        checkDeployment({ baseUrl, expectedCommit }).then((result) => {
            console.log(`PASS: ${result.checks} read-only checks; API/database healthy; authentication enforced; revision ${result.commit}.`);
        }).catch((error) => {
            console.error(`FAIL: ${error.message}`);
            process.exitCode = 1;
        });
    }
}

module.exports = { checkDeployment };
