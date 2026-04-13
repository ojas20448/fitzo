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
    { id: 'bench_press_barbell', name: 'Barbell Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Bench_Press_-_Medium_Grip/0.jpg'  },
    { id: 'incline_bench_press_barbell', name: 'Incline Barbell Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Incline_Bench_Press_-_Medium_Grip/0.jpg'  },
    { id: 'decline_bench_press_barbell', name: 'Decline Barbell Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Decline_Barbell_Bench_Press/0.jpg'  },
    { id: 'close_grip_bench_press', name: 'Close Grip Bench Press', bodyPart: 'chest', target: 'triceps', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Close-Grip_Barbell_Bench_Press/0.jpg'  },
    { id: 'reverse_grip_bench_press', name: 'Reverse Grip Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Bench_Press_-_Medium_Grip/0.jpg'  },
    // Dumbbell
    { id: 'dumbbell_bench_press', name: 'Dumbbell Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dumbbell_Bench_Press/0.jpg'  },
    { id: 'incline_dumbbell_press', name: 'Incline Dumbbell Press', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Incline_Dumbbell_Press/0.jpg'  },
    { id: 'decline_dumbbell_press', name: 'Decline Dumbbell Press', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Decline_Dumbbell_Bench_Press/0.jpg'  },
    { id: 'dumbbell_fly', name: 'Dumbbell Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dumbbell_Flyes/0.jpg'  },
    { id: 'incline_dumbbell_fly', name: 'Incline Dumbbell Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Incline_Dumbbell_Flyes/0.jpg'  },
    { id: 'dumbbell_pullover', name: 'Dumbbell Pullover', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Bent-Arm_Dumbbell_Pullover/0.jpg'  },
    // Machine / Cable
    { id: 'chest_press_machine', name: 'Machine Chest Press', bodyPart: 'chest', target: 'pectorals', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Machine_Bench_Press/0.jpg'  },
    { id: 'pec_deck', name: 'Pec Deck / Machine Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Butterfly/0.jpg'  },
    { id: 'cable_crossover', name: 'Cable Crossover', bodyPart: 'chest', target: 'pectorals', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Cable_Crossover/0.jpg'  },
    { id: 'cable_fly_low_to_high', name: 'Low to High Cable Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'cable' },
    { id: 'cable_fly_high_to_low', name: 'High to Low Cable Fly', bodyPart: 'chest', target: 'pectorals', equipment: 'cable' },
    { id: 'smith_machine_bench_press', name: 'Smith Machine Bench Press', bodyPart: 'chest', target: 'pectorals', equipment: 'smith machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Smith_Machine_Bench_Press/0.jpg'  },
    { id: 'smith_machine_incline_press', name: 'Smith Machine Incline Press', bodyPart: 'chest', target: 'pectorals', equipment: 'smith machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Smith_Machine_Incline_Bench_Press/0.jpg'  },
    // Bodyweight
    { id: 'push_up', name: 'Push Up', bodyPart: 'chest', target: 'pectorals', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Pushups/0.jpg'  },
    { id: 'push_up_weighted', name: 'Weighted Push Up', bodyPart: 'chest', target: 'pectorals', equipment: 'weighted', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Pushups/0.jpg'  },
    { id: 'incline_push_up', name: 'Incline Push Up', bodyPart: 'chest', target: 'pectorals', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Pushups/0.jpg'  },
    { id: 'decline_push_up', name: 'Decline Push Up', bodyPart: 'chest', target: 'pectorals', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Decline_Push-Up/0.jpg'  },
    { id: 'diamond_push_up', name: 'Diamond Push Up', bodyPart: 'chest', target: 'triceps', equipment: 'body weight' },
    { id: 'dips_chest', name: 'Dips (Chest Focus)', bodyPart: 'chest', target: 'pectorals', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dips_-_Chest_Version/0.jpg'  },
    { id: 'dips_weighted', name: 'Weighted Dips', bodyPart: 'chest', target: 'pectorals', equipment: 'weighted', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dips_-_Chest_Version/0.jpg'  },

    // --- BACK ---
    // Vertical Pull
    { id: 'pull_up', name: 'Pull Up', bodyPart: 'back', target: 'lats', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Pullups/0.jpg'  },
    { id: 'pull_up_weighted', name: 'Weighted Pull Up', bodyPart: 'back', target: 'lats', equipment: 'weighted', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Pullups/0.jpg'  },
    { id: 'chin_up', name: 'Chin Up', bodyPart: 'back', target: 'lats', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Chin-Up/0.jpg'  },
    { id: 'chin_up_weighted', name: 'Weighted Chin Up', bodyPart: 'back', target: 'lats', equipment: 'weighted', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Chin-Up/0.jpg'  },
    { id: 'lat_pulldown', name: 'Lat Pulldown', bodyPart: 'back', target: 'lats', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Wide-Grip_Lat_Pulldown/0.jpg'  },
    { id: 'close_grip_lat_pulldown', name: 'Close Grip Lat Pulldown', bodyPart: 'back', target: 'lats', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Close-Grip_Front_Lat_Pulldown/0.jpg'  },
    { id: 'reverse_grip_lat_pulldown', name: 'Reverse Grip Lat Pulldown', bodyPart: 'back', target: 'lats', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Underhand_Cable_Pulldowns/0.jpg'  },
    { id: 'straight_arm_pulldown', name: 'Straight Arm Pulldown', bodyPart: 'back', target: 'lats', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Straight-Arm_Pulldown/0.jpg'  },
    // Horizontal Pull
    { id: 'barbell_row', name: 'Barbell Row', bodyPart: 'back', target: 'upper back', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Bent_Over_Barbell_Row/0.jpg'  },
    { id: 'pendlay_row', name: 'Pendlay Row', bodyPart: 'back', target: 'upper back', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Bent_Over_Barbell_Row/0.jpg'  },
    { id: 'dumbbell_row_single', name: 'Single Arm Dumbbell Row', bodyPart: 'back', target: 'upper back', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/One-Arm_Dumbbell_Row/0.jpg'  },
    { id: 'chest_supported_row', name: 'Chest Supported Dumbbell Row', bodyPart: 'back', target: 'upper back', equipment: 'dumbbell' },
    { id: 'seated_cable_row', name: 'Seated Cable Row', bodyPart: 'back', target: 'upper back', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Seated_Cable_Rows/0.jpg'  },
    { id: 't_bar_row', name: 'T-Bar Row', bodyPart: 'back', target: 'upper back', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/T-Bar_Row_with_Handle/0.jpg'  },
    { id: 'machine_row', name: 'Machine Row', bodyPart: 'back', target: 'upper back', equipment: 'machine' },
    // Lower Back / Traps
    { id: 'deadlift_conventional', name: 'Deadlift (Conventional)', bodyPart: 'back', target: 'spine', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Deadlift/0.jpg'  },
    { id: 'deadlift_sumo', name: 'Sumo Deadlift', bodyPart: 'back', target: 'legs', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Sumo_Deadlift/0.jpg'  },
    { id: 'rack_pull', name: 'Rack Pull', bodyPart: 'back', target: 'upper back', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Rack_Pull_with_Bands/0.jpg'  },
    { id: 'back_extension', name: 'Back Extension (Hyperextension)', bodyPart: 'back', target: 'lower back', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Hyperextensions_Back_Extensions/0.jpg'  },
    { id: 'good_morning', name: 'Good Morning', bodyPart: 'back', target: 'lower back', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Good_Morning/0.jpg'  },
    { id: 'shrugs_barbell', name: 'Barbell Shrug', bodyPart: 'back', target: 'traps', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Shrug/0.jpg'  },
    { id: 'shrugs_dumbbell', name: 'Dumbbell Shrug', bodyPart: 'back', target: 'traps', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dumbbell_Shrug/0.jpg'  },
    { id: 'face_pull', name: 'Face Pull', bodyPart: 'back', target: 'rear delts', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Face_Pull/0.jpg'  },

    // --- LEGS (QUADS) ---
    { id: 'squat_barbell', name: 'Barbell Squat (High Bar)', bodyPart: 'legs', target: 'quads', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Squat/0.jpg'  },
    { id: 'squat_low_bar', name: 'Barbell Squat (Low Bar)', bodyPart: 'legs', target: 'quads', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Squat/0.jpg'  },
    { id: 'front_squat_barbell', name: 'Front Squat', bodyPart: 'legs', target: 'quads', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Front_Barbell_Squat/0.jpg'  },
    { id: 'goblet_squat', name: 'Goblet Squat', bodyPart: 'legs', target: 'quads', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Goblet_Squat/0.jpg'  },
    { id: 'hack_squat', name: 'Hack Squat', bodyPart: 'legs', target: 'quads', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Hack_Squat/0.jpg'  },
    { id: 'leg_press', name: 'Leg Press', bodyPart: 'legs', target: 'quads', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Leg_Press/0.jpg'  },
    { id: 'leg_extension', name: 'Leg Extension', bodyPart: 'legs', target: 'quads', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Leg_Extensions/0.jpg'  },
    { id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', bodyPart: 'legs', target: 'quads', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Single_Leg_Push-off/0.jpg'  },
    { id: 'lunge_dumbbell', name: 'Dumbbell Walking Lunge', bodyPart: 'legs', target: 'quads', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dumbbell_Lunges/0.jpg'  },
    { id: 'lunge_reverse', name: 'Reverse Lunge', bodyPart: 'legs', target: 'quads', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dumbbell_Rear_Lunge/0.jpg'  },
    { id: 'step_up', name: 'Dumbbell Step Up', bodyPart: 'legs', target: 'quads', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dumbbell_Step_Ups/0.jpg'  },
    { id: 'sissy_squat', name: 'Sissy Squat', bodyPart: 'legs', target: 'quads', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Weighted_Sissy_Squat/0.jpg'  },

    // --- LEGS (HAMSTRINGS/GLUTES) ---
    { id: 'romanian_deadlift_barbell', name: 'Romanian Deadlift (Barbell)', bodyPart: 'legs', target: 'hamstrings', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Romanian_Deadlift/0.jpg'  },
    { id: 'romanian_deadlift_dumbbell', name: 'Romanian Deadlift (Dumbbell)', bodyPart: 'legs', target: 'hamstrings', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Romanian_Deadlift/0.jpg'  },
    { id: 'stiff_leg_deadlift', name: 'Stiff Leg Deadlift', bodyPart: 'legs', target: 'hamstrings', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Stiff-Legged_Barbell_Deadlift/0.jpg'  },
    { id: 'leg_curl_lying', name: 'Lying Leg Curl', bodyPart: 'legs', target: 'hamstrings', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Lying_Leg_Curls/0.jpg'  },
    { id: 'leg_curl_seated', name: 'Seated Leg Curl', bodyPart: 'legs', target: 'hamstrings', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Seated_Leg_Curl/0.jpg'  },
    { id: 'hip_thrust_barbell', name: 'Barbell Hip Thrust', bodyPart: 'legs', target: 'glutes', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Hip_Thrust/0.jpg'  },
    { id: 'hip_thrust_machine', name: 'Machine Hip Thrust', bodyPart: 'legs', target: 'glutes', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Hip_Thrust/0.jpg'  },
    { id: 'glute_bridge', name: 'Glute Bridge', bodyPart: 'legs', target: 'glutes', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Glute_Bridge/0.jpg'  },
    { id: 'cable_pull_through', name: 'Cable Pull Through', bodyPart: 'legs', target: 'glutes', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Pull_Through/0.jpg'  },
    { id: 'glute_kickback_cable', name: 'Cable Glute Kickback', bodyPart: 'legs', target: 'glutes', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Glute_Kickback/0.jpg'  },
    { id: 'kettlebell_swing', name: 'Kettlebell Swing', bodyPart: 'legs', target: 'glutes', equipment: 'kettlebell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/One-Arm_Kettlebell_Swings/0.jpg'  },
    { id: 'nordic_curl', name: 'Nordic Curl', bodyPart: 'legs', target: 'hamstrings', equipment: 'body weight' },

    // --- LEGS (CALVES/OTHERS) ---
    { id: 'calf_raise_standing', name: 'Standing Calf Raise', bodyPart: 'legs', target: 'calves', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Standing_Calf_Raises/0.jpg'  },
    { id: 'calf_raise_seated', name: 'Seated Calf Raise', bodyPart: 'legs', target: 'calves', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Seated_Calf_Raise/0.jpg'  },
    { id: 'calf_raise_leg_press', name: 'Leg Press Calf Raise', bodyPart: 'legs', target: 'calves', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Calf_Press_On_The_Leg_Press_Machine/0.jpg'  },
    { id: 'hip_abduction_machine', name: 'Hip Abduction Machine', bodyPart: 'legs', target: 'glutes', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Thigh_Abductor/0.jpg'  },
    { id: 'hip_adduction_machine', name: 'Hip Adduction Machine', bodyPart: 'legs', target: 'adductors', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Thigh_Adductor/0.jpg'  },

    // --- SHOULDERS ---
    // Compound
    { id: 'overhead_press_barbell', name: 'Overhead Press (OHP)', bodyPart: 'shoulders', target: 'delts', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Standing_Military_Press/0.jpg'  },
    { id: 'push_press', name: 'Push Press', bodyPart: 'shoulders', target: 'delts', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Push_Press/0.jpg'  },
    { id: 'shoulder_press_dumbbell', name: 'Dumbbell Shoulder Press', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dumbbell_Shoulder_Press/0.jpg'  },
    { id: 'shoulder_press_machine', name: 'Machine Shoulder Press', bodyPart: 'shoulders', target: 'delts', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Machine_Shoulder_Military_Press/0.jpg'  },
    { id: 'arnold_press', name: 'Arnold Press', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Arnold_Dumbbell_Press/0.jpg'  },
    { id: 'landmine_press', name: 'Landmine Press', bodyPart: 'shoulders', target: 'delts', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Landmine_180s/0.jpg'  },
    // Isolation
    { id: 'lateral_raise_dumbbell', name: 'Dumbbell Lateral Raise', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Side_Lateral_Raise/0.jpg'  },
    { id: 'lateral_raise_cable', name: 'Cable Lateral Raise', bodyPart: 'shoulders', target: 'delts', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Cable_Seated_Lateral_Raise/0.jpg'  },
    { id: 'lateral_raise_machine', name: 'Machine Lateral Raise', bodyPart: 'shoulders', target: 'delts', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Cable_Seated_Lateral_Raise/0.jpg'  },
    { id: 'front_raise_dumbbell', name: 'Dumbbell Front Raise', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Front_Dumbbell_Raise/0.jpg'  },
    { id: 'front_raise_plate', name: 'Plate Front Raise', bodyPart: 'shoulders', target: 'delts', equipment: 'weight plate', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Front_Plate_Raise/0.jpg'  },
    { id: 'rear_delt_fly_dumbbell', name: 'Dumbbell Rear Delt Fly', bodyPart: 'shoulders', target: 'delts', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Seated_Bent-Over_Rear_Delt_Raise/0.jpg'  },
    { id: 'rear_delt_fly_machine', name: 'Machine Rear Delt Fly', bodyPart: 'shoulders', target: 'delts', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Reverse_Machine_Flyes/0.jpg'  },
    { id: 'face_pull_shoulders', name: 'Face Pull', bodyPart: 'shoulders', target: 'delts', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Face_Pull/0.jpg'  },
    { id: 'upright_row', name: 'Upright Row', bodyPart: 'shoulders', target: 'traps', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Upright_Barbell_Row/0.jpg'  },

    // --- ARMS (BICEPS) ---
    { id: 'bicep_curl_barbell', name: 'Barbell Curl', bodyPart: 'arms', target: 'biceps', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Curl/0.jpg'  },
    { id: 'bicep_curl_dumbbell', name: 'Dumbbell Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dumbbell_Bicep_Curl/0.jpg'  },
    { id: 'hammer_curl', name: 'Hammer Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Hammer_Curls/0.jpg'  },
    { id: 'preacher_curl_ez', name: 'EZ Bar Preacher Curl', bodyPart: 'arms', target: 'biceps', equipment: 'ez bar', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Preacher_Curl/0.jpg'  },
    { id: 'preacher_curl_machine', name: 'Machine Preacher Curl', bodyPart: 'arms', target: 'biceps', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Machine_Preacher_Curls/0.jpg'  },
    { id: 'concentration_curl', name: 'Concentration Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Concentration_Curls/0.jpg'  },
    { id: 'cable_curl', name: 'Cable Bicep Curl', bodyPart: 'arms', target: 'biceps', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Cable_Hammer_Curls_-_Rope_Attachment/0.jpg'  },
    { id: 'incline_dumbbell_curl', name: 'Incline Dumbbell Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Incline_Dumbbell_Curl/0.jpg'  },
    { id: 'spider_curl', name: 'Spider Curl', bodyPart: 'arms', target: 'biceps', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Spider_Curl/0.jpg'  },
    { id: 'reverse_curl', name: 'Reverse Curl', bodyPart: 'arms', target: 'forearms', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Barbell_Curl/0.jpg'  },

    // --- ARMS (TRICEPS) ---
    { id: 'tricep_pushdown_rope', name: 'Tricep Rope Pushdown', bodyPart: 'arms', target: 'triceps', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Triceps_Pushdown_-_Rope_Attachment/0.jpg'  },
    { id: 'tricep_pushdown_bar', name: 'Tricep Bar Pushdown', bodyPart: 'arms', target: 'triceps', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Triceps_Pushdown/0.jpg'  },
    { id: 'skullcrushers', name: 'Skullcrushers', bodyPart: 'arms', target: 'triceps', equipment: 'ez bar', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Lying_Triceps_Press/0.jpg'  },
    { id: 'overhead_tricep_extension_dumbbell', name: 'Overhead Dumbbell Extension', bodyPart: 'arms', target: 'triceps', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Standing_Dumbbell_Triceps_Extension/0.jpg'  },
    { id: 'overhead_tricep_extension_cable', name: 'Overhead Cable Extension', bodyPart: 'arms', target: 'triceps', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Cable_Lying_Triceps_Extension/0.jpg'  },
    { id: 'tricep_kickback', name: 'Tricep Kickback', bodyPart: 'arms', target: 'triceps', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Tricep_Dumbbell_Kickback/0.jpg'  },
    { id: 'dips_bench', name: 'Bench Dips', bodyPart: 'arms', target: 'triceps', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Bench_Dips/0.jpg'  },
    { id: 'dips_tricep', name: 'Tricep Dips (Bars)', bodyPart: 'arms', target: 'triceps', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Dips_-_Triceps_Version/0.jpg'  },
    { id: 'close_grip_bench_press', name: 'Close Grip Bench Press', bodyPart: 'arms', target: 'triceps', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Close-Grip_Barbell_Bench_Press/0.jpg' },

    // --- CORE ---
    { id: 'plank', name: 'Plank', bodyPart: 'core', target: 'abs', equipment: 'body weight' },
    { id: 'crunches', name: 'Crunches', bodyPart: 'core', target: 'abs', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Crunches/0.jpg'  },
    { id: 'sit_up', name: 'Sit Up', bodyPart: 'core', target: 'abs', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/3_4_Sit-Up/0.jpg'  },
    { id: 'leg_raises_hanging', name: 'Hanging Leg Raises', bodyPart: 'core', target: 'abs', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Hanging_Leg_Raise/0.jpg'  },
    { id: 'leg_raises_lying', name: 'Lying Leg Raises', bodyPart: 'core', target: 'abs', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Flat_Bench_Lying_Leg_Raise/0.jpg'  },
    { id: 'russian_twist', name: 'Russian Twist', bodyPart: 'core', target: 'abs', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Russian_Twist/0.jpg'  },
    { id: 'ab_wheel_rollout', name: 'Ab Wheel Rollout', bodyPart: 'core', target: 'abs', equipment: 'other', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Ab_Roller/0.jpg'  },
    { id: 'cable_crunch', name: 'Cable Crunch', bodyPart: 'core', target: 'abs', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Cable_Crunch/0.jpg'  },
    { id: 'woodchopper', name: 'Cable Woodchopper', bodyPart: 'core', target: 'obliques', equipment: 'cable', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Standing_Cable_Wood_Chop/0.jpg'  },
    { id: 'mountain_climbers', name: 'Mountain Climbers', bodyPart: 'core', target: 'abs', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Mountain_Climbers/0.jpg'  },
    { id: 'bicycle_crunches', name: 'Bicycle Crunches', bodyPart: 'core', target: 'abs', equipment: 'body weight', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Air_Bike/0.jpg'  },

    // --- CARDIO ---
    { id: 'running_treadmill', name: 'Treadmill Run', bodyPart: 'cardio', target: 'cardiovascular', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Running_Treadmill/0.jpg'  },
    { id: 'running_outdoor', name: 'Outdoor Run', bodyPart: 'cardio', target: 'cardiovascular', equipment: 'body weight' },
    { id: 'cycling_stationary', name: 'Stationary Bike', bodyPart: 'cardio', target: 'cardiovascular', equipment: 'machine' },
    { id: 'elliptical', name: 'Elliptical Machine', bodyPart: 'cardio', target: 'cardiovascular', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Elliptical_Trainer/0.jpg'  },
    { id: 'rowing_machine', name: 'Rowing Machine', bodyPart: 'cardio', target: 'full body', equipment: 'machine' },
    { id: 'stair_climber', name: 'Stair Climber', bodyPart: 'cardio', target: 'legs', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Stairmaster/0.jpg'  },
    { id: 'jump_rope', name: 'Jump Rope', bodyPart: 'cardio', target: 'calves', equipment: 'other', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Rope_Jumping/0.jpg'  },
    { id: 'walking_treadmill', name: 'Treadmill Walk', bodyPart: 'cardio', target: 'cardiovascular', equipment: 'machine', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Walking_Treadmill/0.jpg'  },

    // --- FUNCTIONAL / OLYMPIC ---
    { id: 'clean_and_jerk', name: 'Clean and Jerk', bodyPart: 'full body', target: 'full body', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Clean_and_Jerk/0.jpg'  },
    { id: 'snatch', name: 'Snatch', bodyPart: 'full body', target: 'full body', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Hang_Snatch/0.jpg'  },
    { id: 'power_clean', name: 'Power Clean', bodyPart: 'full body', target: 'full body', equipment: 'barbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Power_Clean/0.jpg'  },
    { id: 'deadlift_high_pull', name: 'Deadlift High Pull', bodyPart: 'full body', target: 'full body', equipment: 'barbell' },
    { id: 'box_jump', name: 'Box Jump', bodyPart: 'legs', target: 'legs', equipment: 'box', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Box_Jump_Multiple_Response/0.jpg'  },
    { id: 'burpee', name: 'Burpee', bodyPart: 'full body', target: 'full body', equipment: 'body weight' },
    { id: 'battle_ropes', name: 'Battle Ropes', bodyPart: 'full body', target: 'full body', equipment: 'rope' },
    { id: 'farmers_walk', name: 'Farmers Walk', bodyPart: 'full body', target: 'grip', equipment: 'dumbbell', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Farmers_Walk/0.jpg'  },
    { id: 'sled_push', name: 'Sled Push', bodyPart: 'legs', target: 'legs', equipment: 'sled', gifUrl: 'https://pieyjxokfjvsnfygblmv.supabase.co/storage/v1/object/public/exercise-images/Sled_Push/0.jpg'  },
    { id: 'sled_pull', name: 'Sled Pull', bodyPart: 'legs', target: 'legs', equipment: 'sled' },

    // --- NECK (Optional but complete) ---
    { id: 'neck_curl', name: 'Neck Curl', bodyPart: 'neck', target: 'neck', equipment: 'weight plate' },
    { id: 'neck_extension', name: 'Neck Extension', bodyPart: 'neck', target: 'neck', equipment: 'harness' },
];

export const bodyPartsList = [
    'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full body', 'neck'
];
