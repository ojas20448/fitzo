/**
 * One-time script: Fetch exercise images from the free-exercise-db repo (MIT licensed)
 * and create a mapping for defaultExercises.ts
 *
 * Source: https://github.com/yuhonas/free-exercise-db
 * License: MIT
 *
 * Usage: node backend/scripts/fetch_exercise_gifs.js
 */

const path = require('path');
const https = require('https');
const fs = require('fs');

const REPO_JSON_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

// Our local exercise names (from defaultExercises.ts)
const LOCAL_EXERCISES = [
    { id: 'bench_press_barbell', name: 'Barbell Bench Press', bodyPart: 'chest' },
    { id: 'incline_bench_press_barbell', name: 'Incline Barbell Bench Press', bodyPart: 'chest' },
    { id: 'decline_bench_press_barbell', name: 'Decline Barbell Bench Press', bodyPart: 'chest' },
    { id: 'close_grip_bench_press', name: 'Close Grip Bench Press', bodyPart: 'chest' },
    { id: 'reverse_grip_bench_press', name: 'Reverse Grip Bench Press', bodyPart: 'chest' },
    { id: 'dumbbell_bench_press', name: 'Dumbbell Bench Press', bodyPart: 'chest' },
    { id: 'incline_dumbbell_press', name: 'Incline Dumbbell Press', bodyPart: 'chest' },
    { id: 'decline_dumbbell_press', name: 'Decline Dumbbell Press', bodyPart: 'chest' },
    { id: 'dumbbell_fly', name: 'Dumbbell Fly', bodyPart: 'chest' },
    { id: 'incline_dumbbell_fly', name: 'Incline Dumbbell Fly', bodyPart: 'chest' },
    { id: 'dumbbell_pullover', name: 'Dumbbell Pullover', bodyPart: 'chest' },
    { id: 'chest_press_machine', name: 'Machine Chest Press', bodyPart: 'chest' },
    { id: 'pec_deck', name: 'Pec Deck / Machine Fly', bodyPart: 'chest' },
    { id: 'cable_crossover', name: 'Cable Crossover', bodyPart: 'chest' },
    { id: 'cable_fly_low_to_high', name: 'Low to High Cable Fly', bodyPart: 'chest' },
    { id: 'cable_fly_high_to_low', name: 'High to Low Cable Fly', bodyPart: 'chest' },
    { id: 'smith_machine_bench_press', name: 'Smith Machine Bench Press', bodyPart: 'chest' },
    { id: 'smith_machine_incline_press', name: 'Smith Machine Incline Press', bodyPart: 'chest' },
    { id: 'push_up', name: 'Push Up', bodyPart: 'chest' },
    { id: 'push_up_weighted', name: 'Weighted Push Up', bodyPart: 'chest' },
    { id: 'incline_push_up', name: 'Incline Push Up', bodyPart: 'chest' },
    { id: 'decline_push_up', name: 'Decline Push Up', bodyPart: 'chest' },
    { id: 'diamond_push_up', name: 'Diamond Push Up', bodyPart: 'chest' },
    { id: 'dips_chest', name: 'Dips (Chest Focus)', bodyPart: 'chest' },
    { id: 'dips_weighted', name: 'Weighted Dips', bodyPart: 'chest' },
    { id: 'pull_up', name: 'Pull Up', bodyPart: 'back' },
    { id: 'pull_up_weighted', name: 'Weighted Pull Up', bodyPart: 'back' },
    { id: 'chin_up', name: 'Chin Up', bodyPart: 'back' },
    { id: 'chin_up_weighted', name: 'Weighted Chin Up', bodyPart: 'back' },
    { id: 'lat_pulldown', name: 'Lat Pulldown', bodyPart: 'back' },
    { id: 'close_grip_lat_pulldown', name: 'Close Grip Lat Pulldown', bodyPart: 'back' },
    { id: 'reverse_grip_lat_pulldown', name: 'Reverse Grip Lat Pulldown', bodyPart: 'back' },
    { id: 'straight_arm_pulldown', name: 'Straight Arm Pulldown', bodyPart: 'back' },
    { id: 'barbell_row', name: 'Barbell Row', bodyPart: 'back' },
    { id: 'pendlay_row', name: 'Pendlay Row', bodyPart: 'back' },
    { id: 'dumbbell_row_single', name: 'Single Arm Dumbbell Row', bodyPart: 'back' },
    { id: 'chest_supported_row', name: 'Chest Supported Dumbbell Row', bodyPart: 'back' },
    { id: 'seated_cable_row', name: 'Seated Cable Row', bodyPart: 'back' },
    { id: 't_bar_row', name: 'T-Bar Row', bodyPart: 'back' },
    { id: 'machine_row', name: 'Machine Row', bodyPart: 'back' },
    { id: 'deadlift_conventional', name: 'Deadlift (Conventional)', bodyPart: 'back' },
    { id: 'deadlift_sumo', name: 'Sumo Deadlift', bodyPart: 'back' },
    { id: 'rack_pull', name: 'Rack Pull', bodyPart: 'back' },
    { id: 'back_extension', name: 'Back Extension (Hyperextension)', bodyPart: 'back' },
    { id: 'good_morning', name: 'Good Morning', bodyPart: 'back' },
    { id: 'shrugs_barbell', name: 'Barbell Shrug', bodyPart: 'back' },
    { id: 'shrugs_dumbbell', name: 'Dumbbell Shrug', bodyPart: 'back' },
    { id: 'face_pull', name: 'Face Pull', bodyPart: 'back' },
    { id: 'squat_barbell', name: 'Barbell Squat (High Bar)', bodyPart: 'legs' },
    { id: 'squat_low_bar', name: 'Barbell Squat (Low Bar)', bodyPart: 'legs' },
    { id: 'front_squat_barbell', name: 'Front Squat', bodyPart: 'legs' },
    { id: 'goblet_squat', name: 'Goblet Squat', bodyPart: 'legs' },
    { id: 'hack_squat', name: 'Hack Squat', bodyPart: 'legs' },
    { id: 'leg_press', name: 'Leg Press', bodyPart: 'legs' },
    { id: 'leg_extension', name: 'Leg Extension', bodyPart: 'legs' },
    { id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', bodyPart: 'legs' },
    { id: 'lunge_dumbbell', name: 'Dumbbell Walking Lunge', bodyPart: 'legs' },
    { id: 'lunge_reverse', name: 'Reverse Lunge', bodyPart: 'legs' },
    { id: 'step_up', name: 'Dumbbell Step Up', bodyPart: 'legs' },
    { id: 'sissy_squat', name: 'Sissy Squat', bodyPart: 'legs' },
    { id: 'romanian_deadlift_barbell', name: 'Romanian Deadlift (Barbell)', bodyPart: 'legs' },
    { id: 'romanian_deadlift_dumbbell', name: 'Romanian Deadlift (Dumbbell)', bodyPart: 'legs' },
    { id: 'stiff_leg_deadlift', name: 'Stiff Leg Deadlift', bodyPart: 'legs' },
    { id: 'leg_curl_lying', name: 'Lying Leg Curl', bodyPart: 'legs' },
    { id: 'leg_curl_seated', name: 'Seated Leg Curl', bodyPart: 'legs' },
    { id: 'hip_thrust_barbell', name: 'Barbell Hip Thrust', bodyPart: 'legs' },
    { id: 'hip_thrust_machine', name: 'Machine Hip Thrust', bodyPart: 'legs' },
    { id: 'glute_bridge', name: 'Glute Bridge', bodyPart: 'legs' },
    { id: 'cable_pull_through', name: 'Cable Pull Through', bodyPart: 'legs' },
    { id: 'glute_kickback_cable', name: 'Cable Glute Kickback', bodyPart: 'legs' },
    { id: 'kettlebell_swing', name: 'Kettlebell Swing', bodyPart: 'legs' },
    { id: 'nordic_curl', name: 'Nordic Curl', bodyPart: 'legs' },
    { id: 'calf_raise_standing', name: 'Standing Calf Raise', bodyPart: 'legs' },
    { id: 'calf_raise_seated', name: 'Seated Calf Raise', bodyPart: 'legs' },
    { id: 'calf_raise_leg_press', name: 'Leg Press Calf Raise', bodyPart: 'legs' },
    { id: 'hip_abduction_machine', name: 'Hip Abduction Machine', bodyPart: 'legs' },
    { id: 'hip_adduction_machine', name: 'Hip Adduction Machine', bodyPart: 'legs' },
    { id: 'overhead_press_barbell', name: 'Overhead Press (OHP)', bodyPart: 'shoulders' },
    { id: 'push_press', name: 'Push Press', bodyPart: 'shoulders' },
    { id: 'shoulder_press_dumbbell', name: 'Dumbbell Shoulder Press', bodyPart: 'shoulders' },
    { id: 'shoulder_press_machine', name: 'Machine Shoulder Press', bodyPart: 'shoulders' },
    { id: 'arnold_press', name: 'Arnold Press', bodyPart: 'shoulders' },
    { id: 'landmine_press', name: 'Landmine Press', bodyPart: 'shoulders' },
    { id: 'lateral_raise_dumbbell', name: 'Dumbbell Lateral Raise', bodyPart: 'shoulders' },
    { id: 'lateral_raise_cable', name: 'Cable Lateral Raise', bodyPart: 'shoulders' },
    { id: 'lateral_raise_machine', name: 'Machine Lateral Raise', bodyPart: 'shoulders' },
    { id: 'front_raise_dumbbell', name: 'Dumbbell Front Raise', bodyPart: 'shoulders' },
    { id: 'front_raise_plate', name: 'Plate Front Raise', bodyPart: 'shoulders' },
    { id: 'rear_delt_fly_dumbbell', name: 'Dumbbell Rear Delt Fly', bodyPart: 'shoulders' },
    { id: 'rear_delt_fly_machine', name: 'Machine Rear Delt Fly', bodyPart: 'shoulders' },
    { id: 'face_pull_shoulders', name: 'Face Pull', bodyPart: 'shoulders' },
    { id: 'upright_row', name: 'Upright Row', bodyPart: 'shoulders' },
    { id: 'bicep_curl_barbell', name: 'Barbell Curl', bodyPart: 'arms' },
    { id: 'bicep_curl_dumbbell', name: 'Dumbbell Curl', bodyPart: 'arms' },
    { id: 'hammer_curl', name: 'Hammer Curl', bodyPart: 'arms' },
    { id: 'preacher_curl_ez', name: 'EZ Bar Preacher Curl', bodyPart: 'arms' },
    { id: 'preacher_curl_machine', name: 'Machine Preacher Curl', bodyPart: 'arms' },
    { id: 'concentration_curl', name: 'Concentration Curl', bodyPart: 'arms' },
    { id: 'cable_curl', name: 'Cable Bicep Curl', bodyPart: 'arms' },
    { id: 'incline_dumbbell_curl', name: 'Incline Dumbbell Curl', bodyPart: 'arms' },
    { id: 'spider_curl', name: 'Spider Curl', bodyPart: 'arms' },
    { id: 'reverse_curl', name: 'Reverse Curl', bodyPart: 'arms' },
    { id: 'tricep_pushdown_rope', name: 'Tricep Rope Pushdown', bodyPart: 'arms' },
    { id: 'tricep_pushdown_bar', name: 'Tricep Bar Pushdown', bodyPart: 'arms' },
    { id: 'skullcrushers', name: 'Skullcrushers', bodyPart: 'arms' },
    { id: 'overhead_tricep_extension_dumbbell', name: 'Overhead Dumbbell Extension', bodyPart: 'arms' },
    { id: 'overhead_tricep_extension_cable', name: 'Overhead Cable Extension', bodyPart: 'arms' },
    { id: 'tricep_kickback', name: 'Tricep Kickback', bodyPart: 'arms' },
    { id: 'dips_bench', name: 'Bench Dips', bodyPart: 'arms' },
    { id: 'dips_tricep', name: 'Tricep Dips (Bars)', bodyPart: 'arms' },
    { id: 'plank', name: 'Plank', bodyPart: 'core' },
    { id: 'crunches', name: 'Crunches', bodyPart: 'core' },
    { id: 'sit_up', name: 'Sit Up', bodyPart: 'core' },
    { id: 'leg_raises_hanging', name: 'Hanging Leg Raises', bodyPart: 'core' },
    { id: 'leg_raises_lying', name: 'Lying Leg Raises', bodyPart: 'core' },
    { id: 'russian_twist', name: 'Russian Twist', bodyPart: 'core' },
    { id: 'ab_wheel_rollout', name: 'Ab Wheel Rollout', bodyPart: 'core' },
    { id: 'cable_crunch', name: 'Cable Crunch', bodyPart: 'core' },
    { id: 'woodchopper', name: 'Cable Woodchopper', bodyPart: 'core' },
    { id: 'mountain_climbers', name: 'Mountain Climbers', bodyPart: 'core' },
    { id: 'bicycle_crunches', name: 'Bicycle Crunches', bodyPart: 'core' },
    { id: 'running_treadmill', name: 'Treadmill Run', bodyPart: 'cardio' },
    { id: 'running_outdoor', name: 'Outdoor Run', bodyPart: 'cardio' },
    { id: 'cycling_stationary', name: 'Stationary Bike', bodyPart: 'cardio' },
    { id: 'elliptical', name: 'Elliptical Machine', bodyPart: 'cardio' },
    { id: 'rowing_machine', name: 'Rowing Machine', bodyPart: 'cardio' },
    { id: 'stair_climber', name: 'Stair Climber', bodyPart: 'cardio' },
    { id: 'jump_rope', name: 'Jump Rope', bodyPart: 'cardio' },
    { id: 'walking_treadmill', name: 'Treadmill Walk', bodyPart: 'cardio' },
    { id: 'clean_and_jerk', name: 'Clean and Jerk', bodyPart: 'full body' },
    { id: 'snatch', name: 'Snatch', bodyPart: 'full body' },
    { id: 'power_clean', name: 'Power Clean', bodyPart: 'full body' },
    { id: 'deadlift_high_pull', name: 'Deadlift High Pull', bodyPart: 'full body' },
    { id: 'box_jump', name: 'Box Jump', bodyPart: 'legs' },
    { id: 'burpee', name: 'Burpee', bodyPart: 'full body' },
    { id: 'battle_ropes', name: 'Battle Ropes', bodyPart: 'full body' },
    { id: 'farmers_walk', name: 'Farmers Walk', bodyPart: 'full body' },
    { id: 'sled_push', name: 'Sled Push', bodyPart: 'legs' },
    { id: 'sled_pull', name: 'Sled Pull', bodyPart: 'legs' },
    { id: 'neck_curl', name: 'Neck Curl', bodyPart: 'neck' },
    { id: 'neck_extension', name: 'Neck Extension', bodyPart: 'neck' },
];

// ─── Matching logic ───

function normalize(name) {
    return name
        .toLowerCase()
        .replace(/[()\/\-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function keywords(name) {
    const stop = new Set(['the', 'a', 'an', 'with', 'and', 'of', 'on', 'in', 'ohp']);
    return normalize(name).split(' ').filter(w => !stop.has(w) && w.length > 1);
}

// Manual overrides for tricky matches (local id → free-exercise-db id)
const MANUAL_MAP = {
    'bench_press_barbell': 'Barbell_Bench_Press_-_Medium_Grip',
    'incline_bench_press_barbell': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
    'decline_bench_press_barbell': 'Decline_Barbell_Bench_Press',
    'close_grip_bench_press': 'Close-Grip_Barbell_Bench_Press',
    'dumbbell_bench_press': 'Dumbbell_Bench_Press',
    'incline_dumbbell_press': 'Incline_Dumbbell_Press',
    'decline_dumbbell_press': 'Decline_Dumbbell_Bench_Press',
    'dumbbell_fly': 'Dumbbell_Flyes',
    'incline_dumbbell_fly': 'Incline_Dumbbell_Flyes',
    'dumbbell_pullover': 'Bent-Arm_Dumbbell_Pullover',
    'chest_press_machine': 'Machine_Bench_Press',
    'pec_deck': 'Butterfly',
    'cable_crossover': 'Cable_Crossover',
    'push_up': 'Pushups',
    'push_up_weighted': 'Pushups',
    'incline_push_up': 'Pushups',
    'decline_push_up': 'Decline_Push-Up',
    'diamond_push_up': 'Close-Grip_Barbell_Bench_Press',
    'dips_chest': 'Dips_-_Chest_Version',
    'dips_weighted': 'Dips_-_Chest_Version',
    'pull_up': 'Pullups',
    'pull_up_weighted': 'Pullups',
    'chin_up': 'Chin-Up',
    'chin_up_weighted': 'Chin-Up',
    'lat_pulldown': 'Wide-Grip_Lat_Pulldown',
    'close_grip_lat_pulldown': 'Close-Grip_Front_Lat_Pulldown',
    'reverse_grip_lat_pulldown': 'Underhand_Cable_Pulldowns',
    'straight_arm_pulldown': 'Straight-Arm_Pulldown',
    'barbell_row': 'Bent_Over_Barbell_Row',
    'pendlay_row': 'Bent_Over_Barbell_Row',
    'dumbbell_row_single': 'One-Arm_Dumbbell_Row',
    'seated_cable_row': 'Seated_Cable_Rows',
    't_bar_row': 'T-Bar_Row_with_Handle',
    'deadlift_conventional': 'Barbell_Deadlift',
    'deadlift_sumo': 'Sumo_Deadlift',
    'back_extension': 'Hyperextensions_(Back_Extensions)',
    'good_morning': 'Good_Morning',
    'shrugs_barbell': 'Barbell_Shrug',
    'shrugs_dumbbell': 'Dumbbell_Shrug',
    'face_pull': 'Face_Pull',
    'face_pull_shoulders': 'Face_Pull',
    'squat_barbell': 'Barbell_Squat',
    'squat_low_bar': 'Barbell_Squat',
    'front_squat_barbell': 'Front_Barbell_Squat',
    'goblet_squat': 'Goblet_Squat',
    'hack_squat': 'Hack_Squat',
    'leg_press': 'Leg_Press',
    'leg_extension': 'Leg_Extensions',
    'bulgarian_split_squat': 'Single_Leg_Push-off',
    'lunge_dumbbell': 'Dumbbell_Lunges',
    'lunge_reverse': 'Dumbbell_Rear_Lunge',
    'step_up': 'Dumbbell_Step_Ups',
    'romanian_deadlift_barbell': 'Romanian_Deadlift_With_Dumbbells',
    'romanian_deadlift_dumbbell': 'Romanian_Deadlift_With_Dumbbells',
    'stiff_leg_deadlift': 'Stiff-Legged_Barbell_Deadlift',
    'leg_curl_lying': 'Lying_Leg_Curls',
    'leg_curl_seated': 'Seated_Leg_Curl',
    'hip_thrust_barbell': 'Barbell_Hip_Thrust',
    'glute_bridge': 'Barbell_Glute_Bridge',
    'cable_pull_through': 'Pull_Through',
    'glute_kickback_cable': 'Glute_Kickback',
    'kettlebell_swing': 'One-Arm_Kettlebell_Swings',
    'calf_raise_standing': 'Standing_Calf_Raises',
    'calf_raise_seated': 'Seated_Calf_Raise',
    'calf_raise_leg_press': 'Calf_Press_On_The_Leg_Press_Machine',
    'hip_abduction_machine': 'Thigh_Abductor',
    'hip_adduction_machine': 'Thigh_Adductor',
    'overhead_press_barbell': 'Standing_Military_Press',
    'push_press': 'Push_Press',
    'shoulder_press_dumbbell': 'Dumbbell_Shoulder_Press',
    'shoulder_press_machine': 'Machine_Shoulder_(Military)_Press',
    'arnold_press': 'Arnold_Dumbbell_Press',
    'landmine_press': 'Landmine_180s',
    'lateral_raise_dumbbell': 'Side_Lateral_Raise',
    'lateral_raise_cable': 'Cable_Lateral_Raise',
    'front_raise_dumbbell': 'Front_Dumbbell_Raise',
    'front_raise_plate': 'Front_Plate_Raise',
    'rear_delt_fly_dumbbell': 'Seated_Bent-Over_Rear_Delt_Raise',
    'rear_delt_fly_machine': 'Reverse_Machine_Flyes',
    'upright_row': 'Upright_Barbell_Row',
    'bicep_curl_barbell': 'Barbell_Curl',
    'bicep_curl_dumbbell': 'Dumbbell_Bicep_Curl',
    'hammer_curl': 'Hammer_Curls',
    'preacher_curl_ez': 'Preacher_Curl',
    'concentration_curl': 'Concentration_Curls',
    'cable_curl': 'Cable_Hammer_Curls_-_Rope_Attachment',
    'incline_dumbbell_curl': 'Incline_Dumbbell_Curl',
    'spider_curl': 'Spider_Curl',
    'reverse_curl': 'Barbell_Curl',
    'tricep_pushdown_rope': 'Triceps_Pushdown_-_Rope_Attachment',
    'tricep_pushdown_bar': 'Triceps_Pushdown',
    'skullcrushers': 'Lying_Triceps_Press',
    'overhead_tricep_extension_dumbbell': 'Standing_Dumbbell_Triceps_Extension',
    'overhead_tricep_extension_cable': 'Cable_Lying_Triceps_Extension',
    'tricep_kickback': 'Tricep_Dumbbell_Kickback',
    'dips_bench': 'Bench_Dips',
    'dips_tricep': 'Dips_-_Triceps_Version',
    'plank': 'Front_Raise_And_Pullover',   // fallback (no dedicated plank)
    'crunches': 'Crunches',
    'sit_up': '3_4_Sit-Up',
    'leg_raises_hanging': 'Hanging_Leg_Raise',
    'leg_raises_lying': 'Flat_Bench_Lying_Leg_Raise',
    'russian_twist': 'Russian_Twist',
    'ab_wheel_rollout': 'Ab_Roller',
    'cable_crunch': 'Cable_Crunch',
    'mountain_climbers': 'Mountain_Climbers',
    'bicycle_crunches': 'Air_Bike',
    'clean_and_jerk': 'Clean_and_Jerk',
    'snatch': 'Hang_Snatch',
    'power_clean': 'Power_Clean',
    'burpee': 'Burpee',
    'box_jump': 'Box_Jump_(Multiple_Response)',
    'farmers_walk': 'Farmers_Walk',
    'jump_rope': 'Rope_Jumping',
    'rowing_machine': 'Rowing,_Stationary',
    'elliptical': 'Elliptical_Trainer',
    'cycling_stationary': 'Bicycling,_Stationary',
    'running_treadmill': 'Running,_Treadmill',
    'stair_climber': 'Stairmaster',
};

function matchScore(localName, apiName) {
    const localNorm = normalize(localName);
    const apiNorm = normalize(apiName);

    if (localNorm === apiNorm) return 100;
    if (apiNorm.includes(localNorm) || localNorm.includes(apiNorm)) return 80;

    const localKw = keywords(localName);
    const apiKw = keywords(apiName);
    const overlap = localKw.filter(w => apiKw.some(aw => aw.includes(w) || w.includes(aw)));
    return (overlap.length / Math.max(localKw.length, 1)) * 60;
}

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return fetchJSON(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Failed to parse JSON')); }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('🏋️  Fetching exercise database from free-exercise-db (MIT licensed)...\n');

    let apiExercises;
    try {
        apiExercises = await fetchJSON(REPO_JSON_URL);
        console.log(`✅ Fetched ${apiExercises.length} exercises\n`);
    } catch (err) {
        console.error('❌ Failed to fetch:', err.message);
        process.exit(1);
    }

    // Build id → exercise lookup
    const apiById = {};
    for (const ex of apiExercises) {
        apiById[ex.id] = ex;
    }

    const mapping = {};
    const unmatched = [];
    let matchedCount = 0;

    for (const local of LOCAL_EXERCISES) {
        // 1. Try manual map first
        if (MANUAL_MAP[local.id] && apiById[MANUAL_MAP[local.id]]) {
            const apiEx = apiById[MANUAL_MAP[local.id]];
            const imgPath = apiEx.images[0]; // e.g. "Barbell_Bench_Press/0.jpg"
            mapping[local.id] = `${IMAGE_BASE}/${imgPath}`;
            matchedCount++;
            console.log(`✅ ${local.name} → ${apiEx.name} (manual)`);
            continue;
        }

        // 2. Try fuzzy match
        let bestMatch = null;
        let bestScore = 0;
        for (const api of apiExercises) {
            const score = matchScore(local.name, api.name);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = api;
            }
        }

        if (bestScore >= 40 && bestMatch && bestMatch.images && bestMatch.images.length > 0) {
            mapping[local.id] = `${IMAGE_BASE}/${bestMatch.images[0]}`;
            matchedCount++;
            const marker = bestScore >= 80 ? '✅' : '🔶';
            console.log(`${marker} ${local.name} → ${bestMatch.name} (score: ${bestScore})`);
        } else {
            unmatched.push(local);
            console.log(`❌ ${local.name} → no match`);
        }
    }

    console.log(`\n📊 Results: ${matchedCount}/${LOCAL_EXERCISES.length} matched, ${unmatched.length} unmatched`);
    if (unmatched.length > 0) {
        console.log('\n⚠️  Unmatched:');
        unmatched.forEach(e => console.log(`   - ${e.name} (${e.id})`));
    }

    // Save mapping
    const mappingPath = path.resolve(__dirname, 'exercise_gif_mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
    console.log(`\n💾 Saved mapping to: ${mappingPath}`);

    console.log(`\n🎯 ${matchedCount} exercises will have images in the app.`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
