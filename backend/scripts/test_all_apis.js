/**
 * Fitzo — Comprehensive API Health Check
 * Tests all 22 backend routes and reports status
 * Run: node scripts/test_all_apis.js
 */
require('dotenv').config();
const http = require('http');
const https = require('https');

const BASE = 'http://localhost:3001';
let authToken = null;
let testUserId = null;

const results = [];

// Simple HTTP helper (no axios dependency)
function request(method, path, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: { 'Content-Type': 'application/json' },
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data: data.substring(0, 200) });
                }
            });
        });
        req.on('error', (e) => reject(e));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function log(name, pass, detail = '') {
    const icon = pass ? '✅' : '❌';
    const line = `${icon} ${name}${detail ? ' — ' + detail : ''}`;
    console.log(line);
    results.push({ name, pass, detail });
}

async function testRoute(name, method, path, body = null, expectStatus = 200) {
    try {
        const res = await request(method, path, body, authToken);
        const pass = res.status === expectStatus;
        const preview = typeof res.data === 'object'
            ? JSON.stringify(res.data).substring(0, 120)
            : String(res.data).substring(0, 120);
        log(name, pass, `${res.status} ${preview}`);
        return res;
    } catch (e) {
        log(name, false, `ERROR: ${e.message}`);
        return null;
    }
}

async function run() {
    console.log('\n🏋️  FITZO API HEALTH CHECK');
    console.log('═'.repeat(60) + '\n');

    // ── Health ──
    await testRoute('Health Check', 'GET', '/health');

    // ── Auth ──
    console.log('\n── AUTH ──');
    const devLogin = await testRoute('Dev Login', 'POST', '/api/auth/dev-login');
    if (devLogin?.data?.token) {
        authToken = devLogin.data.token;
        testUserId = devLogin.data.user?.id;
        console.log(`   🔑 Logged in as: ${devLogin.data.user?.email} (${devLogin.data.user?.role})`);
    }
    await testRoute('Get Me', 'GET', '/api/auth/me');
    // Test login with known creds
    await testRoute('Login (test)', 'POST', '/api/auth/login', {
        email: 'rahul@example.com', password: 'test123'
    });
    // Google OAuth route — sends a mock token, expects 401 (token is invalid but route exists)
    await testRoute('Google OAuth', 'POST', '/api/auth/google', { token: 'test' }, 401);

    // ── Member ──
    console.log('\n── MEMBER ──');
    await testRoute('Member Home', 'GET', '/api/member/home');

    // ── Check-in ──
    console.log('\n── CHECK-IN ──');
    await testRoute('Check-in Status', 'GET', '/api/checkin/status');
    await testRoute('Check-in History', 'GET', '/api/checkin/history?days=7');

    // ── Intent ──
    console.log('\n── INTENT ──');
    await testRoute('Get Intent', 'GET', '/api/intent');
    await testRoute('Intent Feed', 'GET', '/api/intent/feed');

    // ── Friends ──
    console.log('\n── FRIENDS ──');
    await testRoute('Get Friends', 'GET', '/api/friends');
    await testRoute('Search Friends', 'GET', '/api/friends/search?q=test');
    await testRoute('Suggested Friends', 'GET', '/api/friends/suggested');

    // ── Learn ──
    console.log('\n── LEARN ──');
    await testRoute('Get Lessons', 'GET', '/api/learn/lessons');
    await testRoute('Learn Progress', 'GET', '/api/learn/progress');

    // ── Classes ──
    console.log('\n── CLASSES ──');
    await testRoute('Get Classes', 'GET', '/api/classes');
    await testRoute('My Bookings', 'GET', '/api/classes/my-bookings');

    // ── Trainer ──
    console.log('\n── TRAINER ──');
    await testRoute('Trainer Members', 'GET', '/api/trainer/members');
    await testRoute('Trainer Schedule', 'GET', '/api/trainer/schedule');

    // ── Manager ──
    console.log('\n── MANAGER ──');
    await testRoute('Manager Dashboard', 'GET', '/api/manager/dashboard');

    // ── Workouts ──
    console.log('\n── WORKOUTS ──');
    await testRoute('Workouts Today', 'GET', '/api/workouts/today');
    await testRoute('Workout History', 'GET', '/api/workouts/history?limit=5');
    await testRoute('Workout Feed', 'GET', '/api/workouts/feed');
    await testRoute('My Splits', 'GET', '/api/workouts/splits');
    await testRoute('Published Splits', 'GET', '/api/workouts/published');

    // ── Calories ──
    console.log('\n── CALORIES ──');
    await testRoute('Calories Today', 'GET', '/api/calories/today');
    await testRoute('Calories History', 'GET', '/api/calories/history?limit=5');
    await testRoute('Frequent Foods', 'GET', '/api/calories/frequent?limit=5');

    // ── Food ──
    console.log('\n── FOOD ──');
    await testRoute('Food Search', 'GET', '/api/food/search?q=apple&limit=3');
    await testRoute('Food Categories', 'GET', '/api/food/categories/indian');
    await testRoute('Gym Foods', 'GET', '/api/food/gym-foods');

    // ── Nutrition ──
    console.log('\n── NUTRITION ──');
    await testRoute('Nutrition Profile', 'GET', '/api/nutrition/profile');
    await testRoute('Nutrition Today', 'GET', '/api/nutrition/today');

    // ── Recipes ──
    console.log('\n── RECIPES ──');
    await testRoute('Get Recipes', 'GET', '/api/recipes');

    // ── AI ──
    console.log('\n── AI COACH ──');
    await testRoute('AI Chat', 'POST', '/api/ai/chat', {
        question: 'What is protein?',
        context: {}
    });

    // ── Exercises ──
    console.log('\n── EXERCISES ──');
    await testRoute('Exercise List', 'GET', '/api/exercises?limit=3');
    await testRoute('Body Parts List', 'GET', '/api/exercises/lists/bodyparts');

    // ── Videos ──
    console.log('\n── VIDEOS ──');
    await testRoute('Video Search', 'GET', '/api/videos/search?q=squats&limit=2');
    await testRoute('Trending Videos', 'GET', '/api/videos/trending?limit=2');

    // ── Measurements ──
    console.log('\n── MEASUREMENTS ──');
    await testRoute('Measurements Latest', 'GET', '/api/measurements/latest');
    await testRoute('Measurements History', 'GET', '/api/measurements/history');

    // ── Profile ──
    console.log('\n── PROFILE ──');
    await testRoute('Get Profile', 'GET', '/api/profile');

    // ── Calories Burned ──
    console.log('\n── CALORIES BURNED ──');
    await testRoute('Calculate Burned', 'POST', '/api/workouts/calculate-calories', {
        activity: 'running', duration: 30, weight: 70
    });

    // ── Summary ──
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    const total = results.length;

    console.log('\n' + '═'.repeat(60));
    console.log(`\n📊 RESULTS: ${passed}/${total} passed, ${failed} failed\n`);

    if (failed > 0) {
        console.log('❌ FAILED ROUTES:');
        results.filter(r => !r.pass).forEach(r => {
            console.log(`   • ${r.name}: ${r.detail}`);
        });
    }

    // Write JSON report
    const fs = require('fs');
    const report = {
        timestamp: new Date().toISOString(),
        summary: { total, passed, failed },
        results: results.map(r => ({ name: r.name, pass: r.pass, detail: r.detail }))
    };
    fs.writeFileSync('api_health_report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Full report saved to api_health_report.json');
}

run().catch(e => console.error('Fatal error:', e));
