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
- Expo CLI (`npm install -g expo-cli`)

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

# Run schema
psql fitzo < src/db/schema.sql

# Seed data (optional)
psql fitzo < src/db/seed.sql

# Start server
npm run dev
```

Server runs at `http://localhost:3001`

### Mobile Setup

```bash
cd mobile

# Install dependencies
npm install

# Update API URL in src/services/api.ts
# Replace 192.168.1.100 with your local IP

# Start Expo
npx expo start
```

Scan QR with Expo Go app on your phone.

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

### Manager Features
- ✅ Dashboard (check-ins, crowd)
- ✅ Add trainers/members
- ✅ Upcoming classes

## 🗄️ Database

11 lean tables:
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

## 🔐 Authentication

- JWT tokens (7-day expiry)
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
