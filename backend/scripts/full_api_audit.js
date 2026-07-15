/**
 * Full API Functional Audit
 *
 * Exercises every route group as member / trainer / manager against a running
 * server and reports pass/fail per endpoint with response validation.
 *
 * Usage:  node scripts/full_api_audit.js [--url http://localhost:3199]
 * Output: console table + scripts/output/full_api_audit.json
 *
 * NOTE: runs a handful of WRITE operations using seed/test accounts only
 * (intent set, kudos, AI chat — one Gemini call). Safe + idempotent-ish.
 */

const fs = require('fs');
const path = require('path');

const BASE = (process.argv.includes('--url')
    ? process.argv[process.argv.indexOf('--url') + 1]
    : 'http://localhost:3199');

const ACCOUNTS = {
    member: { email: 'rahul@example.com', password: 'test123' },
    trainer: { email: 'trainer1@fitzo.app', password: 'test123' },
    manager: { email: 'manager@fitzo.app', password: 'test123' },
};

const tokens = {};
const results = [];

async function call(method, urlPath, { role, body, headers = {}, timeout = 30000 } = {}) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        signal: AbortSignal.timeout(timeout),
    };
    if (role && tokens[role]) opts.headers.Authorization = `Bearer ${tokens[role]}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${urlPath}`, opts);
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, data };
}

async function check(name, method, urlPath, opts = {}, validate) {
    const expectStatus = opts.expectStatus || 200;
    try {
        const { status, data } = await call(method, urlPath, opts);
        let pass = status === expectStatus;
        let note = `HTTP ${status}`;
        if (pass && validate) {
            const v = validate(data);
            if (v !== true) { pass = false; note = `shape: ${v}`; }
        }
        if (!pass && data && (data.message || data.error)) {
            note += ` — ${JSON.stringify(data.message || data.error).slice(0, 80)}`;
        }
        results.push({ name, method, path: urlPath, role: opts.role || '-', pass, note });
        process.stdout.write(pass ? '.' : 'F');
    } catch (err) {
        results.push({ name, method, path: urlPath, role: opts.role || '-', pass: false, note: err.message.slice(0, 80) });
        process.stdout.write('E');
    }
}

async function main() {
    console.log(`Auditing ${BASE}\n`);

    // ===== AUTH =====
    for (const [role, creds] of Object.entries(ACCOUNTS)) {
        try {
            const { status, data } = await call('POST', '/api/auth/login', { body: creds });
            if (status === 200 && data.token) {
                tokens[role] = data.token;
                results.push({ name: `login ${role}`, method: 'POST', path: '/api/auth/login', role, pass: true, note: 'HTTP 200' });
            } else {
                results.push({ name: `login ${role}`, method: 'POST', path: '/api/auth/login', role, pass: false, note: `HTTP ${status} ${JSON.stringify(data?.message || '').slice(0, 60)}` });
            }
        } catch (e) {
            results.push({ name: `login ${role}`, method: 'POST', path: '/api/auth/login', role, pass: false, note: e.message });
        }
    }
    if (!tokens.member) { console.error('\nMember login failed — aborting.'); return finish(); }

    await check('health', 'GET', '/health', {}, d => d.status === 'ok' || 'missing status');
    await check('api health (DB)', 'GET', '/api/health', {}, d => d.services?.database === 'ok' || 'db not ok');
    await check('auth me', 'GET', '/api/auth/me', { role: 'member' }, d => !!d.user?.id || 'no user');
    await check('bad login rejected', 'POST', '/api/auth/login', { body: { email: 'rahul@example.com', password: 'wrong' }, expectStatus: 401 });
    await check('auth required', 'GET', '/api/member/home', { expectStatus: 401 });

    // ===== MEMBER CORE =====
    await check('member home', 'GET', '/api/member/home', { role: 'member' }, d => d.user && d.streak ? true : 'missing user/streak');
    await check('checkin status', 'GET', '/api/checkin/status', { role: 'member' }, d => 'checked_in' in d || 'missing checked_in');
    await check('checkin history', 'GET', '/api/checkin/history', { role: 'member' }, d => Array.isArray(d.dates) || 'no dates[]');
    await check('intent get', 'GET', '/api/intent', { role: 'member' }, d => 'intent' in d || 'missing intent key');
    await check('intent feed', 'GET', '/api/intent/feed', { role: 'member' }, d => Array.isArray(d.intents) || 'no intents[]');
    await check('intent suggest', 'GET', '/api/intent/suggest', { role: 'member' });

    // ===== SOCIAL =====
    await check('friends list', 'GET', '/api/friends', { role: 'member' }, d => Array.isArray(d.friends) || 'no friends[]');
    await check('friends search', 'GET', '/api/friends/search?q=priya', { role: 'member' }, d => Array.isArray(d.users) || 'no users[]');
    await check('friends suggested', 'GET', '/api/friends/suggested', { role: 'member' });
    await check('posts feed', 'GET', '/api/posts/feed', { role: 'member' });
    await check('notification status', 'GET', '/api/notifications/status', { role: 'member' });
    await check('notification prefs', 'GET', '/api/notifications/preferences', { role: 'member' });
    await check('leaderboard', 'GET', '/api/leaderboard', { role: 'member' }, d => Array.isArray(d.leaderboard) || 'no leaderboard[]');
    await check('buddy activity bad id → 400', 'GET', '/api/buddy-activity/not-a-uuid', { role: 'member', expectStatus: 400 });

    // ===== WORKOUTS =====
    await check('workouts today', 'GET', '/api/workouts/today', { role: 'member' });
    await check('workouts history', 'GET', '/api/workouts/history', { role: 'member' });
    await check('workouts latest', 'GET', '/api/workouts/latest?type=chest', { role: 'member' });
    await check('workouts latest unknown type ok', 'GET', '/api/workouts/latest?type=push', { role: 'member' }, d => d.found === false || d.found === true || 'missing found');
    await check('splits list', 'GET', '/api/workouts/splits', { role: 'member' });
    await check('published splits', 'GET', '/api/workouts/published', { role: 'member' });
    await check('workout sessions', 'GET', '/api/workout-sessions/sessions', { role: 'member' });
    await check('session exercises', 'GET', '/api/workout-sessions/exercises', { role: 'member' });
    await check('exercises list', 'GET', '/api/exercises?limit=5', { role: 'member' });
    await check('exercise search', 'GET', '/api/exercises/search/bench', { role: 'member' });
    await check('exercise bad id → 404', 'GET', '/api/exercises/not-a-real-id', { role: 'member', expectStatus: 404 });

    // ===== NUTRITION / FOOD =====
    await check('calories today', 'GET', '/api/calories/today', { role: 'member' });
    await check('calories history', 'GET', '/api/calories/history', { role: 'member' });
    await check('calories frequent', 'GET', '/api/calories/frequent', { role: 'member' });
    await check('nutrition today', 'GET', '/api/nutrition/today', { role: 'member' });
    await check('nutrition profile', 'GET', '/api/nutrition/profile', { role: 'member' });
    await check('nutrition weekly', 'GET', '/api/nutrition/weekly', { role: 'member' });
    await check('food search (indian)', 'GET', '/api/food/search?q=roti', { role: 'member' }, d => Array.isArray(d.foods || d.results) || 'no foods[]');
    await check('food barcode 404-ok', 'GET', '/api/food/barcode/0000000000000', { role: 'member', expectStatus: 404 });
    await check('recipes list', 'GET', '/api/recipes', { role: 'member' });
    await check('calories-burned calc', 'POST', '/api/calories-burned/calculate-calories', { role: 'member', body: { activity: 'running', duration_minutes: 30 } });

    // ===== BODY / PROGRESS / READINESS =====
    await check('measurements latest', 'GET', '/api/measurements/latest', { role: 'member' });
    await check('measurements history', 'GET', '/api/measurements/history', { role: 'member' });
    await check('progress PRs', 'GET', '/api/progress/prs', { role: 'member' });
    await check('progress volume', 'GET', '/api/progress/volume', { role: 'member' });
    await check('readiness today', 'GET', '/api/readiness/today', { role: 'member' });
    await check('health today', 'GET', '/api/health/today', { role: 'member' });
    await check('health history', 'GET', '/api/health/history', { role: 'member' });

    // ===== LEARN =====
    await check('learn lessons', 'GET', '/api/learn/lessons', { role: 'member' }, d => Array.isArray(d.units) || 'no units[]');
    await check('learn progress', 'GET', '/api/learn/progress', { role: 'member' });

    // ===== CLASSES =====
    await check('classes list', 'GET', '/api/classes', { role: 'member' }, d => Array.isArray(d.sessions) || 'no sessions[]');
    await check('my bookings', 'GET', '/api/classes/my-bookings', { role: 'member' });

    // ===== SETTINGS / PROFILE =====
    await check('settings sharing', 'GET', '/api/settings/sharing', { role: 'member' });
    await check('settings gym', 'GET', '/api/settings/gym', { role: 'member' }, d => 'gym' in d || 'missing gym key');
    await check('fitness profile', 'GET', '/api/profile/fitness', { role: 'member' });
    await check('profile measurements', 'GET', '/api/profile/measurements', { role: 'member' });

    // ===== AI (costs a few Gemini calls — intentional) =====
    await check('ai quota', 'GET', '/api/ai/quota', { role: 'member' }, d => d.daily && d.monthly ? true : 'missing quota fields');
    await check('ai chat history', 'GET', '/api/ai/chat/history', { role: 'member' }, d => Array.isArray(d.history) || 'no history[]');
    await check('ai chat (1 Gemini call)', 'POST', '/api/ai/chat', { role: 'member', body: { question: 'Quick tip for chest day?' }, timeout: 45000 }, d => typeof d.response === 'string' && d.response.length > 10 || 'no response text');
    await check('ai daily insight', 'GET', '/api/ai/daily-insight', { role: 'member', timeout: 45000 }, d => typeof d.insight === 'string' || 'no insight');
    await check('ai weekly recap', 'GET', '/api/ai/weekly-recap', { role: 'member', timeout: 60000 });
    await check('food analyze-text (1 Gemini call)', 'POST', '/api/food/analyze-text', { role: 'member', body: { text: '2 roti and dal' }, timeout: 45000 });

    // ===== VIDEOS =====
    await check('videos search', 'GET', '/api/videos/search?q=squat%20form', { role: 'member', timeout: 20000 });

    // ===== TRAINER =====
    if (tokens.trainer) {
        await check('trainer members', 'GET', '/api/trainer/members', { role: 'trainer' }, d => Array.isArray(d.members) || 'no members[]');
        await check('trainer schedule', 'GET', '/api/trainer/schedule', { role: 'trainer' });
        await check('trainer blocked for member', 'GET', '/api/trainer/members', { role: 'member', expectStatus: 403 });
    }

    // ===== MANAGER =====
    if (tokens.manager) {
        await check('manager dashboard', 'GET', '/api/manager/dashboard', { role: 'manager' }, d => d.crowd && d.today ? true : 'missing crowd/today');
        await check('manager members', 'GET', '/api/manager/members', { role: 'manager' });
        await check('manager trainers', 'GET', '/api/manager/trainers', { role: 'manager' });
        await check('manager at-risk', 'GET', '/api/manager/at-risk', { role: 'manager' }, d => Array.isArray(d.members) || 'no members[]');
        await check('manager retention', 'GET', '/api/manager/retention', { role: 'manager' }, d => d.summary ? true : 'no summary');
        await check('manager blocked for member', 'GET', '/api/manager/dashboard', { role: 'member', expectStatus: 403 });
    }

    // ===== CRON GATING =====
    await check('cron blocked without secret', 'POST', '/api/cron/daily-insights', { expectStatus: process.env.CRON_SECRET ? 401 : 404 });

    // ===== 404 =====
    await check('unknown route 404', 'GET', '/api/does-not-exist', { role: 'member', expectStatus: 404 });

    finish();
}

function finish() {
    console.log('\n');
    const passed = results.filter(r => r.pass);
    const failed = results.filter(r => !r.pass);

    console.log(`\n===== RESULTS: ${passed.length}/${results.length} passed =====\n`);
    if (failed.length) {
        console.log('FAILURES:');
        for (const f of failed) {
            console.log(`  ❌ [${f.role}] ${f.method} ${f.path} (${f.name}) → ${f.note}`);
        }
    } else {
        console.log('All checks passed ✅');
    }

    const outDir = path.resolve(__dirname, 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
        path.join(outDir, 'full_api_audit.json'),
        JSON.stringify({ timestamp: new Date().toISOString(), base: BASE, total: results.length, passed: passed.length, results }, null, 2)
    );
    console.log(`\nReport: scripts/output/full_api_audit.json`);
}

main().catch(e => { console.error('Audit crashed:', e); process.exit(1); });
