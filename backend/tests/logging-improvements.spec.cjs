const { PGlite } = require('@electric-sql/pglite');
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { FREQUENT_FOODS_SQL } = require('../src/utils/frequentFoods');
const { loggingMetrics, reportOptions } = require('../src/services/loggingMetrics');
let db;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const asOf = '2026-10-22T00:00:00Z';
before(async () => {
    db = new PGlite();
    await db.exec(`CREATE TABLE users (id uuid PRIMARY KEY, role text, created_at timestamptz);
        CREATE TABLE calorie_logs (id uuid DEFAULT gen_random_uuid(), user_id uuid, food_name text, calories integer, protein integer, carbs integer, fat integer, serving_size text, meal_type text, is_estimate boolean, created_at timestamptz);
        CREATE TABLE workout_logs (id uuid DEFAULT gen_random_uuid(), user_id uuid, completed boolean, created_at timestamptz);
        CREATE TABLE workout_sessions (user_id uuid, completed_at timestamptz, source_workout_log_id uuid);`);
});
after(async () => db.close());
test('frequent foods use one latest actual portion, deterministic ties and only the requesting account', async () => {
    await db.exec(`INSERT INTO calorie_logs (id, user_id, food_name, calories, protein, carbs, fat, serving_size, meal_type, created_at) VALUES
        ('${id(101)}','${id(90)}','Rice',130,3,28,0,'100g','lunch','2026-10-01Z'),
        ('${id(102)}','${id(90)}','Rice',260,6,56,0,'200g','dinner','2026-10-02Z'),
        ('${id(103)}','${id(90)}','Rice',390,9,84,0,'300g','dinner','2026-10-02Z'),
        ('${id(104)}','${id(91)}','Rice',999,999,999,999,'999g','snack','2026-10-03Z'),
        ('${id(105)}','${id(90)}','Dal',200,12,20,5,'1 bowl','lunch','2026-10-03Z');`);
    const { rows } = await db.query(FREQUENT_FOODS_SQL, [id(90), 10]);
    assert.equal(rows.length, 2);
    assert.deepEqual({ ...rows[0], last_logged_at: undefined }, {
        entry_id: id(103), name: 'Rice', calories: 390, protein: 9, carbs: 84, fat: 0,
        serving_size: '300g', meal_type: 'dinner', is_estimate: null, last_logged_at: undefined, usage_count: 3,
    });
    assert.equal(rows[1].serving_size, '1 bowl');
});
test('funnel includes completed logs only and rates exclude immature accounts; week-two boundaries are exact', async () => {
    await db.exec(`INSERT INTO users VALUES
        ('${id(1)}','member','2026-10-01Z'),
        ('${id(2)}','member','2026-10-01Z'),
        ('${id(3)}','member','2026-10-01Z'),
        ('${id(4)}','member','2026-10-20Z'),
        ('${id(5)}','member','2026-10-01Z'),
        ('${id(6)}','member','2026-10-01Z'),
        ('${id(7)}','manager','2026-10-01Z'),
        ('${id(8)}','member','2026-10-01Z');
        INSERT INTO calorie_logs (user_id, created_at) VALUES
        ('${id(1)}','2026-10-02Z'),('${id(1)}','2026-10-09Z'),
        ('${id(2)}','2026-10-02Z'),('${id(2)}','2026-10-16Z'),
        ('${id(4)}','2026-10-20Z'),
        ('${id(5)}','2026-10-10Z'),
        ('${id(7)}','2026-10-02Z'),('${id(8)}','2026-10-02Z');
        INSERT INTO workout_logs (id, user_id, completed, created_at) VALUES
        ('${id(201)}','${id(6)}',true,'2026-10-02Z'),
        ('${id(202)}','${id(3)}',false,'2026-10-02Z');
        INSERT INTO workout_sessions VALUES
        ('${id(6)}','2026-10-09Z','${id(201)}'),
        ('${id(6)}',NULL,NULL),
        ('${id(6)}','2026-10-08T23:59:59Z',NULL);`);
    const report = await loggingMetrics((sql, params) => db.query(sql, params), {
        from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z', asOf, excludeUserIds: [id(8)],
    });
    const all = report.cohorts.find(row => row.cohort === 'all');
    assert.deepEqual(all, { cohort: 'all', signups: 6, first_log_users: 5,
        activation_eligible: 5, activated_in_7_days: 3, activation_pending: 1,
        retention_eligible: 3, returned_week_2: 1, retention_pending: 2,
        activation_percent: 60, week_2_retention_percent: 33.3 });
    // A real standalone completed session at the boundary qualifies; its
    // linked mirror above must not count as a second log on its own.
    await db.exec(`INSERT INTO workout_sessions VALUES ('${id(6)}','2026-10-09Z',NULL);`);
    const next = await loggingMetrics((sql, params) => db.query(sql, params), {
        from: report.from, to: report.to, asOf, excludeUserIds: [id(8)],
    });
    assert.equal(next.cohorts.find(row => row.cohort === 'all').returned_week_2, 2);
    assert.equal(report.cohorts.find(row => row.cohort === '2026-10-19').week_2_retention_percent, null);
});
test('empty cohorts have null rates, and a fixed as-of timestamp never sees future logs', async () => {
    const report = await loggingMetrics((sql, params) => db.query(sql, params), {
        from: '2027-01-01T00:00:00Z', to: '2027-02-01T00:00:00Z', asOf,
    });
    assert.equal(report.cohorts[0].signups, 0);
    assert.equal(report.cohorts[0].activation_percent, null);
    assert.equal(report.cohorts[0].week_2_retention_percent, null);
});
test('report arguments reject unsafe and ambiguous dates before a database connection', () => {
    assert.throws(() => reportOptions({ from: '2026-10-01', to: asOf }));
    assert.throws(() => reportOptions({ from: asOf, to: asOf }));
    assert.throws(() => reportOptions({ from: '2026-10-01T00:00:00Z', to: asOf, excludeUserIds: ['bad'] }));
});
