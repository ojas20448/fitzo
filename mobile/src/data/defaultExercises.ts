export interface Exercise {
    id: string;
    name: string;
    bodyPart: string;
    target: string;
    equipment: string;
    gifUrl?: string; // Optional for local, can add static images later
    custom?: boolean;
}

export const defaultExercises: Exercise[] = [
    // --- CHEST ---
    // Barbell
    { id: 'bench_press_barbell', name: 'Barbell Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'barbell' },
    { id: 'incline_bench_press_barbell', name: 'Incline Barbell Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'barbell' },
    { id: 'decline_bench_press_barbell', name: 'Decline Barbell Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'barbell' },
    { id: 'close_grip_bench_press', name: 'Close Grip Bench Press', bodyPart: 'chest', target: 'triceps', equipment: 'barbell' },
    { id: 'reverse_grip_bench_press', name: 'Reverse Grip Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'barbell' },
    // Dumbbell
    { id: 'dumbbell_bench_press', name: 'Dumbbell Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell' },
    { id: 'incline_dumbbell_press', name: 'Incline Dumbbell Press', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell' },
    { id: 'decline_dumbbell_press', name: 'Decline Dumbbell Press', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell' },
    { id: 'dumbbell_fly', name: 'Dumbbell Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell' },
    { id: 'incline_dumbbell_fly', name: 'Incline Dumbbell Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell' },
    { id: 'dumbbell_pullover', name: 'Dumbbell Pullover', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell' },
    // Machine / Cable
    { id: 'chest_press_machine', name: 'Machine Chest Press', bodyPart: 'chest', target: 'pectorals', equipment: 'machine' },
    { id: 'pec_deck', name: 'Pec Deck / Machine Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'machine' },
    { id: 'cable_crossover', name: 'Cable Crossover', bodyPart: 'chest', target: 'pectorals', equipment: 'cable' },
    { id: 'cable_fly_low_to_high', name: 'Low to High Cable Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'cable' },
    { id: 'cable_fly_high_to_low', name: 'High to Low Cable Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'cable' },
    { id: 'smith_machine_bench_press', name: 'Smith Machine Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'smith machine' },
    { id: 'smith_machine_incline_press', name: 'Smith Machine Incline Press', bodyPart: 'chest', target: 'pectorals', equipment: 'smith machine' },
    // Bodyweight
    { id: 'push_up', name: 'Push Up', bodyPart: 'chest', target: 'pectorals', equipment: 'body weight' },
    { id: 'push_up_weighted', name: 'Weighted Push Up', bodyPart: 'chest', target: 'pectorals', equipment: 'weighted' },
    { id: 'incline_push_up', name: 'Incline Push Up', bodyPart: 'chest', target: 'pectorals', equipment: 'body weight' },
    { id: 'decline_push_up', name: 'Decline Push Up', bodyPart: 'chest', target: 'pectorals', equipment: 'body weight' },
    { id: 'diamond_push_up', name: 'Diamond Push Up', bodyPart: 'chest', target: 'triceps', equipment: 'body weight' },
    { id: 'dips_chest', name: 'Dips (Chest Focus)', bodyPart: 'chest', target: 'pectorals', equipment: 'body weight' },
    { id: 'dips_weighted', name: 'Weighted Dips', bodyPart: 'chest', target: 'pectorals', equipment: 'weighted' },

    // --- BACK ---
    // Vertical Pull
    { id: 'pull_up', name: 'Pull Up', bodyPart: 'back', target: 'lats', equipment: 'body weight' },
    { id: 'pull_up_weighted', name: 'Weighted Pull Up', bodyPart: 'back', target: 'lats', equipment: 'weighted' },
    { id: 'chin_up', name: 'Chin Up', bodyPart: 'back', target: 'lats', equipment: 'body weight' },
    { id: 'chin_up_weighted', name: 'Weighted Chin Up', bodyPart: 'back', target: 'lats', equipment: 'weighted' },
    { id: 'lat_pulldown', name: 'Lat Pulldown', bodyPart: 'back', target: 'lats', equipment: 'cable' },
    { id: 'close_grip_lat_pulldown', name: 'Close Grip Lat Pulldown', bodyPart: 'back', target: 'lats', equipment: 'cable' },
    { id: 'reverse_grip_lat_pulldown', name: 'Reverse Grip Lat Pulldown', bodyPart: 'back', target: 'lats', equipment: 'cable' },
    { id: 'straight_arm_pulldown', name: 'Straight Arm Pulldown', bodyPart: 'back', target: 'lats', equipment: 'cable' },
    // Horizontal Pull
    { id: 'barbell_row', name: 'Barbell Row', bodyPart: 'back', target: 'upper back', equipment: 'barbell' },
    { id: 'pendlay_row', name: 'Pendlay Row', bodyPart: 'back', target: 'upper back', equipment: 'barbell' },
    { id: 'dumbbell_row_single', name: 'Single Arm Dumbbell Row', bodyPart: 'back', target: 'upper back', equipment: 'dumbbell' },
    { id: 'chest_supported_row', name: 'Chest Supported Dumbbell Row', bodyPart: 'back', target: 'upper back', equipment: 'dumbbell' },
    { id: 'seated_cable_row', name: 'Seated Cable Row', bodyPart: 'back', target: 'upper back', equipment: 'cable' },
    { id: 't_bar_row', name: 'T-Bar Row', bodyPart: 'back', target: 'upper back', equipment: 'machine' },
    { id: 'machine_row', name: 'Machine Row', bodyPart: 'back', target: 'upper back', equipment: 'machine' },
    // Lower Back / Traps
    { id: 'deadlift_conventional', name: 'Deadlift (Conventional)', bodyPart: 'back', target: 'spine', equipment: 'barbell' },
    { id: 'deadlift_sumo', name: 'Sumo Deadlift', bodyPart: 'back', target: 'legs', equipment: 'barbell' },
    { id: 'rack_pull', name: 'Rack Pull', bodyPart: 'back', target: 'upper back', equipment: 'barbell' },
    { id: 'back_extension', name: 'Back Extension (Hyperextension)', bodyPart: 'back', target: 'lower back', equipment: 'machine' },
    { id: 'good_morning', name: 'Good Morning', bodyPart: 'back', target: 'lower back', equipment: 'barbell' },
    { id: 'shrugs_barbell', name: 'Barbell Shrug', bodyPart: 'back', target: 'traps', equipment: 'barbell' },
    { id: 'shrugs_dumbbell', name: 'Dumbbell Shrug', bodyPart: 'back', target: 'traps', equipment: 'dumbbell' },
    { id: 'face_pull', name: 'Face Pull', bodyPart: 'back', target: 'rear delts', equipment: 'cable' },

    // --- LEGS (QUADS) ---
    { id: 'squat_barbell', name: 'Barbell Squat (High Bar)', bodyPart: 'legs', target: 'quads', equipment: 'barbell' },
    { id: 'squat_low_bar', name: 'Barbell Squat (Low Bar)', bodyPart: 'legs', target: 'quads', equipment: 'barbell' },
    { id: 'front_squat_barbell', name: 'Front Squat', bodyPart: 'legs', target: 'quads', equipment: 'barbell' },
    { id: 'goblet_squat', name: 'Goblet Squat', bodyPart: 'legs', target: 'quads', equipment: 'dumbbell' },
    { id: 'hack_squat', name: 'Hack Squat', bodyPart: 'legs', target: 'quads', equipment: 'machine' },
    { id: 'leg_press', name: 'Leg Press', bodyPart: 'legs', target: 'quads', equipment: 'machine' },
    { id: 'leg_extension', name: 'Leg Extension', bodyPart: 'legs', target: 'quads', equipment: 'machine' },
    { id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', bodyPart: 'legs', target: 'quads', equipment: 'dumbbell' },
    { id: 'lunge_dumbbell', name: 'Dumbbell Walking Lunge', bodyPart: 'legs', target: 'quads', equipment: 'dumbbell' },
    { id: 'lunge_reverse', name: 'Reverse Lunge', bodyPart: 'legs', target: 'quads', equipment: 'dumbbell' },
    { id: 'step_up', name: 'Dumbbell Step Up', bodyPart: 'legs', target: 'quads', equipment: 'dumbbell' },
    { id: 'sissy_squat', name: 'Sissy Squat', bodyPart: 'legs', target: 'quads', equipment: 'body weight' },

    // --- LEGS (HAMSTRINGS/GLUTES) ---
    { id: 'romanian_deadlift_barbell', name: 'Romanian Deadlift (Barbell)', bodyPart: 'legs', target: 'hamstrings', equipment: 'barbell' },
    { id: 'romanian_deadlift_dumbbell', name: 'Romanian Deadlift (Dumbbell)', bodyPart: 'legs', target: 'hamstrings', equipment: 'dumbbell' },
    { id: 'stiff_leg_deadlift', name: 'Stiff Leg Deadlift', bodyPart: 'legs', target: 'hamstrings', equipment: 'barbell' },
    { id: 'leg_curl_lying', name: 'Lying Leg Curl', bodyPart: 'legs', target: 'hamstrings', equipment: 'machine' },
    { id: 'leg_curl_seated', name: 'Seated Leg Curl', bodyPart: 'legs', target: 'hamstrings', equipment: 'machine' },
    { id: 'hip_thrust_barbell', name: 'Barbell Hip Thrust', bodyPart: 'legs', target: 'glutes', equipment: 'barbell' },
    { id: 'hip_thrust_machine', name: 'Machine Hip Thrust', bodyPart: 'legs', target: 'glutes', equipment: 'machine' },
    { id: 'glute_bridge', name: 'Glute Bridge', bodyPart: 'legs', target: 'glutes', equipment: 'body weight' },
    { id: 'cable_pull_through', name: 'Cable Pull Through', bodyPart: 'legs', target: 'glutes', equipment: 'cable' },
    { id: 'glute_kickback_cable', name: 'Cable Glute Kickback', bodyPart: 'legs', target: 'glutes', equipment: 'cable' },
    { id: 'kettlebell_swing', name: 'Kettlebell Swing', bodyPart: 'legs', target: 'glutes', equipment: 'kettlebell' },
    { id: 'nordic_curl', name: 'Nordic Curl', bodyPart: 'legs', target: 'hamstrings', equipment: 'body weight' },

    // --- LEGS (CALVES/OTHERS) ---
    { id: 'calf_raise_standing', name: 'Standing Calf Raise', bodyPart: 'legs', target: 'calves', equipment: 'machine' },
    { id: 'calf_raise_seated', name: 'Seated Calf Raise', bodyPart: 'legs', target: 'calves', equipment: 'machine' },
    { id: 'calf_raise_leg_press', name: 'Leg Press Calf Raise', bodyPart: 'legs', target: 'calves', equipment: 'machine' },
    { id: 'hip_abduction_machine', name: 'Hip Abduction Machine', bodyPart: 'legs', target: 'glutes', equipment: 'machine' },
    { id: 'hip_adduction_machine', name: 'Hip Adduction Machine', bodyPart: 'legs', target: 'adductors', equipment: 'machine' },

    // --- SHOULDERS ---
    // Compound
    { id: 'overhead_press_barbell', name: 'Overhead Press (OHP)', bodyPart: 'shoulders', target: 'delts', equipment: 'barbell' },
    { id: 'push_press', name: 'Push Press', bodyPart: 'shoulders', target: 'delts', equipment: 'barbell' },
    { id: 'shoulder_press_dumbbell', name: 'Dumbbell Shoulder Press', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell' },
    { id: 'shoulder_press_machine', name: 'Machine Shoulder Press', bodyPart: 'shoulders', target: 'delts', equipment: 'machine' },
    { id: 'arnold_press', name: 'Arnold Press', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell' },
    { id: 'landmine_press', name: 'Landmine Press', bodyPart: 'shoulders', target: 'delts', equipment: 'barbell' },
    // Isolation
    { id: 'lateral_raise_dumbbell', name: 'Dumbbell Lateral Raise', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell' },
    { id: 'lateral_raise_cable', name: 'Cable Lateral Raise', bodyPart: 'shoulders', target: 'delts', equipment: 'cable' },
    { id: 'lateral_raise_machine', name: 'Machine Lateral Raise', bodyPart: 'shoulders', target: 'delts', equipment: 'machine' },
    { id: 'front_raise_dumbbell', name: 'Dumbbell Front Raise', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell' },
    { id: 'front_raise_plate', name: 'Plate Front Raise', bodyPart: 'shoulders', target: 'delts', equipment: 'weight plate' },
    { id: 'rear_delt_fly_dumbbell', name: 'Dumbbell Rear Delt Fly', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell' },
    { id: 'rear_delt_fly_machine', name: 'Machine Rear Delt Fly', bodyPart: 'shoulders', target: 'delts', equipment: 'machine' },
    { id: 'face_pull_shoulders', name: 'Face Pull', bodyPart: 'shoulders', target: 'delts', equipment: 'cable' },
    { id: 'upright_row', name: 'Upright Row', bodyPart: 'shoulders', target: 'traps', equipment: 'barbell' },

    // --- ARMS (BICEPS) ---
    { id: 'bicep_curl_barbell', name: 'Barbell Curl', bodyPart: 'arms', target: 'biceps', equipment: 'barbell' },
    { id: 'bicep_curl_dumbbell', name: 'Dumbbell Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell' },
    { id: 'hammer_curl', name: 'Hammer Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell' },
    { id: 'preacher_curl_ez', name: 'EZ Bar Preacher Curl', bodyPart: 'arms', target: 'biceps', equipment: 'ez bar' },
    { id: 'preacher_curl_machine', name: 'Machine Preacher Curl', bodyPart: 'arms', target: 'biceps', equipment: 'machine' },
    { id: 'concentration_curl', name: 'Concentration Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell' },
    { id: 'cable_curl', name: 'Cable Bicep Curl', bodyPart: 'arms', target: 'biceps', equipment: 'cable' },
    { id: 'incline_dumbbell_curl', name: 'Incline Dumbbell Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell' },
    { id: 'spider_curl', name: 'Spider Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell' },
    { id: 'reverse_curl', name: 'Reverse Curl', bodyPart: 'arms', target: 'forearms', equipment: 'barbell' },

    // --- ARMS (TRICEPS) ---
    { id: 'tricep_pushdown_rope', name: 'Tricep Rope Pushdown', bodyPart: 'arms', target: 'triceps', equipment: 'cable' },
    { id: 'tricep_pushdown_bar', name: 'Tricep Bar Pushdown', bodyPart: 'arms', target: 'triceps', equipment: 'cable' },
    { id: 'skullcrushers', name: 'Skullcrushers', bodyPart: 'arms', target: 'triceps', equipment: 'ez bar' },
    { id: 'overhead_tricep_extension_dumbbell', name: 'Overhead Dumbbell Extension', bodyPart: 'arms', target: 'triceps', equipment: 'dumbbell' },
    { id: 'overhead_tricep_extension_cable', name: 'Overhead Cable Extension', bodyPart: 'arms', target: 'triceps', equipment: 'cable' },
    { id: 'tricep_kickback', name: 'Tricep Kickback', bodyPart: 'arms', target: 'triceps', equipment: 'dumbbell' },
    { id: 'dips_bench', name: 'Bench Dips', bodyPart: 'arms', target: 'triceps', equipment: 'body weight' },
    { id: 'dips_tricep', name: 'Tricep Dips (Bars)', bodyPart: 'arms', target: 'triceps', equipment: 'body weight' },
    { id: 'close_grip_bench_press', name: 'Close Grip Bench Press', bodyPart: 'arms', target: 'triceps', equipment: 'barbell' },

    // --- CORE ---
    { id: 'plank', name: 'Plank', bodyPart: 'core', target: 'abs', equipment: 'body weight' },
    { id: 'crunches', name: 'Crunches', bodyPart: 'core', target: 'abs', equipment: 'body weight' },
    { id: 'sit_up', name: 'Sit Up', bodyPart: 'core', target: 'abs', equipment: 'body weight' },
    { id: 'leg_raises_hanging', name: 'Hanging Leg Raises', bodyPart: 'core', target: 'abs', equipment: 'body weight' },
    { id: 'leg_raises_lying', name: 'Lying Leg Raises', bodyPart: 'core', target: 'abs', equipment: 'body weight' },
    { id: 'russian_twist', name: 'Russian Twist', bodyPart: 'core', target: 'abs', equipment: 'body weight' },
    { id: 'ab_wheel_rollout', name: 'Ab Wheel Rollout', bodyPart: 'core', target: 'abs', equipment: 'other' },
    { id: 'cable_crunch', name: 'Cable Crunch', bodyPart: 'core', target: 'abs', equipment: 'cable' },
    { id: 'woodchopper', name: 'Cable Woodchopper', bodyPart: 'core', target: 'obliques', equipment: 'cable' },
    { id: 'mountain_climbers', name: 'Mountain Climbers', bodyPart: 'core', target: 'abs', equipment: 'body weight' },
    { id: 'bicycle_crunches', name: 'Bicycle Crunches', bodyPart: 'core', target: 'abs', equipment: 'body weight' },

    // --- CARDIO ---
    { id: 'running_treadmill', name: 'Treadmill Run', bodyPart: 'cardio', target: 'cardiovascular', equipment: 'machine' },
    { id: 'running_outdoor', name: 'Outdoor Run', bodyPart: 'cardio', target: 'cardiovascular', equipment: 'body weight' },
    { id: 'cycling_stationary', name: 'Stationary Bike', bodyPart: 'cardio', target: 'cardiovascular', equipment: 'machine' },
    { id: 'elliptical', name: 'Elliptical Machine', bodyPart: 'cardio', target: 'cardiovascular', equipment: 'machine' },
    { id: 'rowing_machine', name: 'Rowing Machine', bodyPart: 'cardio', target: 'full body', equipment: 'machine' },
    { id: 'stair_climber', name: 'Stair Climber', bodyPart: 'cardio', target: 'legs', equipment: 'machine' },
    { id: 'jump_rope', name: 'Jump Rope', bodyPart: 'cardio', target: 'calves', equipment: 'other' },
    { id: 'walking_treadmill', name: 'Treadmill Walk', bodyPart: 'cardio', target: 'cardiovascular', equipment: 'machine' },

    // --- FUNCTIONAL / OLYMPIC ---
    { id: 'clean_and_jerk', name: 'Clean and Jerk', bodyPart: 'full body', target: 'full body', equipment: 'barbell' },
    { id: 'snatch', name: 'Snatch', bodyPart: 'full body', target: 'full body', equipment: 'barbell' },
    { id: 'power_clean', name: 'Power Clean', bodyPart: 'full body', target: 'full body', equipment: 'barbell' },
    { id: 'deadlift_high_pull', name: 'Deadlift High Pull', bodyPart: 'full body', target: 'full body', equipment: 'barbell' },
    { id: 'box_jump', name: 'Box Jump', bodyPart: 'legs', target: 'legs', equipment: 'box' },
    { id: 'burpee', name: 'Burpee', bodyPart: 'full body', target: 'full body', equipment: 'body weight' },
    { id: 'battle_ropes', name: 'Battle Ropes', bodyPart: 'full body', target: 'full body', equipment: 'rope' },
    { id: 'farmers_walk', name: 'Farmers Walk', bodyPart: 'full body', target: 'grip', equipment: 'dumbbell' },
    { id: 'sled_push', name: 'Sled Push', bodyPart: 'legs', target: 'legs', equipment: 'sled' },
    { id: 'sled_pull', name: 'Sled Pull', bodyPart: 'legs', target: 'legs', equipment: 'sled' },

    // --- NECK (Optional but complete) ---
    { id: 'neck_curl', name: 'Neck Curl', bodyPart: 'neck', target: 'neck', equipment: 'weight plate' },
    { id: 'neck_extension', name: 'Neck Extension', bodyPart: 'neck', target: 'neck', equipment: 'harness' },
];

export const bodyPartsList = [
    'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full body', 'neck'
];
