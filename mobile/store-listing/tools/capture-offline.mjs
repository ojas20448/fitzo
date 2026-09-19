/** Capture the real exported app with fictional data. No backend connections. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from './dependencies.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXPORT = path.resolve(ROOT, '../output/store-refresh/app-export');
const OUT = path.resolve(ROOT, 'store-screenshots/store-refresh');
fs.mkdirSync(OUT, { recursive: true });
const user = { id: 'store-demo', name: 'Aarav Kapoor', email: 'demo@example.invalid', role: 'member', gym_id: 'demo-gym', gym_name: 'Iron Paradise', onboarding_completed: true, current_streak: 18 };
const sets = (weight) => [1, 2, 3].map(id => ({ id: String(id), weight_kg: weight, reps: 8, completed: true }));
const fixtures = {
  '/health': { status: 'ok' },
  '/api/auth/me': { user },
  '/api/settings/sharing': { share_logs_default: false, friends_intro_seen: true },
  '/api/settings/workout': { log_rir_enabled: false, workout_prefs_seen: true, rest_timer_enabled: false, warmup_card_enabled: false },
  '/api/workouts/latest': { found: true, workout: { exercises: [
    { id: 'bench', name: 'Barbell Bench Press', target: 'chest', sets: sets(80) },
    { id: 'incline', name: 'Incline Dumbbell Press', target: 'chest', sets: sets(24) },
    { id: 'lateral', name: 'Lateral Raise', target: 'shoulders', sets: sets(10) },
  ] } },
  '/api/ai/context-summary': { sessions: 6, streak: 18, targetCalories: 2680 },
  '/api/ai/chat/history': { success: true, history: [
    { id: '1', sender: 'user', message: 'Help me reflect on my week.', created_at: '2026-09-19T09:40:00' },
    { id: '2', sender: 'assistant', message: 'You logged 6 sessions this week and kept your 18-day streak going.\n\nYour muscle map shows more work for your chest and back than your shoulders. Review your weekly sets before planning your next session.\n\nWant to look at your training or nutrition first?', created_at: '2026-09-19T09:41:00' },
  ] },
  '/api/friends': { friends: [
    { id: 'friend-1', name: 'Riya Shah', streak: 12, checked_in_today: true, worked_out_today: true, last_workout_type: 'chest', last_workout_date: '2026-09-19' },
    { id: 'friend-2', name: 'Kabir Mehta', streak: 8, checked_in_today: true, logged_food_today: true, last_workout_type: 'back', last_workout_date: '2026-09-18' },
    { id: 'friend-3', name: 'Neha Rao', streak: 16, checked_in_today: false, worked_out_today: true, last_workout_type: 'legs', last_workout_date: '2026-09-19' },
    { id: 'friend-4', name: 'Arjun Das', streak: 5, checked_in_today: false, last_workout_type: 'shoulders', last_workout_date: '2026-09-18' },
  ], pending_requests: [], sent_requests: [] },
  '/api/friends/suggested': { suggested: [] },
  '/api/leaderboard': { success: true, leaderboard: [] },
};
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.woff': 'font/woff', '.json': 'application/json', '.svg': 'image/svg+xml' };
fixtures['/api/friends'].friends.forEach((friend, i) => {
  friend.avatar_url = ['avatar_runner', 'avatar_barbell', 'avatar_heart', 'avatar_kettlebell'][i];
});
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let target = path.resolve(EXPORT, '.' + pathname);
  if (!target.startsWith(EXPORT + path.sep) && target !== EXPORT) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(EXPORT, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    // All non-local requests terminate here, including production reads/writes.
    const body = fixtures[url.pathname];
    if (body) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': '*' } });
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Offline screenshot fixture: unavailable' }) });
    return route.abort();
  });
  await context.addInitScript(() => {
    localStorage.setItem('fitzo_auth_token', 'offline-artwork-demo-not-a-real-token');
    localStorage.setItem('@fitzo_ai_data_consent', 'true');
    localStorage.setItem('first_run_tip:voice_workout', '1');
  });
  const page = await context.newPage();
  for (const [name, route, ready] of [
    ['04-logger', '/log/workout', 'Barbell Bench Press'],
    ['03-coach', '/ai-coach', 'Help me reflect on my week.'],
    ['08-buddies', '/buddies', 'Riya Shah'],
  ]) {
    await page.goto(origin + route, { waitUntil: 'networkidle' });
    try {
      await page.getByText(ready, { exact: true }).first().waitFor({ timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      // The branded launch animation covers mounted routes for a short interval.
      await page.waitForTimeout(3500);
      await page.screenshot({ path: path.join(OUT, `${name}.png`) });
      console.log('Captured real UI with sample data:', name);
    } catch (err) {
      await page.screenshot({ path: path.resolve(ROOT, `../output/store-refresh/debug-${name}.png`) });
      console.log((await page.locator('body').innerText()).slice(0, 1800));
      throw err;
    }
  }
} finally {
  await browser.close();
  server.close();
}
