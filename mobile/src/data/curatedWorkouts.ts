/**
 * Fitzo Curated Workout Library
 *
 * Pre-built workout templates organized by muscle group and difficulty.
 * These map to the workout types used throughout the app:
 * 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'cardio'
 */

export type WorkoutType = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'cardio';
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
];

export default curatedWorkouts;
