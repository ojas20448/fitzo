/**
 * Seed the app-store reviewer account.
 *
 * Google Play and Apple both reject apps whose functionality sits behind a
 * login they cannot get past, and both reject apps that look empty. A reviewer
 * who signs in and lands on blank charts has no way to evaluate the app, so
 * this seeds a realistic history rather than a bare account: three weeks of a
 * push/pull/legs split with progressive overload, two weeks of meals, and a
 * body-weight trend that actually moves.
 *
 * The same account is what the screenshot pipeline captures, so the numbers on
 * the store listing are real app output rather than drawn mock-ups.
 *
 *   node scripts/seed_review_account.js            # create / refresh
 *   node scripts/seed_review_account.js --remove   # delete it again
 *
 * SAFETY: this script can only ever touch REVIEW_EMAIL. Every delete is
 * filtered on that literal address, so it cannot be pointed at a real user by
 * editing an argument. Deleting the users row cascades to the fifteen
 * ON DELETE CASCADE children, so --remove leaves nothing behind.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('../src/config/database');

const REVIEW_EMAIL = 'review@fitzo.app';
const REVIEW_NAME = 'Aarav Kapoor';
// Not a secret: it is printed in the Play Console and App Store Connect review
// notes by design. It must stay stable — rotating it mid-review locks the
// reviewer out and the submission is rejected for "cannot sign in".
const REVIEW_PASSWORD = 'FitzoReview2026!';

// ── The split ────────────────────────────────────────────────────────────────
// Real exercise names and plausible loads. Reviewers and screenshots both look
// better with "Barbell Bench Press / 82.5 kg" than "Exercise 1 / 100".
const SPLIT = [
    {
        day: 'Push', group: 'chest', exercises: [
            { name: 'Barbell Bench Press', base: 72.5, reps: [8, 8, 7, 6] },
            { name: 'Incline Dumbbell Press', base: 28, reps: [10, 10, 9] },
            { name: 'Overhead Press', base: 45, reps: [8, 8, 7] },
            { name: 'Cable Fly', base: 20, reps: [12, 12, 12] },
            { name: 'Triceps Rope Pushdown', base: 32.5, reps: [12, 12, 10] },
        ],
    },
    {
        day: 'Pull', group: 'back', exercises: [
            { name: 'Deadlift', base: 120, reps: [5, 5, 5] },
            { name: 'Pull Up', base: 0, reps: [10, 9, 8] },
            { name: 'Barbell Row', base: 65, reps: [8, 8, 8] },
            { name: 'Face Pull', base: 25, reps: [15, 15, 15] },
            { name: 'Barbell Curl', base: 30, reps: [10, 10, 9] },
        ],
    },
    {
        day: 'Legs', group: 'legs', exercises: [
            { name: 'Back Squat', base: 95, reps: [6, 6, 5, 5] },
            { name: 'Romanian Deadlift', base: 80, reps: [10, 10, 8] },
            { name: 'Leg Press', base: 160, reps: [12, 12, 10] },
            { name: 'Leg Curl', base: 45, reps: [12, 12, 12] },
            { name: 'Standing Calf Raise', base: 60, reps: [15, 15, 15] },
        ],
    },
];

// Indian-leaning meals, matching the app's primary market and its IFCT2017
// food database.
const MEALS = {
    breakfast: [
        { food_name: 'Masala Oats with Whey', calories: 420, protein: 34, carbs: 52, fat: 8 },
        { food_name: 'Paneer Bhurji + 2 Roti', calories: 510, protein: 32, carbs: 48, fat: 22 },
        { food_name: '4 Egg Omelette + Toast', calories: 465, protein: 33, carbs: 30, fat: 24 },
    ],
    lunch: [
        { food_name: 'Chicken Curry, Rice, Salad', calories: 680, protein: 52, carbs: 74, fat: 18 },
        { food_name: 'Rajma Chawal + Curd', calories: 640, protein: 26, carbs: 96, fat: 14 },
        { food_name: 'Grilled Fish, Quinoa, Greens', calories: 590, protein: 48, carbs: 52, fat: 18 },
    ],
    snack: [
        { food_name: 'Whey Shake + Banana', calories: 290, protein: 28, carbs: 36, fat: 3 },
        { food_name: 'Roasted Chana + Curd', calories: 240, protein: 18, carbs: 28, fat: 6 },
        { food_name: 'Peanut Butter Toast', calories: 310, protein: 12, carbs: 32, fat: 16 },
    ],
    dinner: [
        { food_name: 'Tandoori Chicken + Dal', calories: 620, protein: 58, carbs: 42, fat: 20 },
        { food_name: 'Paneer Tikka + Roti', calories: 580, protein: 34, carbs: 46, fat: 26 },
        { food_name: 'Egg Curry + Brown Rice', calories: 555, protein: 34, carbs: 58, fat: 19 },
    ],
};

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

async function findUser() {
    const r = await query('SELECT id FROM users WHERE email = $1', [REVIEW_EMAIL]);
    return r.rows[0]?.id || null;
}

async function remove() {
    // Filtered on the literal constant, never on input. The FK cascades take
    // care of every child row.
    const r = await query('DELETE FROM users WHERE email = $1', [REVIEW_EMAIL]);
    console.log(r.rowCount ? `Removed ${REVIEW_EMAIL}` : `${REVIEW_EMAIL} did not exist`);
}

async function seed() {
    // Idempotent: wipe and rebuild so re-running never doubles the history.
    await remove();

    const hash = await bcrypt.hash(REVIEW_PASSWORD, 10);
    // `username` is NOT NULL and UNIQUE. It is absent from schema.sql because
    // src/db/migrate_username.sql adds it afterwards — schema.sql is the base
    // table, migrations layer on top — so any INSERT here must supply it.
    const user = await query(
        `INSERT INTO users (email, password_hash, name, username, role, avatar_url, xp_points)
         VALUES ($1, $2, $3, $4, 'member', 'avatar_lion', 2450)
         RETURNING id`,
        [REVIEW_EMAIL, hash, REVIEW_NAME, 'appreview']
    );
    const uid = user.rows[0].id;
    console.log(`Created user ${uid}`);

    // Onboarding is considered complete exactly when a nutrition_profiles row
    // exists, so this row is what drops the reviewer on the home screen instead
    // of the onboarding wizard.
    await query(
        `INSERT INTO nutrition_profiles
           (user_id, weight_kg, height_cm, age, gender, activity_level, goal_type,
            target_weight_kg, weekly_goal_kg, target_calories, target_protein,
            target_carbs, target_fat, is_vegetarian, protein_priority)
         VALUES ($1, 78.4, 178, 28, 'male', 'active', 'muscle_gain',
                 82, 0.25, 2680, 165, 290, 78, false, true)`,
        [uid]
    );
    await query(
        `INSERT INTO fitness_profiles
           (user_id, goal_type, current_weight, target_weight, height, age,
            gender, activity_level, target_calories)
         VALUES ($1, 'surplus', 78.4, 82, 178, 28, 'male', 'active', 2680)`,
        [uid]
    );

    // ── 3 weeks of training ─────────────────────────────────────────────────
    // Six sessions a week, PPL twice over, skipping Sundays. Load climbs ~1.5%
    // per week so the progress charts and PR detection have a real upward
    // trend to draw rather than a flat line.
    let sessions = 0, sets = 0;
    for (let day = 20; day >= 0; day--) {
        const date = daysAgo(day);
        if (date.getDay() === 0) continue;               // rest day
        const plan = SPLIT[sessions % SPLIT.length];
        const weekIndex = Math.floor((20 - day) / 7);
        const progression = 1 + weekIndex * 0.015;

        const started = new Date(date); started.setHours(18, 30, 0, 0);
        const duration = 58 + (sessions % 5) * 3;
        const completed = new Date(started.getTime() + duration * 60000);

        const s = await query(
            `INSERT INTO workout_sessions
               (user_id, split_id, day_name, started_at, completed_at,
                duration_minutes, visibility)
             VALUES ($1, 'ppl_6', $2, $3, $4, $5, 'friends') RETURNING id`,
            [uid, plan.day, started, completed, duration]
        );
        const sid = s.rows[0].id;

        for (const [i, ex] of plan.exercises.entries()) {
            // Link to the catalogue row when the name matches. This matters:
            // the Muscle Volume heatmap resolves muscle groups through
            // exercise_logs.exercise_id, so a log with only
            // custom_exercise_name set counts as ZERO sets for every muscle
            // group. Seeding without this produced 282 logged sets and a
            // heatmap reading "UNTRAINED" across the board.
            const e = await query(
                `INSERT INTO exercise_logs
                   (session_id, exercise_id, custom_exercise_name, order_index)
                 VALUES ($1, (SELECT id FROM exercises WHERE name = $2 LIMIT 1), $2, $3)
                 RETURNING id`,
                [sid, ex.name, i]
            );
            for (const [j, reps] of ex.reps.entries()) {
                // Round to 2.5 kg so the plate calculator shows loadable weights.
                const w = ex.base === 0
                    ? 0
                    : Math.round((ex.base * progression) / 2.5) * 2.5;
                await query(
                    `INSERT INTO set_logs
                       (exercise_log_id, set_number, reps, weight_kg, rpe)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [e.rows[0].id, j + 1, reps, w, 7 + (j % 3)]
                );
                sets++;
            }
        }

        // Summary row — this is what the squad feed and heatmap read.
        await query(
            `INSERT INTO workout_logs
               (user_id, workout_type, exercises, logged_date, visibility)
             VALUES ($1, $2, $3, $4, 'friends')`,
            [uid, plan.group, plan.exercises.map(e => e.name).join(', '), iso(date)]
        );
        sessions++;
    }
    console.log(`Seeded ${sessions} sessions / ${sets} sets`);

    // ── 2 weeks of nutrition ────────────────────────────────────────────────
    let meals = 0;
    for (let day = 13; day >= 0; day--) {
        const date = iso(daysAgo(day));
        for (const type of ['breakfast', 'lunch', 'snack', 'dinner']) {
            const m = MEALS[type][(day + type.length) % MEALS[type].length];
            await query(
                `INSERT INTO calorie_logs
                   (user_id, food_name, calories, protein, carbs, fat,
                    serving_size, meal_type, logged_date, visibility)
                 VALUES ($1, $2, $3, $4, $5, $6, '1 serving', $7, $8, 'friends')`,
                [uid, m.food_name, m.calories, m.protein, m.carbs, m.fat, type, date]
            );
            meals++;
        }
    }
    console.log(`Seeded ${meals} meals`);

    // ── Body-weight trend ───────────────────────────────────────────────────
    // Weekly points, gaining slowly — matches the muscle_gain goal above so the
    // weight chart and the stated goal don't contradict each other.
    let weights = 0;
    for (const [i, day] of [56, 49, 42, 35, 28, 21, 14, 7, 0].entries()) {
        await query(
            `INSERT INTO body_measurements (user_id, weight, body_fat, recorded_at)
             VALUES ($1, $2, $3, $4)`,
            [uid, (76.8 + i * 0.2).toFixed(1), (15.4 - i * 0.1).toFixed(1), daysAgo(day)]
        );
        weights++;
    }
    console.log(`Seeded ${weights} weigh-ins`);

    // ── Gym membership ──────────────────────────────────────────────────────
    // Attaches to an existing demo gym rather than creating one, so the gym
    // leaderboard and QR check-in screens have something to render. Guarded by
    // a lookup so this is a no-op if the demo gyms are ever removed.
    const gym = await query(`SELECT id FROM gyms WHERE qr_code = 'IRONPARADISE01'`);
    if (gym.rows.length) {
        await query('UPDATE users SET gym_id = $1 WHERE id = $2', [gym.rows[0].id, uid]);
        console.log('Joined demo gym');
    } else {
        console.log('Demo gym not found — skipping gym membership');
    }

    // ── Active split ────────────────────────────────────────────────────────
    // Without this the home screen shows "Today's Training — Set up your split",
    // which reads as an unfinished app in a store screenshot.
    await query(
        `INSERT INTO user_splits (user_id, split_id, name, days, days_per_week, is_active)
         VALUES ($1, 'ppl_6', 'PPL (6 Day)', $2, 6, true)`,
        // `days` is a Postgres text[], not jsonb — pass the JS array and let
        // node-postgres do the conversion. JSON.stringify here produces a
        // "malformed array literal" error.
        [uid, ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']]
    );

    // ── Check-in streak ─────────────────────────────────────────────────────
    // get_user_streak() walks backwards through `attendances` day by day and
    // stops at the first gap, so the rows must be unbroken from today. Workout
    // sessions do not feed the streak — only gym check-ins do.
    if (gym.rows.length) {
        let streak = 0;
        for (let day = 13; day >= 0; day--) {
            const d = daysAgo(day);
            const at = new Date(d); at.setHours(18, 25, 0, 0);
            await query(
                `INSERT INTO attendances (user_id, gym_id, check_date, checked_in_at)
                 VALUES ($1, $2, $3, $4)`,
                [uid, gym.rows[0].id, iso(d), at]
            );
            streak++;
        }
        console.log(`Seeded ${streak}-day check-in streak`);
    }

    console.log(`\n  Reviewer account ready\n    ${REVIEW_EMAIL}\n    ${REVIEW_PASSWORD}\n`);
}

const run = process.argv.includes('--remove') ? remove : seed;
run()
    .then(() => process.exit(0))
    .catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
