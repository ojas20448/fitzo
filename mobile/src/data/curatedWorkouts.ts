/**
 * Fitzo Curated Workout Library
 *
 * Pre-built workout templates organized by muscle group and difficulty.
 * These map to the workout types used throughout the app:
 * 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'cardio'
 */

export type WorkoutType = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'cardio' | 'push' | 'pull' | 'upper' | 'lower' | 'full_body';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface CuratedExercise {
    name: string;
    sets: number;
    reps: string;
    restSeconds: number;
}

export interface CuratedWorkout {
    id: string;
    name: string;
    type: WorkoutType;
    difficulty: Difficulty;
    estimatedMinutes: number;
    exercises: CuratedExercise[];
}

export const curatedWorkouts: CuratedWorkout[] = [
    // -------------------------------------------------------------------------
    // CHEST
    // -------------------------------------------------------------------------
    {
        id: 'chest_push_day_classic',
        name: 'Push Day Classic',
        type: 'chest',
        difficulty: 'intermediate',
        estimatedMinutes: 50,
        exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Cable Crossover', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Tricep Pushdown', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },
    {
        id: 'chest_triceps_blast',
        name: 'Chest & Triceps Blast',
        type: 'chest',
        difficulty: 'advanced',
        estimatedMinutes: 60,
        exercises: [
            { name: 'Incline Barbell Bench Press', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Dumbbell Bench Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Pec Deck / Machine Fly', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Dips (Chest Focus)', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Skull Crushers', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Overhead Tricep Extension', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },
    {
        id: 'chest_beginner_press',
        name: 'Chest Starter',
        type: 'chest',
        difficulty: 'beginner',
        estimatedMinutes: 30,
        exercises: [
            { name: 'Machine Chest Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Fly', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Push Up', sets: 3, reps: '8-12', restSeconds: 60 },
        ],
    },
    {
        id: 'chest_hypertrophy',
        name: 'Chest Hypertrophy',
        type: 'chest',
        difficulty: 'intermediate',
        estimatedMinutes: 55,
        exercises: [
            { name: 'Dumbbell Bench Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Incline Dumbbell Press', sets: 4, reps: '10-12', restSeconds: 90 },
            { name: 'Cable Crossover', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Pec Deck / Machine Fly', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Dips (Chest Focus)', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Push Up (Weighted)', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },
    {
        id: 'chest_upper_focus',
        name: 'Upper Chest Sculptor',
        type: 'chest',
        difficulty: 'advanced',
        estimatedMinutes: 65,
        exercises: [
            { name: 'Incline Barbell Bench Press', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Incline Dumbbell Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Low-to-High Cable Fly', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Landmine Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Bench Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Pullover', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Tricep Pushdown', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },
    {
        id: 'chest_beginner_complete',
        name: 'Chest Day Complete',
        type: 'chest',
        difficulty: 'beginner',
        estimatedMinutes: 40,
        exercises: [
            { name: 'Machine Chest Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Fly', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Push Up', sets: 3, reps: '10-15', restSeconds: 60 },
            { name: 'Tricep Pushdown', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },

    // -------------------------------------------------------------------------
    // BACK
    // -------------------------------------------------------------------------
    {
        id: 'back_pull_day_power',
        name: 'Pull Day Power',
        type: 'back',
        difficulty: 'intermediate',
        estimatedMinutes: 55,
        exercises: [
            { name: 'Barbell Deadlift', sets: 4, reps: '5-6', restSeconds: 180 },
            { name: 'Barbell Row', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'back_width_builder',
        name: 'Back Width Builder',
        type: 'back',
        difficulty: 'advanced',
        estimatedMinutes: 60,
        exercises: [
            { name: 'Weighted Pull Up', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Close Grip Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Seated Cable Row', sets: 4, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Straight Arm Pulldown', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },
    {
        id: 'back_beginner_pull',
        name: 'Back Basics',
        type: 'back',
        difficulty: 'beginner',
        estimatedMinutes: 35,
        exercises: [
            { name: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Seated Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'back_thickness_builder',
        name: 'Back Thickness Builder',
        type: 'back',
        difficulty: 'intermediate',
        estimatedMinutes: 55,
        exercises: [
            { name: 'Barbell Row', sets: 4, reps: '6-8', restSeconds: 120 },
            { name: 'T-Bar Row', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Seated Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
            { name: 'Barbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },
    {
        id: 'back_complete_destroyer',
        name: 'Complete Back Destroyer',
        type: 'back',
        difficulty: 'advanced',
        estimatedMinutes: 70,
        exercises: [
            { name: 'Barbell Deadlift', sets: 4, reps: '4-6', restSeconds: 180 },
            { name: 'Weighted Pull Up', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Barbell Row', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Dumbbell Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Seated Cable Row (Close Grip)', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Straight Arm Pulldown', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'back_beginner_complete',
        name: 'Back & Biceps Starter',
        type: 'back',
        difficulty: 'beginner',
        estimatedMinutes: 40,
        exercises: [
            { name: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Machine Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Seated Cable Row', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
            { name: 'Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },

    // -------------------------------------------------------------------------
    // LEGS
    // -------------------------------------------------------------------------
    {
        id: 'legs_foundation',
        name: 'Leg Day Foundation',
        type: 'legs',
        difficulty: 'intermediate',
        estimatedMinutes: 60,
        exercises: [
            { name: 'Barbell Squat', sets: 4, reps: '6-8', restSeconds: 180 },
            { name: 'Leg Press', sets: 4, reps: '10-12', restSeconds: 120 },
            { name: 'Romanian Deadlift', sets: 3, reps: '10-12', restSeconds: 120 },
            { name: 'Leg Curl', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Standing Calf Raise', sets: 4, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'legs_quad_focused',
        name: 'Quad Focused',
        type: 'legs',
        difficulty: 'advanced',
        estimatedMinutes: 55,
        exercises: [
            { name: 'Front Squat', sets: 4, reps: '6-8', restSeconds: 180 },
            { name: 'Hack Squat', sets: 3, reps: '10-12', restSeconds: 120 },
            { name: 'Leg Extension', sets: 4, reps: '12-15', restSeconds: 60 },
            { name: 'Walking Lunge', sets: 3, reps: '12 each', restSeconds: 90 },
            { name: 'Sissy Squat', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },
    {
        id: 'legs_beginner',
        name: 'Lower Body Starter',
        type: 'legs',
        difficulty: 'beginner',
        estimatedMinutes: 35,
        exercises: [
            { name: 'Goblet Squat', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Leg Press', sets: 3, reps: '12-15', restSeconds: 90 },
            { name: 'Leg Curl', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Standing Calf Raise', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'legs_hamstring_glute',
        name: 'Hamstring & Glute Focus',
        type: 'legs',
        difficulty: 'intermediate',
        estimatedMinutes: 55,
        exercises: [
            { name: 'Romanian Deadlift', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Hip Thrust', sets: 4, reps: '10-12', restSeconds: 120 },
            { name: 'Leg Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Bulgarian Split Squat', sets: 3, reps: '10-12 each', restSeconds: 90 },
            { name: 'Glute Kickback (Cable)', sets: 3, reps: '12-15 each', restSeconds: 60 },
            { name: 'Seated Calf Raise', sets: 4, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'legs_destroyer',
        name: 'Leg Day Destroyer',
        type: 'legs',
        difficulty: 'advanced',
        estimatedMinutes: 75,
        exercises: [
            { name: 'Barbell Squat', sets: 5, reps: '5-6', restSeconds: 180 },
            { name: 'Leg Press', sets: 4, reps: '10-12', restSeconds: 120 },
            { name: 'Romanian Deadlift', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Walking Lunge', sets: 3, reps: '12 each', restSeconds: 90 },
            { name: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Leg Curl', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Standing Calf Raise', sets: 4, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'legs_beginner_complete',
        name: 'Lower Body Essentials',
        type: 'legs',
        difficulty: 'beginner',
        estimatedMinutes: 40,
        exercises: [
            { name: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Goblet Squat', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Leg Curl', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Standing Calf Raise', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },

    // -------------------------------------------------------------------------
    // SHOULDERS
    // -------------------------------------------------------------------------
    {
        id: 'shoulders_boulder',
        name: 'Boulder Shoulders',
        type: 'shoulders',
        difficulty: 'intermediate',
        estimatedMinutes: 45,
        exercises: [
            { name: 'Overhead Press', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Dumbbell Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
            { name: 'Rear Delt Fly', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'shoulders_complete',
        name: 'Complete Shoulder Session',
        type: 'shoulders',
        difficulty: 'advanced',
        estimatedMinutes: 55,
        exercises: [
            { name: 'Seated Dumbbell Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Arnold Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Cable Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
            { name: 'Rear Delt Fly', sets: 3, reps: '15-20', restSeconds: 60 },
            { name: 'Barbell Shrug', sets: 3, reps: '12-15', restSeconds: 90 },
        ],
    },
    {
        id: 'shoulders_beginner',
        name: 'Shoulder Foundations',
        type: 'shoulders',
        difficulty: 'beginner',
        estimatedMinutes: 30,
        exercises: [
            { name: 'Seated Dumbbell Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'shoulders_hypertrophy',
        name: 'Shoulder Hypertrophy',
        type: 'shoulders',
        difficulty: 'intermediate',
        estimatedMinutes: 50,
        exercises: [
            { name: 'Dumbbell Shoulder Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Cable Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
            { name: 'Rear Delt Fly (Machine)', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Dumbbell Front Raise', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Barbell Upright Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'shoulders_3d_delts',
        name: '3D Delts',
        type: 'shoulders',
        difficulty: 'advanced',
        estimatedMinutes: 60,
        exercises: [
            { name: 'Overhead Press', sets: 4, reps: '5-7', restSeconds: 150 },
            { name: 'Arnold Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Dumbbell Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
            { name: 'Cable Lateral Raise', sets: 3, reps: '15-20', restSeconds: 45 },
            { name: 'Rear Delt Fly', sets: 4, reps: '12-15', restSeconds: 60 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
            { name: 'Barbell Shrug', sets: 4, reps: '10-12', restSeconds: 90 },
        ],
    },
    {
        id: 'shoulders_beginner_complete',
        name: 'Shoulder & Trap Builder',
        type: 'shoulders',
        difficulty: 'beginner',
        estimatedMinutes: 35,
        exercises: [
            { name: 'Machine Shoulder Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Rear Delt Fly (Machine)', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
            { name: 'Dumbbell Shrug', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },

    // -------------------------------------------------------------------------
    // ARMS
    // -------------------------------------------------------------------------
    {
        id: 'arms_pump',
        name: 'Arm Day Pump',
        type: 'arms',
        difficulty: 'intermediate',
        estimatedMinutes: 45,
        exercises: [
            { name: 'Barbell Curl', sets: 3, reps: '8-10', restSeconds: 90 },
            { name: 'Skull Crushers', sets: 3, reps: '8-10', restSeconds: 90 },
            { name: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Cable Pushdown', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Incline Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },
    {
        id: 'arms_superset_blast',
        name: 'Arms Superset Blast',
        type: 'arms',
        difficulty: 'advanced',
        estimatedMinutes: 50,
        exercises: [
            { name: 'Barbell Curl', sets: 4, reps: '8-10', restSeconds: 60 },
            { name: 'Close Grip Bench Press', sets: 4, reps: '8-10', restSeconds: 60 },
            { name: 'Preacher Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Overhead Tricep Extension', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Concentration Curl', sets: 3, reps: '12-15', restSeconds: 45 },
            { name: 'Tricep Kickback', sets: 3, reps: '12-15', restSeconds: 45 },
        ],
    },
    {
        id: 'arms_beginner',
        name: 'Arm Builder Basics',
        type: 'arms',
        difficulty: 'beginner',
        estimatedMinutes: 25,
        exercises: [
            { name: 'Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Tricep Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },
    {
        id: 'arms_hypertrophy',
        name: 'Arm Hypertrophy',
        type: 'arms',
        difficulty: 'intermediate',
        estimatedMinutes: 50,
        exercises: [
            { name: 'Barbell Curl', sets: 4, reps: '8-10', restSeconds: 90 },
            { name: 'Close Grip Bench Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Incline Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Overhead Tricep Extension', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Tricep Kickback', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },
    {
        id: 'arms_gun_show',
        name: 'Gun Show',
        type: 'arms',
        difficulty: 'advanced',
        estimatedMinutes: 60,
        exercises: [
            { name: 'Barbell Curl (Heavy)', sets: 4, reps: '6-8', restSeconds: 120 },
            { name: 'Close Grip Bench Press', sets: 4, reps: '6-8', restSeconds: 120 },
            { name: 'Preacher Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Skull Crushers', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Cable Curl', sets: 3, reps: '12-15', restSeconds: 45 },
            { name: 'Cable Pushdown', sets: 3, reps: '12-15', restSeconds: 45 },
            { name: 'Reverse Curl', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },
    {
        id: 'arms_beginner_complete',
        name: 'Arms & Forearms Starter',
        type: 'arms',
        difficulty: 'beginner',
        estimatedMinutes: 35,
        exercises: [
            { name: 'Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Tricep Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Overhead Tricep Extension (Cable)', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Wrist Curl', sets: 3, reps: '15-20', restSeconds: 45 },
        ],
    },

    // -------------------------------------------------------------------------
    // CARDIO
    // -------------------------------------------------------------------------
    {
        id: 'cardio_hiit_circuit',
        name: 'HIIT Circuit',
        type: 'cardio',
        difficulty: 'intermediate',
        estimatedMinutes: 25,
        exercises: [
            { name: 'Burpees', sets: 4, reps: '45 sec', restSeconds: 15 },
            { name: 'Mountain Climbers', sets: 4, reps: '45 sec', restSeconds: 15 },
            { name: 'Jump Squats', sets: 4, reps: '45 sec', restSeconds: 15 },
            { name: 'High Knees', sets: 4, reps: '45 sec', restSeconds: 15 },
        ],
    },
    {
        id: 'cardio_full_body_burn',
        name: 'Full Body Burn',
        type: 'cardio',
        difficulty: 'advanced',
        estimatedMinutes: 35,
        exercises: [
            { name: 'Burpees', sets: 5, reps: '60 sec', restSeconds: 15 },
            { name: 'Box Jumps', sets: 4, reps: '12-15', restSeconds: 30 },
            { name: 'Battle Ropes', sets: 4, reps: '30 sec', restSeconds: 15 },
            { name: 'Kettlebell Swings', sets: 4, reps: '15-20', restSeconds: 30 },
            { name: 'Mountain Climbers', sets: 4, reps: '45 sec', restSeconds: 15 },
        ],
    },
    {
        id: 'cardio_beginner_circuit',
        name: 'Easy Cardio Circuit',
        type: 'cardio',
        difficulty: 'beginner',
        estimatedMinutes: 20,
        exercises: [
            { name: 'Jumping Jacks', sets: 3, reps: '30 sec', restSeconds: 30 },
            { name: 'High Knees', sets: 3, reps: '30 sec', restSeconds: 30 },
            { name: 'Mountain Climbers', sets: 3, reps: '30 sec', restSeconds: 30 },
            { name: 'Bodyweight Squats', sets: 3, reps: '15-20', restSeconds: 30 },
        ],
    },
    {
        id: 'cardio_tabata_blast',
        name: 'Tabata Blast',
        type: 'cardio',
        difficulty: 'intermediate',
        estimatedMinutes: 30,
        exercises: [
            { name: 'Burpees', sets: 4, reps: '20 sec on / 10 sec off', restSeconds: 10 },
            { name: 'Jump Squats', sets: 4, reps: '20 sec on / 10 sec off', restSeconds: 10 },
            { name: 'Push Up (Explosive)', sets: 4, reps: '20 sec on / 10 sec off', restSeconds: 10 },
            { name: 'Mountain Climbers', sets: 4, reps: '20 sec on / 10 sec off', restSeconds: 10 },
            { name: 'Kettlebell Swings', sets: 4, reps: '20 sec on / 10 sec off', restSeconds: 10 },
            { name: 'Plank Jacks', sets: 4, reps: '20 sec on / 10 sec off', restSeconds: 10 },
        ],
    },
    {
        id: 'cardio_athletic_conditioning',
        name: 'Athletic Conditioning',
        type: 'cardio',
        difficulty: 'advanced',
        estimatedMinutes: 40,
        exercises: [
            { name: 'Rowing Machine', sets: 4, reps: '500m', restSeconds: 60 },
            { name: 'Box Jumps', sets: 4, reps: '12-15', restSeconds: 45 },
            { name: 'Battle Ropes', sets: 4, reps: '30 sec', restSeconds: 30 },
            { name: 'Sled Push', sets: 4, reps: '20m', restSeconds: 60 },
            { name: 'Burpees', sets: 4, reps: '12-15', restSeconds: 30 },
            { name: 'Assault Bike', sets: 4, reps: '30 sec sprint', restSeconds: 30 },
        ],
    },
    {
        id: 'cardio_beginner_low_impact',
        name: 'Low Impact Cardio',
        type: 'cardio',
        difficulty: 'beginner',
        estimatedMinutes: 25,
        exercises: [
            { name: 'Walking Lunges', sets: 3, reps: '10 each', restSeconds: 45 },
            { name: 'Step Ups', sets: 3, reps: '12 each', restSeconds: 45 },
            { name: 'Stationary Bike', sets: 3, reps: '3 min', restSeconds: 60 },
            { name: 'Bodyweight Squats', sets: 3, reps: '15-20', restSeconds: 30 },
            { name: 'Jumping Jacks', sets: 3, reps: '30 sec', restSeconds: 30 },
        ],
    },

    // -------------------------------------------------------------------------
    // PUSH (Chest + Shoulders + Triceps)
    // -------------------------------------------------------------------------
    {
        id: 'push_beginner',
        name: 'Push Day Essentials',
        type: 'push',
        difficulty: 'beginner',
        estimatedMinutes: 40,
        exercises: [
            { name: 'Machine Chest Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Machine Shoulder Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Dumbbell Fly', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Tricep Pushdown', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },
    {
        id: 'push_powerhouse',
        name: 'Push Day Powerhouse',
        type: 'push',
        difficulty: 'intermediate',
        estimatedMinutes: 55,
        exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Overhead Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Incline Dumbbell Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
            { name: 'Cable Crossover', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Skull Crushers', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },
    {
        id: 'push_volume',
        name: 'Push Day Volume',
        type: 'push',
        difficulty: 'advanced',
        estimatedMinutes: 70,
        exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '5-6', restSeconds: 180 },
            { name: 'Overhead Press', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Incline Dumbbell Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Arnold Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Cable Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
            { name: 'Dips (Chest Focus)', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Overhead Tricep Extension', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Tricep Pushdown', sets: 3, reps: '12-15', restSeconds: 60 },
        ],
    },

    // -------------------------------------------------------------------------
    // PULL (Back + Biceps + Rear Delts)
    // -------------------------------------------------------------------------
    {
        id: 'pull_beginner',
        name: 'Pull Day Essentials',
        type: 'pull',
        difficulty: 'beginner',
        estimatedMinutes: 40,
        exercises: [
            { name: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Seated Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
            { name: 'Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },
    {
        id: 'pull_strength',
        name: 'Pull Day Strength',
        type: 'pull',
        difficulty: 'intermediate',
        estimatedMinutes: 55,
        exercises: [
            { name: 'Barbell Row', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Lat Pulldown', sets: 4, reps: '8-10', restSeconds: 90 },
            { name: 'Dumbbell Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
            { name: 'Barbell Curl', sets: 3, reps: '8-10', restSeconds: 90 },
            { name: 'Incline Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },
    {
        id: 'pull_complete',
        name: 'Pull Day Complete',
        type: 'pull',
        difficulty: 'advanced',
        estimatedMinutes: 65,
        exercises: [
            { name: 'Barbell Deadlift', sets: 4, reps: '4-6', restSeconds: 180 },
            { name: 'Weighted Pull Up', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Barbell Row', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Seated Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Rear Delt Fly', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Barbell Curl', sets: 3, reps: '8-10', restSeconds: 90 },
            { name: 'Hammer Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },

    // -------------------------------------------------------------------------
    // UPPER BODY
    // -------------------------------------------------------------------------
    {
        id: 'upper_beginner',
        name: 'Upper Body Starter',
        type: 'upper',
        difficulty: 'beginner',
        estimatedMinutes: 45,
        exercises: [
            { name: 'Machine Chest Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Machine Shoulder Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Seated Cable Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Tricep Pushdown', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },
    {
        id: 'upper_builder',
        name: 'Upper Body Builder',
        type: 'upper',
        difficulty: 'intermediate',
        estimatedMinutes: 60,
        exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Barbell Row', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Overhead Press', sets: 3, reps: '8-10', restSeconds: 120 },
            { name: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Barbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Skull Crushers', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },
    {
        id: 'upper_assault',
        name: 'Upper Body Assault',
        type: 'upper',
        difficulty: 'advanced',
        estimatedMinutes: 75,
        exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '5-7', restSeconds: 150 },
            { name: 'Weighted Pull Up', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Overhead Press', sets: 4, reps: '6-8', restSeconds: 120 },
            { name: 'Incline Dumbbell Press', sets: 3, reps: '8-10', restSeconds: 90 },
            { name: 'Dumbbell Row', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Cable Lateral Raise', sets: 4, reps: '12-15', restSeconds: 60 },
            { name: 'Close Grip Bench Press', sets: 3, reps: '8-10', restSeconds: 90 },
            { name: 'Barbell Curl', sets: 3, reps: '8-10', restSeconds: 60 },
        ],
    },

    // -------------------------------------------------------------------------
    // LOWER BODY
    // -------------------------------------------------------------------------
    {
        id: 'lower_beginner',
        name: 'Lower Body Starter',
        type: 'lower',
        difficulty: 'beginner',
        estimatedMinutes: 40,
        exercises: [
            { name: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Goblet Squat', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Leg Curl', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Standing Calf Raise', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'lower_power',
        name: 'Lower Body Power',
        type: 'lower',
        difficulty: 'intermediate',
        estimatedMinutes: 60,
        exercises: [
            { name: 'Barbell Squat', sets: 4, reps: '6-8', restSeconds: 180 },
            { name: 'Romanian Deadlift', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 120 },
            { name: 'Bulgarian Split Squat', sets: 3, reps: '10-12 each', restSeconds: 90 },
            { name: 'Leg Curl', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Hip Thrust', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Standing Calf Raise', sets: 4, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'lower_max',
        name: 'Lower Body Max',
        type: 'lower',
        difficulty: 'advanced',
        estimatedMinutes: 75,
        exercises: [
            { name: 'Barbell Squat', sets: 5, reps: '4-6', restSeconds: 180 },
            { name: 'Romanian Deadlift', sets: 4, reps: '6-8', restSeconds: 150 },
            { name: 'Front Squat', sets: 3, reps: '8-10', restSeconds: 150 },
            { name: 'Hip Thrust', sets: 4, reps: '8-10', restSeconds: 120 },
            { name: 'Hack Squat', sets: 3, reps: '10-12', restSeconds: 120 },
            { name: 'Leg Curl', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Leg Extension', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Standing Calf Raise', sets: 4, reps: '15-20', restSeconds: 60 },
        ],
    },

    // -------------------------------------------------------------------------
    // FULL BODY
    // -------------------------------------------------------------------------
    {
        id: 'full_body_beginner',
        name: 'Full Body Starter',
        type: 'full_body',
        difficulty: 'beginner',
        estimatedMinutes: 45,
        exercises: [
            { name: 'Machine Chest Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Lat Pulldown', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Leg Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Machine Shoulder Press', sets: 3, reps: '10-12', restSeconds: 90 },
            { name: 'Dumbbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
            { name: 'Bodyweight Squats', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },
    {
        id: 'full_body_balanced',
        name: 'Full Body Balanced',
        type: 'full_body',
        difficulty: 'intermediate',
        estimatedMinutes: 60,
        exercises: [
            { name: 'Barbell Bench Press', sets: 3, reps: '8-10', restSeconds: 120 },
            { name: 'Barbell Row', sets: 3, reps: '8-10', restSeconds: 120 },
            { name: 'Barbell Squat', sets: 4, reps: '8-10', restSeconds: 150 },
            { name: 'Overhead Press', sets: 3, reps: '8-10', restSeconds: 120 },
            { name: 'Romanian Deadlift', sets: 3, reps: '10-12', restSeconds: 120 },
            { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Barbell Curl', sets: 3, reps: '10-12', restSeconds: 60 },
        ],
    },
    {
        id: 'full_body_gauntlet',
        name: 'Full Body Gauntlet',
        type: 'full_body',
        difficulty: 'advanced',
        estimatedMinutes: 80,
        exercises: [
            { name: 'Barbell Squat', sets: 4, reps: '5-7', restSeconds: 180 },
            { name: 'Barbell Bench Press', sets: 4, reps: '5-7', restSeconds: 150 },
            { name: 'Barbell Deadlift', sets: 4, reps: '4-6', restSeconds: 180 },
            { name: 'Overhead Press', sets: 3, reps: '8-10', restSeconds: 120 },
            { name: 'Weighted Pull Up', sets: 3, reps: '6-8', restSeconds: 120 },
            { name: 'Walking Lunge', sets: 3, reps: '10 each', restSeconds: 90 },
            { name: 'Dumbbell Lateral Raise', sets: 3, reps: '12-15', restSeconds: 60 },
            { name: 'Face Pull', sets: 3, reps: '15-20', restSeconds: 60 },
        ],
    },
];

export default curatedWorkouts;
