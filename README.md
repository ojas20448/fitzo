# Fitzo - Gym SaaS Mobile Application

A mobile-first gym companion app built with React Native (Expo) and Node.js, designed for medium-sized gyms that hate software.

## 🏗️ Project Structure

```
Fitzo/
├── backend/               # Node.js + Express API
│   ├── src/
│   │   ├── config/       # Database config
│   │   ├── db/           # Schema & seed files
│   │   ├── middleware/   # Auth & role guards
│   │   ├── routes/       # API endpoints
│   │   └── utils/        # Error handling
│   └── package.json
├── mobile/               # React Native Expo app
│   ├── app/              # Expo Router pages
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # Auth context
│   │   ├── screens/      # Screen components
│   │   ├── services/     # API client
│   │   └── styles/       # Theme & design system
│   └── package.json
└── docs/                 # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Expo tooling through `npx expo` and a native development build

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your database credentials

# Create database
createdb fitzo

# Preview the migration plan, then initialize this NEW EMPTY database
node apply_migrations.js --bootstrap --dry-run
node apply_migrations.js --bootstrap

# Seed data (optional)
psql fitzo < src/db/seed.sql

# Start server
npm run dev
```

Server runs at `http://localhost:3001`

Set `DATABASE_URL` to the intended database before migrating. For an existing
database, see [migration and connection instructions](docs/MIGRATIONS.md).
Do not run `src/db/schema.sql` directly on an existing database: it drops tables.

### Mobile Setup

```bash
cd mobile

# Install dependencies
npm install

# Set EXPO_PUBLIC_API_URL in your local environment to your backend's /api URL

# Start Expo
npx expo start --dev-client
```

Install a native development build, then scan the QR code. HealthKit, Health
Connect and other native integrations require a custom build; Expo Go and web
export do not verify these integrations. Native permission changes require a rebuild.

## 📱 Features

### Member Features
- ✅ QR Check-in (one per day)
- ✅ Today's workout intent
- ✅ Gym buddies (friend system)
- ✅ Crowd indicator
- ✅ Streak tracking
- ✅ Duolingo-style learning
- ✅ Class booking

### Trainer Features
- ✅ View assigned members
- ✅ Member workout/calorie plans
- ✅ See private intents
- ✅ Schedule view

### Manager Features (not live)
Manager routes and screens exist, but release and the outstanding manager
authorization fixes are deferred.

## 🗄️ Database

The original core tables include:
- `users` - Members, trainers, managers
- `gyms` - Physical gym locations
- `attendances` - QR check-in records
- `friendships` - Gym buddies
- `workout_intents` - Today's focus
- `workout_plans` - Trainer-assigned plans
- `calorie_plans` - Nutrition plans
- `class_sessions` - Group classes
- `class_bookings` - Session bookings
- `learn_lessons` - MCQ lessons
- `learn_attempts` - User attempts

Feature migrations also add workout sessions/exercises/sets, calorie logs,
fitness profiles, health summaries, recipes, published splits, push registrations
and AI history. The [project audit](docs/PROJECT_AUDIT_2026-09-10.md) maps these flows;
the migration plan is the schema inventory.

## 🔐 Authentication

- JWT tokens (90-day default, configurable through JWT_EXPIRES_IN)
- Password reset increments the account token version to revoke existing sessions
- 3 roles: `member`, `trainer`, `manager`
- Secure token storage (expo-secure-store)

## 🎨 Design System

**Theme: Onyx & Snow**
- Pure black backgrounds (#000000)
- White accents (#FFFFFF)
- Glassmorphism effects
- Lexend font family

## 📝 Test Accounts

After seeding:

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@fitzo.app | test123 |
| Trainer | trainer1@fitzo.app | test123 |
| Member | rahul@example.com | test123 |

## 🧪 API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Member
- `GET /api/member/home`
- `POST /api/checkin`
- `POST /api/intent`
- `GET /api/intent/feed`
- `GET /api/friends`
- `GET /api/classes`
- `GET /api/learn/lessons`

### Trainer
- `GET /api/trainer/members`
- `GET /api/trainer/members/:id`

### Manager
- `GET /api/manager/dashboard`
- `POST /api/manager/users`

## 📋 License

MIT
