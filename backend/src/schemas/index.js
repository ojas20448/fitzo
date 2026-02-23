/**
 * Zod Validation Schemas
 *
 * Central schema definitions for all API endpoints.
 */

const { z } = require('zod');

// ===========================================
// AUTH SCHEMAS
// ===========================================
const registerSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    gym_code: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
});

const googleAuthSchema = z.object({
    idToken: z.string().optional(),
    accessToken: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    photo: z.string().url().optional().nullable(),
}).refine(data => data.idToken || data.accessToken, {
    message: 'Either idToken or accessToken is required',
});

const forgotPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
});

const resetPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    code: z.string().length(6, 'Reset code must be 6 digits'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

// ===========================================
// WORKOUT SCHEMAS
// ===========================================
const workoutTypes = ['legs', 'chest', 'back', 'shoulders', 'arms', 'cardio', 'rest'];
const visibilityOptions = ['public', 'friends', 'private'];

const logWorkoutSchema = z.object({
    workout_type: z.enum(workoutTypes, { message: 'Please select a valid workout type' }),
    exercises: z.any().optional(),
    notes: z.string().max(500, 'Notes too long').optional().nullable(),
    visibility: z.enum(visibilityOptions).default('friends'),
});

const startSessionSchema = z.object({
    split_id: z.string().uuid().optional().nullable(),
    day_name: z.string().max(50).optional().nullable(),
    visibility: z.enum(visibilityOptions).default('friends'),
});

const logSetSchema = z.object({
    reps: z.number().int().min(0).max(999),
    weight_kg: z.number().min(0).max(9999),
    is_warmup: z.boolean().optional().default(false),
    is_failure: z.boolean().optional().default(false),
    rpe: z.number().min(1).max(10).optional().nullable(),
});

// ===========================================
// NUTRITION / FOOD SCHEMAS
// ===========================================
const logCaloriesSchema = z.object({
    meal_name: z.string().min(1, 'Meal name is required').max(200),
    calories: z.number().min(0, 'Calories must be positive').max(99999),
    protein: z.number().min(0).max(9999).optional().default(0),
    carbs: z.number().min(0).max(9999).optional().default(0),
    fat: z.number().min(0).max(9999).optional().default(0),
    visibility: z.enum(visibilityOptions).default('friends'),
});

const analyzeFoodTextSchema = z.object({
    text: z.string().min(1, 'Please provide a food description').max(1000),
});

const analyzeFoodPhotoSchema = z.object({
    image: z.string().min(1, 'Image data is required'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']).default('image/jpeg'),
});

// ===========================================
// INTENT SCHEMAS
// ===========================================
const intentPatterns = ['push', 'pull', 'legs', 'upper', 'lower', 'full_body', 'cardio', 'rest', 'custom'];

const setIntentSchema = z.object({
    split_type: z.string().optional(),
    muscle_group: z.enum(workoutTypes).optional(),
    emphasis: z.array(z.string()).optional().default([]),
    session_label: z.string().max(50).optional().nullable(),
    visibility: z.enum(visibilityOptions).default('friends'),
    note: z.string().max(300).optional().nullable(),
});

// ===========================================
// SOCIAL SCHEMAS
// ===========================================
const createPostSchema = z.object({
    content: z.string().min(1, 'Post content is required').max(2000),
    visibility: z.enum(visibilityOptions).default('friends'),
});

const createCommentSchema = z.object({
    content: z.string().min(1, 'Comment is required').max(500),
});

// ===========================================
// PROFILE SCHEMAS
// ===========================================
const updateProfileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    avatar_url: z.string().url().optional().nullable(),
});

const fitnessProfileSchema = z.object({
    goal_type: z.enum(['fat_loss', 'muscle_gain', 'maintenance', 'strength', 'endurance']).optional(),
    current_weight: z.number().min(20).max(500).optional(),
    target_weight: z.number().min(20).max(500).optional(),
    height: z.number().min(50).max(300).optional(),
    age: z.number().int().min(13).max(120).optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    activity_level: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
    target_calories: z.number().min(500).max(10000).optional(),
});

const bodyMeasurementsSchema = z.object({
    weight_kg: z.number().min(20).max(500).optional(),
    body_fat_pct: z.number().min(1).max(60).optional(),
    chest_cm: z.number().min(30).max(200).optional(),
    waist_cm: z.number().min(30).max(200).optional(),
    hips_cm: z.number().min(30).max(200).optional(),
    bicep_cm: z.number().min(10).max(80).optional(),
    thigh_cm: z.number().min(20).max(100).optional(),
});

// ===========================================
// NOTIFICATION SCHEMAS
// ===========================================
const registerPushTokenSchema = z.object({
    token: z.string().min(1, 'Push token is required'),
    platform: z.enum(['ios', 'android', 'web']).optional(),
    device_name: z.string().max(100).optional(),
});

// ===========================================
// AI SCHEMAS
// ===========================================
const aiChatSchema = z.object({
    question: z.string().min(1, 'Question is required').max(2000),
    context: z.record(z.any()).optional().default({}),
});

const aiWorkoutPlanSchema = z.object({
    goal: z.string().default('general fitness'),
    fitnessLevel: z.string().default('beginner'),
    daysPerWeek: z.number().int().min(1).max(7).default(3),
    equipment: z.string().default('bodyweight'),
});

const aiFormAnalysisSchema = z.object({
    exerciseName: z.string().min(1, 'Exercise name is required'),
    description: z.string().min(1, 'Form description is required').max(2000),
});

module.exports = {
    // Auth
    registerSchema,
    loginSchema,
    googleAuthSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    // Workouts
    logWorkoutSchema,
    startSessionSchema,
    logSetSchema,
    // Nutrition
    logCaloriesSchema,
    analyzeFoodTextSchema,
    analyzeFoodPhotoSchema,
    // Intent
    setIntentSchema,
    // Social
    createPostSchema,
    createCommentSchema,
    // Profile
    updateProfileSchema,
    fitnessProfileSchema,
    bodyMeasurementsSchema,
    // Notifications
    registerPushTokenSchema,
    // AI
    aiChatSchema,
    aiWorkoutPlanSchema,
    aiFormAnalysisSchema,
};
