# Fitzo - Domain Model

## Core Entities

Every table must justify its existence. This is the minimal domain model.

### User
The central entity representing all app users.

```sql
users (
  id              UUID PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(100) NOT NULL,
  role            ENUM('member', 'trainer', 'manager') NOT NULL,
  avatar_url      VARCHAR(500),
  gym_id          UUID REFERENCES gyms(id),
  trainer_id      UUID REFERENCES users(id), -- For members: assigned trainer
  xp_points       INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
)
```

**Why it exists**: Core identity for authentication and role-based access.

---

### Gym
Represents a physical gym location.

```sql
gyms (
  id              UUID PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  qr_code         VARCHAR(100) UNIQUE NOT NULL, -- Static QR identifier
  created_at      TIMESTAMP DEFAULT NOW()
)
```

**Why it exists**: QR check-in requires gym identification. Each gym has a unique static QR code.

---

### Friendship
Mutual friendship between gym members.

```sql
friendships (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES users(id),
  friend_id       UUID REFERENCES users(id),
  status          ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
)
```

**Why it exists**: Powers the "Gym Buddies" feature for social workout visibility.

---

### WorkoutPlan
Trainer-created workout plan for a member.

```sql
workout_plans (
  id              UUID PRIMARY KEY,
  member_id       UUID REFERENCES users(id),
  trainer_id      UUID REFERENCES users(id),
  plan_data       JSONB NOT NULL, -- Flexible structure for exercises
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
)
```

**Why it exists**: Trainers need to assign workout plans to members.

---

### CaloriePlan
Trainer-created calorie/nutrition plan.

```sql
calorie_plans (
  id              UUID PRIMARY KEY,
  member_id       UUID REFERENCES users(id),
  trainer_id      UUID REFERENCES users(id),
  plan_data       JSONB NOT NULL, -- Calories, macros, meal suggestions
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
)
```

**Why it exists**: Trainers need to assign nutrition guidelines to members.

---

### WorkoutIntent
Today's workout intention - auto-expires at end of day.

```sql
workout_intents (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES users(id),
  muscle_group    ENUM('legs', 'chest', 'back', 'shoulders', 'arms', 'cardio', 'rest') NOT NULL,
  visibility      ENUM('public', 'friends', 'private') DEFAULT 'friends',
  note            VARCHAR(200), -- Optional short note
  expires_at      TIMESTAMP NOT NULL, -- End of day
  created_at      TIMESTAMP DEFAULT NOW()
)
```

**Why it exists**: Core social feature - members share what they're training today.

**Visibility rules:**
- `public` - Visible to all gym members
- `friends` - Visible only to gym buddies
- `private` - Visible only to self + assigned trainer

---

### Attendance
QR check-in records.

```sql
attendances (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES users(id),
  gym_id          UUID REFERENCES gyms(id),
  checked_in_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, DATE(checked_in_at)) -- One check-in per day per user
)
```

**Why it exists**: Core MVP feature - QR check-in tracking.

**Indexes needed:**
- `(user_id, checked_in_at)` - For streak calculation
- `(gym_id, checked_in_at)` - For crowd indicator

---

### ClassSession
Scheduled fitness classes.

```sql
class_sessions (
  id              UUID PRIMARY KEY,
  gym_id          UUID REFERENCES gyms(id),
  trainer_id      UUID REFERENCES users(id),
  name            VARCHAR(100) NOT NULL,
  scheduled_at    TIMESTAMP NOT NULL,
  duration_mins   INTEGER DEFAULT 60,
  max_capacity    INTEGER DEFAULT 20,
  created_at      TIMESTAMP DEFAULT NOW()
)
```

**Why it exists**: Basic class scheduling for group sessions.

---

### ClassBooking
Member bookings for class sessions.

```sql
class_bookings (
  id              UUID PRIMARY KEY,
  session_id      UUID REFERENCES class_sessions(id),
  user_id         UUID REFERENCES users(id),
  booked_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, user_id)
)
```

**Why it exists**: Track who's booked for which class.

---

### LearnLesson
MCQ-based fitness education lessons.

```sql
learn_lessons (
  id              UUID PRIMARY KEY,
  title           VARCHAR(100) NOT NULL,
  unit            INTEGER NOT NULL, -- Unit number for ordering
  order_index     INTEGER NOT NULL, -- Order within unit
  questions       JSONB NOT NULL, -- Array of MCQ questions
  xp_reward       INTEGER DEFAULT 10,
  created_at      TIMESTAMP DEFAULT NOW()
)
```

**Why it exists**: Duolingo-style learning module for fitness education.

**Question structure:**
```json
[
  {
    "question": "What muscle does the squat primarily target?",
    "options": ["Biceps", "Quadriceps", "Shoulders", "Back"],
    "correct": 1
  }
]
```

---

### LearnAttempt
User attempts at lessons.

```sql
learn_attempts (
  id              UUID PRIMARY KEY,
  user_id         UUID REFERENCES users(id),
  lesson_id       UUID REFERENCES learn_lessons(id),
  score           INTEGER NOT NULL, -- Percentage score
  completed       BOOLEAN DEFAULT FALSE,
  attempted_at    TIMESTAMP DEFAULT NOW()
)
```

**Why it exists**: Track learning progress and award XP.

---

## Entity Relationships

```
User (1) ──────────── (N) Attendance
User (1) ──────────── (N) WorkoutIntent
User (1) ──────────── (N) Friendship
User (1) ──────────── (1) WorkoutPlan
User (1) ──────────── (1) CaloriePlan
User (1) ──────────── (N) ClassBooking
User (1) ──────────── (N) LearnAttempt

Gym (1) ──────────── (N) User
Gym (1) ──────────── (N) ClassSession

Trainer (1) ──────── (N) Member (via trainer_id)
Trainer (1) ──────── (N) ClassSession

ClassSession (1) ─── (N) ClassBooking
LearnLesson (1) ──── (N) LearnAttempt
```

## Performance Indexes

```sql
-- Attendance queries
CREATE INDEX idx_attendance_user_date ON attendances(user_id, DATE(checked_in_at));
CREATE INDEX idx_attendance_gym_recent ON attendances(gym_id, checked_in_at DESC);

-- Workout intent queries
CREATE INDEX idx_intent_user_expires ON workout_intents(user_id, expires_at);
CREATE INDEX idx_intent_visibility_expires ON workout_intents(visibility, expires_at);

-- Friendship queries
CREATE INDEX idx_friendship_user ON friendships(user_id, status);
CREATE INDEX idx_friendship_friend ON friendships(friend_id, status);

-- Class booking queries
CREATE INDEX idx_booking_session ON class_bookings(session_id);
CREATE INDEX idx_booking_user ON class_bookings(user_id);
```
