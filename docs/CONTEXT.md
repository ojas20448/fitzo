# Fitzo - Project Context & System Overview

## What is Fitzo?

Fitzo is a **mobile-first Gym SaaS application** designed for medium-sized gyms and training studios. It focuses on **member engagement**, **simplicity**, and **social interaction** rather than complex gym management.

---

## Core Philosophy

| Principle | Execution |
|-----------|-----------|
| **Simple over Powerful** | Essential daily features only. No bloat. |
| **Social over Transactional** | Gym buddies, workout intents, squads. |
| **Mobile-only** | Touch-first design. No desktop dashboard needed. |
| **Gamified Education** | "Duolingo for Fitness" integrated. |

---

## Application Structure & Features

### 1. Home & Dashboard (`HomeScreen`)
The central hub for the member's daily gym life.
- **Top Header**: QR Check-in (for gym access) + Daily Streak Counter (🔥) + XP.
- **Set Your Focus**: "Workout Intent" system to declare today's goal (e.g., "Hitting Chest"). Shared with friends.
- **Quick Actions**:
    - **Log Workout**: Track sets/reps or active session.
    - **Log Calories**: Quick add food/meals.
- **Gym Buddies Feed**: See which friends are working out today.
- **Today's Nutrition**: Live macro breakdown (Protein, Carbs, Fats) via `MacroPieChart`.
- **Weekly Progress**: Visualization of workout consistency.

### 2. Workout Experience
- **Workout Logging** (`WorkoutLogScreen`):
    - Track sets, reps, weight, RPE.
    - **Active Workout Mode** (`ActiveWorkoutScreen`): Live timer, rest timer, set tracking.
    - **Workout Recap** (`WorkoutRecapScreen`): Summary stats post-workout.
- **Discovery**:
    - **Proven Splits** (`PublishedSplitsScreen`): PPL, Bro Split, Upper/Lower, Full Body.
    - **Exercise Library** (`ExerciseLibraryScreen`): Searchable database with instructions.
    - **Video Guides** (`WorkoutVideosScreen`): YouTube integration for form checks.
- **AI Coach** (`AICoachScreen`):
    - Gemini-powered chat assistant for advice on form, routine, and diet.

### 3. Nutrition & Health
- **Food Tracking**:
    - **Search**: Powered by FatSecret/USDA APIs.
    - **Barcode Scanner** (`FoodScannerScreen`): Quick logging.
    - **Recipe Builder** (`RecipeBuilderScreen`): Create custom meals/recipes.
- **Analysis**:
    - **Calorie Logs** (`CalorieLogScreen`): Daily history.
    - **Measurements** (`MeasurementsScreen`): Track body weight, body fat %, tape measurements.

### 4. Social Ecosystem
- **Gym Buddies** (`GymBuddiesScreen`):
    - Add friends via QR code or search.
    - View friend's status (Checked In / Resting).
    - **Squad Feed** (`SquadFeedScreen`): Activity timeline of friends.
- **Intents**: See what friends are training today (e.g., "Rahul is hitting Legs").

### 5. Learn Module ("Duolingo for Fitness")
- **Curriculum** (`LearnScreen`): 8 Units covering:
    1. Nutrition Fundamentals
    2. Training Essentials
    3. Muscle Building
    4. Fat Loss Science
    5. Supplements 101
    6. Sleep & Recovery
    7. Mindset & Consistency
    8. Advanced Topics
- **Interactive Lessons** (`LessonScreen`):
    - Rich Markdown content.
    - Gamified Quizzes (MCQ) with XP rewards.
    - Progress tracking (Timeline UI).

### 6. Gym Tools
- **Class Booking** (`ClassBookingScreen`): Reserve spots in group classes.
- **QR Access** (`QRCheckinScreen`): Digital membership card.

---

## Tech Stack

### Mobile App (React Native)
- **Framework**: Expo (Managed)
- **Language**: TypeScript
- **UI/Styling**: Custom Design System (Glassmorphism), Vanilla `StyleSheet`.
- **Navigation**: Expo Router (File-based routing).
- **Animations**: Reanimated 3.
- **Data Viz**: Victory Native (Charts).

### Backend (Node.js)
- **Server**: Express.js
- **Database**: PostgreSQL (Supabase).
- **AI**: Google Gemini Pro (via `src/services/gemini.js`).
- **External APIs**:
    - FatSecret (Nutrition)
    - USDA FoodData (Nutrition fallback)
    - RapidAPI/ExerciseDB (Exercises)
    - YouTube Data API (Videos)

---

## Design System
- **Theme**: Dark Mode default ("Onyx" background).
- **Visual Style**: High-contrast, "Glass" elements (translucent cards), vivid accent colors (Green/Orange for actions).
- **Typography**: Lexend (Modern, clean sans-serif).

---

## Current Status
- **Core Loop**: Functional (Check-in -> Train -> Track -> Learn).
- **Data**: Migrated to comprehensive content for Learn module.
- **UI**: Polished "Premium" aesthetic implemented on Home and Core screens.
