const { PGlite } = require('@electric-sql/pglite');
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const member = '00000000-0000-0000-0000-000000000001';
const buddy = '00000000-0000-0000-0000-000000000002';
const gym = '00000000-0000-0000-0000-000000000003';
let db;
let clock = '2026-10-24T22:30:00Z';
process.env.JWT_SECRET = 'activity-timezone-test';
const query = (sql, params) => db.query(sql.replace(/\bNOW\(\)/gi, `'${clock}'::timestamptz`), params);
async function setClock(value) {
    clock = value;
    await db.query("SELECT set_config('fitzo.test_clock', $1, false)", [value]);
}
require.cache[require.resolve('../src/config/database')] = { exports: { query, getClient: async () => ({ query, release() {} }) } };
require.cache[require.resolve('../src/services/cache')] = { exports: {
    del: async () => {}, getOrSet: async (_, fn) => fn(), TTL: {},
    keys: { nutritionToday: id => id, userStreak: id => id, homeData: id => id, crowdLevel: id => id, busyTimes: id => id },
} };
require.cache[require.resolve('../src/services/contextPack')] = { exports: { invalidateContextPack: async () => {} } };
require.cache[require.resolve('../src/services/xpService')] = { exports: { awardXP: async () => {} } };
require.cache[require.resolve('../src/services/pushNotifications')] = { exports: { sendToUser: async () => {}, NotificationType: {} } };
require.cache[require.resolve('../src/services/aiProvider')] = { exports: {
    getModel: () => ({ generateContent: async () => ({ response: { text: () => 'Test recap' } }) }),
} };
const app = express();
app.use(express.json());
for (const name of ['workouts', 'workout-sessions', 'checkin', 'member', 'buddy-activity', 'friends', 'classes', 'manager', 'progress', 'gyms']) app.use('/' + name, require('../src/routes/' + name));
app.use(require('../src/utils/errors').errorHandler);
const token = jwt.sign({ userId: member, tokenVersion: 0 }, process.env.JWT_SECRET);
const call = (method, url, timezone = 'Europe/London') => request(app)[method](url)
    .set('Authorization', `Bearer ${token}`).set('X-Fitzo-Timezone', timezone);
before(async () => {
    db = new PGlite();
    await db.exec(`CREATE TABLE users (id uuid PRIMARY KEY, email text, name text, username text, role text, gym_id uuid, created_at timestamptz DEFAULT NOW(),
        trainer_id uuid, xp_points int, avatar_url text, token_version int DEFAULT 0, share_logs_default boolean DEFAULT true);
        CREATE TABLE gyms (id uuid PRIMARY KEY, name text, capacity int, qr_code text);
        CREATE TABLE workout_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, workout_type text,
        exercises text, notes text, visibility text, completed boolean DEFAULT true, logged_date date, created_at timestamptz DEFAULT NOW());
        CREATE TABLE workout_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, source_workout_log_id uuid,
        completed_at timestamptz, started_at timestamptz DEFAULT NOW(), day_name text, duration_minutes int, notes text, visibility text);
        CREATE TABLE attendances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, gym_id uuid,
        check_date date, checked_in_at timestamptz DEFAULT NOW(), checked_out_at timestamptz, UNIQUE(user_id, check_date));
        CREATE TABLE calorie_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, food_name text,
        calories int, protein int, carbs int, fat int, visibility text, logged_date date, created_at timestamptz);
        CREATE TABLE body_measurements (user_id uuid, recorded_at timestamptz, weight numeric, body_fat numeric);
        CREATE TABLE fitness_profiles (user_id uuid, goal_type text, target_calories int, current_weight numeric, target_weight numeric);
        CREATE TABLE weekly_recaps (id uuid DEFAULT gen_random_uuid(), user_id uuid, recap_data jsonb, summary_text text,
        week_start_date date, UNIQUE(user_id, week_start_date));
        CREATE TABLE friendships (user_id uuid, friend_id uuid, status text, created_at timestamptz DEFAULT NOW());
        CREATE TABLE workout_intents (user_id uuid, split_type text, emphasis text[], session_label text, muscle_group text,
        visibility text, expires_at timestamptz, created_at timestamptz);
        CREATE TABLE exercises (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, muscle_groups text[]);
        CREATE TABLE exercise_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid, exercise_id uuid,
        custom_exercise_name text, order_index int, muscle_group text, is_unilateral boolean DEFAULT false);
        CREATE TABLE set_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exercise_log_id uuid, set_number int,
        reps int, weight_kg numeric, is_warmup boolean DEFAULT false, rpe numeric, rir int);
        CREATE TABLE class_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gym_id uuid, trainer_id uuid,
        name text, scheduled_at timestamptz, duration_mins int, max_capacity int);
        CREATE TABLE class_bookings (id uuid PRIMARY KEY, session_id uuid, user_id uuid);`);
    await setClock(clock);
    for (const file of ['024_member_timezones.sql', '015_streak_counts_workouts.sql', '025_activity_timezones.sql']) {
        const full = path.join(__dirname, '../data/migrations', file);
        const sql = fs.readFileSync(full, 'utf8').replace(/\bNOW\(\)/gi, "current_setting('fitzo.test_clock')::timestamptz");
        await db.exec(sql);
        if (file === '025_activity_timezones.sql') await db.exec(sql);
    }
});
beforeEach(async () => {
    await setClock('2026-10-24T22:30:00Z');
    await db.exec(`TRUNCATE users, gyms, workout_logs, workout_sessions, attendances, calorie_logs, friendships, workout_intents,
        exercises, exercise_logs, set_logs, class_sessions, class_bookings, weekly_recaps, body_measurements;
        INSERT INTO users (id, name, timezone) VALUES ('${member}', 'Member', 'Europe/London'), ('${buddy}', 'Buddy', 'Asia/Kolkata');
        INSERT INTO gyms (id, name) VALUES ('${gym}', 'Gym');`);
});
after(async () => { await db.close(); });

test('workout writes, daily summary and history use the local day and keep it after travel', async () => {
    const logged = await call('post', '/workouts').send({ workout_type: 'chest' });
    assert.equal(logged.status, 200, JSON.stringify(logged.body));
    assert.equal(logged.body.workout.logged_date.slice(0, 10), '2026-10-24');
    assert.equal((await call('get', '/workouts/today')).body.summary.count, 1);
    assert.equal((await call('get', '/workouts/today', 'Asia/Kolkata')).body.summary.count, 0);
    assert.equal((await call('get', '/workouts/history')).body.history[0].logged_date.slice(0, 10), '2026-10-24');
    assert.equal((await query('SELECT check_date::text FROM attendances')).rows[0].check_date, '2026-10-24');
});

test('gym check-in upgrades synthetic attendance once, then rejects duplicate check-ins', async () => {
    await call('post', '/workouts').send({ workout_type: 'legs' });
    assert.equal((await call('post', '/checkin').send({ gym_id: gym })).status, 201);
    assert.equal((await query('SELECT check_date::text FROM attendances')).rows[0].check_date, '2026-10-24');
    assert.equal((await call('post', '/checkin').send({ gym_id: gym })).status, 409);
    assert.equal((await call('get', '/checkin/history')).body.dates[0].slice(0, 10), '2026-10-24');
});

test('friends and buddy totals use the owner day and preserve food privacy', async () => {
    await db.exec(`INSERT INTO friendships VALUES ('${member}', '${buddy}', 'accepted');
        INSERT INTO workout_logs (user_id, workout_type, visibility, logged_date, created_at) VALUES
        ('${buddy}', 'legs', 'friends', '2026-10-25', '2026-10-24T22:00:00Z');
        INSERT INTO calorie_logs (user_id, calories, visibility, logged_date, created_at, logged_timezone) VALUES
        ('${buddy}', 300, 'friends', '2026-10-25', '2026-10-24T22:00:00Z', 'Asia/Kolkata'),
        ('${buddy}', 900, 'private', '2026-10-25', '2026-10-24T22:00:00Z', 'Asia/Kolkata');`);
    const response = await call('get', '/buddy-activity/' + buddy);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.today.workouts.length, 1);
    assert.equal(response.body.today.food.total_calories, 300);
    const feed = await call('get', '/workouts/feed');
    assert.equal(feed.body.feed[0].is_today, true);
});

test('streak uses local midnight, preserves yesterday grace and counts a DST day once', async () => {
    await db.exec(`INSERT INTO workout_sessions (user_id, completed_at) VALUES
        ('${member}', '2026-10-22T23:30:00Z'), ('${member}', '2026-10-23T23:30:00Z');`);
    // New sessions record the timezone at completion; the migration leaves legacy rows intact.
    await db.exec(`UPDATE workout_sessions SET completed_timezone = 'Europe/London';`);
    assert.equal((await query('SELECT get_user_streak($1) AS streak', [member])).rows[0].streak, 2);
    await db.exec(`UPDATE users SET timezone = 'Asia/Kolkata' WHERE id = '${member}'`);
    assert.equal((await query('SELECT get_user_streak($1) AS streak', [member])).rows[0].streak, 2);
});

test('home training history respects the member month and actual gym presence', async () => {
    await setClock('2026-10-31T23:30:00Z');
    await db.exec(`INSERT INTO workout_sessions (user_id, completed_at) VALUES ('${member}', '2026-10-31T22:30:00Z');
        INSERT INTO attendances (user_id, check_date, checked_in_at, checked_out_at, checked_timezone) VALUES
        ('${member}', '2026-10-31', '2026-10-31T22:30:00Z', '2026-10-31T22:30:00Z', 'Europe/London');`);
    const response = await call('get', '/member/home');
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.deepEqual(response.body.streak.history, ['2026-10-31']);
    assert.equal(response.body.checkin.status, 'not_checked_in');
});

test('new mirrored and live sessions retain their completion day after travel', async () => {
    const logged = await call('post', '/workouts').send({ workout_type: 'chest', exercises: JSON.stringify([
        { name: 'Bench', sets: [{ reps: 8, weight_kg: 40 }] },
    ]) });
    assert.equal(logged.status, 200, JSON.stringify(logged.body));
    const live = (await db.query(`INSERT INTO workout_sessions (user_id, day_name, visibility, started_at)
        VALUES ($1, 'Pull', 'private', '2026-10-24T22:00:00Z') RETURNING id`, [member])).rows[0];
    const completed = await call('put', '/workout-sessions/sessions/' + live.id + '/complete').send({});
    assert.equal(completed.status, 200, JSON.stringify(completed.body));
    assert.deepEqual((await query('SELECT completed_timezone FROM workout_sessions')).rows.map(r => r.completed_timezone), ['Europe/London', 'Europe/London']);
    await call('get', '/workouts/today', 'Asia/Kolkata');
    await setClock('2026-10-25T23:30:00Z');
    const retried = await call('put', '/workout-sessions/sessions/' + live.id + '/complete', 'Asia/Kolkata').send({});
    assert.equal(retried.status, 200, JSON.stringify(retried.body));
    assert.equal(retried.body.session.newly_completed, false);
    assert.equal((await query('SELECT count(*)::int AS n FROM attendances')).rows[0].n, 1);
    const { sessionDaySql } = require('../src/utils/dayBoundary');
    assert.deepEqual((await query(`SELECT ${sessionDaySql()}::text AS day FROM workout_sessions`)).rows.map(r => r.day), ['2026-10-24', '2026-10-24']);
});

test('streak spans both DST changes, repeated hours and a missed day', async () => {
    for (const [instant, stamps] of [
        ['2026-03-30T00:30:00Z', ['2026-03-28T22:30:00Z', '2026-03-29T00:30:00Z', '2026-03-29T23:30:00Z']],
        ['2026-10-26T00:30:00Z', ['2026-10-24T22:30:00Z', '2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', '2026-10-26T00:10:00Z']],
    ]) {
        await setClock(instant);
        await db.exec('TRUNCATE workout_sessions');
        for (const stamp of stamps) await db.query('INSERT INTO workout_sessions (user_id, completed_at, completed_timezone) VALUES ($1,$2,$3)', [member, stamp, 'Europe/London']);
        assert.equal((await query('SELECT get_user_streak($1) AS streak', [member])).rows[0].streak, 3);
    }
    await setClock('2026-10-28T00:30:00Z');
    assert.equal((await query('SELECT get_user_streak($1) AS streak', [member])).rows[0].streak, 0);
});

test('gym buckets, classes and manager attendance follow the physical gym calendar', async () => {
    await db.exec(`UPDATE gyms SET timezone = 'Europe/London' WHERE id = '${gym}';
        UPDATE users SET role = 'manager', gym_id = '${gym}' WHERE id = '${member}';
        UPDATE users SET role = 'member', gym_id = '${gym}' WHERE id = '${buddy}';
        INSERT INTO attendances (user_id, gym_id, check_date, checked_in_at) VALUES
        ('${buddy}', '${gym}', '2026-10-25', '2026-10-24T22:00:00Z');
        INSERT INTO class_sessions (gym_id, name, scheduled_at, max_capacity) VALUES
        ('${gym}', 'Evening class', '2026-10-24T22:00:00Z', 10);`);
    assert.deepEqual(await require('../src/services/arrivalBuckets').getArrivalBuckets(gym), [{ dow: 6, hour: 23, arrivals: 1 }]);
    const classes = await call('get', '/classes?date=2026-10-24', 'Asia/Kolkata');
    assert.equal(classes.status, 200, JSON.stringify(classes.body));
    assert.equal(classes.body.sessions.length, 1);
    assert.equal(classes.body.sessions[0].time_of_day, 'evening');
    assert.equal(classes.body.sessions[0].timezone, 'Europe/London');
    assert.equal((await call('get', '/gyms/' + gym + '/busy-times')).body.busy_times.timezone, 'Europe/London');
    const members = await call('get', '/manager/members', 'Asia/Kolkata');
    assert.equal(members.status, 200, JSON.stringify(members.body));
    assert.equal(members.body.members[0].checked_in_today, true);
    const saved = await call('patch', '/manager/gym', 'Asia/Kolkata').send({ timezone: 'Asia/Kathmandu' });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.gym.timezone, 'Asia/Katmandu');
    assert.equal((await call('patch', '/manager/gym').send({ timezone: 'Invalid/Timezone' })).status, 400);
});

test('buddy food uses London day when the viewer is already in tomorrow', async () => {
    await db.exec(`UPDATE users SET timezone = 'Europe/London' WHERE id = '${buddy}';
        INSERT INTO friendships VALUES ('${member}', '${buddy}', 'accepted');
        INSERT INTO calorie_logs (user_id, calories, visibility, logged_date, created_at, logged_timezone) VALUES
        ('${buddy}', 300, 'friends', '2026-10-24', '2026-10-24T22:00:00Z', 'Europe/London');`);
    const response = await call('get', '/buddy-activity/' + buddy, 'Asia/Kolkata');
    assert.equal(response.body.today.food.total_calories, 300);
    const friends = await call('get', '/friends', 'Asia/Kolkata');
    assert.equal(friends.body.friends[0].logged_food_today, true);
});

test('an open gym visit survives midnight and checkout closes it', async (t) => {
    t.mock.method(Date, 'now', () => Date.parse(clock));
    await setClock('2026-10-24T23:10:00Z');
    await db.exec(`INSERT INTO attendances (user_id, gym_id, check_date, checked_in_at, checked_timezone)
        VALUES ('${member}', '${gym}', '2026-10-24', '2026-10-24T22:50:00Z', 'Europe/London');`);
    assert.equal((await call('get', '/checkin/status')).body.checked_in, true);
    assert.equal((await call('get', '/member/home')).body.checkin.status, 'checked_in');
    assert.equal((await call('post', '/checkin/checkout').send({})).status, 200);
    assert.equal((await call('get', '/checkin/status')).body.checked_in, false);
    assert.equal((await call('post', '/checkin/checkout').send({})).status, 200);
});

test('weekly metrics include local Monday workouts and choose a completed week per member', async () => {
    await setClock('2026-10-25T23:30:00Z');
    await db.exec(`INSERT INTO workout_sessions (user_id, completed_at, completed_timezone) VALUES
        ('${member}', '2026-10-18T23:30:00Z', 'Europe/London'),
        ('${member}', '2026-10-25T23:00:00Z', 'Europe/London');
        INSERT INTO weekly_recaps (user_id, recap_data, summary_text, week_start_date)
        VALUES ('${member}', '{}', 'Earlier week', '2026-10-12');`);
    const { generateWeeklyRecap, getLatestWeeklyRecap } = require('../src/services/weeklyRecap');
    const recap = await generateWeeklyRecap(member, '2026-10-19');
    assert.equal(recap.recap_data.workouts_count, 2);
    assert.equal((await getLatestWeeklyRecap(member)).summary_text, 'Earlier week');
    await db.query('UPDATE users SET timezone = $2 WHERE id = $1', [member, 'Asia/Kolkata']);
    assert.equal((await getLatestWeeklyRecap(member)).recap_data.workouts_count, 2);
});
