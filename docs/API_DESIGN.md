# Fitzo - API Design

## Base URL
```
/api/v1
```

## Authentication
All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

---

## Auth Endpoints

### POST /auth/register
Register a new user.

**Request:**
```json
{
  "email": "rahul@example.com",
  "password": "securepassword",
  "name": "Rahul Kumar",
  "gym_code": "IRONPARADISE01"
}
```

**Response:**
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": "uuid",
    "name": "Rahul Kumar",
    "role": "member",
    "gym_id": "uuid"
  }
}
```

### POST /auth/login
Login existing user.

### POST /auth/logout
Invalidate token.

---

## Member Endpoints

### GET /member/home ⭐ Core API
Get all data for member home screen.

**Response:**
```json
{
  "user": {
    "name": "Rahul Kumar",
    "avatar_url": "...",
    "xp_points": 450
  },
  "checkin": {
    "status": "checked_in",
    "checked_in_at": "2024-01-15T06:30:00Z"
  },
  "intent": {
    "muscle_group": "legs",
    "visibility": "friends",
    "note": "Leg day! 🦵"
  },
  "crowd": {
    "level": "low", // low | medium | high
    "count": 12
  },
  "streak": {
    "current": 12,
    "best": 15
  }
}
```

**Crowd Logic:**
- `low` (green): < 20 check-ins in last 60 mins
- `medium` (orange): 20-40 check-ins
- `high` (red): > 40 check-ins

---

## Check-in Endpoints

### POST /checkin
Create attendance record via QR scan.

**Request:**
```json
{
  "gym_id": "uuid"  // Decoded from QR
}
```

**Response:**
```json
{
  "success": true,
  "message": "You're checked in! 💪",
  "streak": 12,
  "animation": "success"  // Trigger frontend animation
}
```

**Errors:**
- 400: Already checked in today
- 404: Invalid gym

### GET /checkin/status
Get today's check-in status.

---

## Workout Intent Endpoints

### POST /intent
Set today's workout intent.

**Request:**
```json
{
  "muscle_group": "legs",
  "visibility": "friends",
  "note": "Squat PR attempt! 🔥"
}
```

**Response:**
```json
{
  "id": "uuid",
  "expires_at": "2024-01-15T23:59:59Z"
}
```

### GET /intent
Get current user's today's intent.

### GET /intent/feed
Get friends' workout intents for today.

**Response:**
```json
{
  "intents": [
    {
      "user": {
        "id": "uuid",
        "name": "Priya Singh",
        "avatar_url": "..."
      },
      "muscle_group": "cardio",
      "note": "5k treadmill run",
      "time_ago": "20 mins ago",
      "is_active": true
    }
  ]
}
```

---

## Gym Buddies Endpoints

### POST /friends/request
Send friend request.

**Request:**
```json
{
  "friend_id": "uuid"
}
```

### POST /friends/accept
Accept friend request.

### POST /friends/reject
Reject friend request.

### GET /friends
List all friends.

**Response:**
```json
{
  "friends": [
    {
      "id": "uuid",
      "name": "Rahul Sharma",
      "avatar_url": "...",
      "last_active": "2024-01-15T06:30:00Z",
      "today_intent": {
        "muscle_group": "legs"
      }
    }
  ],
  "pending_requests": [
    {
      "id": "uuid",
      "name": "Amit Patel",
      "avatar_url": "..."
    }
  ]
}
```

---

## Learn Endpoints

### GET /learn/lessons
Get all lessons grouped by unit.

**Response:**
```json
{
  "units": [
    {
      "number": 1,
      "title": "Getting Started",
      "description": "Fundamental movements & gym safety",
      "lessons": [
        {
          "id": "uuid",
          "title": "Gym Etiquette",
          "completed": true,
          "xp_reward": 10
        },
        {
          "id": "uuid",
          "title": "Equipment Tour",
          "completed": true,
          "xp_reward": 15
        },
        {
          "id": "uuid",
          "title": "Proper Form: Squat",
          "completed": false,
          "xp_reward": 20,
          "is_next": true
        }
      ]
    }
  ],
  "progress": {
    "total_xp": 450,
    "lessons_completed": 5,
    "current_streak": 3
  }
}
```

### GET /learn/lessons/:id
Get lesson with questions.

### POST /learn/attempt
Submit lesson attempt.

**Request:**
```json
{
  "lesson_id": "uuid",
  "answers": [1, 0, 2, 1]  // Selected option indices
}
```

**Response:**
```json
{
  "score": 75,
  "xp_earned": 15,
  "correct_answers": [1, 2, 2, 1],
  "passed": true
}
```

---

## Classes Endpoints

### GET /classes
Get upcoming class sessions.

**Query params:** `?date=2024-01-15`

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "name": "Power Yoga",
      "trainer": {
        "name": "Rahul K.",
        "avatar_url": "..."
      },
      "scheduled_at": "2024-01-15T06:00:00Z",
      "duration_mins": 60,
      "slots_available": 4,
      "max_capacity": 20,
      "is_booked": false
    }
  ]
}
```

### POST /classes/:id/book
Book a class session.

### DELETE /classes/:id/book
Cancel booking.

---

## Trainer Endpoints

### GET /trainer/members
Get assigned members list.

**Response:**
```json
{
  "members": [
    {
      "id": "uuid",
      "name": "Rahul Kumar",
      "avatar_url": "...",
      "checked_in_today": true,
      "today_intent": {
        "muscle_group": "legs"
      },
      "streak": 12
    }
  ]
}
```

### GET /trainer/members/:id
Get member detail with plans.

**Response:**
```json
{
  "member": {
    "id": "uuid",
    "name": "Rahul Kumar",
    "avatar_url": "...",
    "joined_at": "2023-01-15"
  },
  "workout_plan": { ... },
  "calorie_plan": { ... },
  "attendance_history": [
    { "date": "2024-01-15", "checked_in": true },
    { "date": "2024-01-14", "checked_in": true },
    { "date": "2024-01-13", "checked_in": false }
  ],
  "today_intent": {
    "muscle_group": "legs",
    "note": "Squat PR attempt!"
  }
}
```

---

## Manager Endpoints

### GET /manager/dashboard
Get manager dashboard data.

**Response:**
```json
{
  "today": {
    "total_checkins": 45,
    "active_now": 12
  },
  "crowd": {
    "level": "medium",
    "percentage": 60
  },
  "upcoming_classes": [
    {
      "name": "Power Yoga",
      "trainer": "Rahul K.",
      "starts_in": "30 mins",
      "bookings": 16
    }
  ],
  "trainers": {
    "active": 3,
    "total": 5
  }
}
```

### POST /manager/users
Add new trainer or member.

**Request:**
```json
{
  "email": "newmember@example.com",
  "name": "New Member",
  "role": "member",
  "trainer_id": "uuid"  // Optional, for members
}
```

---

## Error Response Format

All errors follow this format:

```json
{
  "error": true,
  "message": "Please log in again",  // User-friendly message
  "code": "AUTH_EXPIRED"  // Machine-readable code
}
```

**Error message guidelines:**
- ❌ "401 Unauthorized"
- ✅ "Please log in again"

- ❌ "Invalid gym_id parameter"
- ✅ "This QR code doesn't seem to be valid"

- ❌ "UNIQUE constraint violation"
- ✅ "You've already checked in today!"
