# Fitzo - Screen Inventory

## Member Screens (Primary User)

### 1. Home Screen (`MemberHome`)
**Purpose:** Dashboard showing current gym status at a glance.

**Elements:**
- User avatar + greeting
- QR Check-In button (primary CTA)
- Today's intent card (if set)
- Crowd indicator (green/orange/red)
- Streak counter with fire animation
- Quick stats (XP, badges)

**Data needed:** `/member/home` API

---

### 2. QR Check-In Screen (`QRCheckin`)
**Purpose:** Scan gym QR code to check in.

**Flow:**
1. Camera opens with QR overlay
2. Scan QR → decode gym_id
3. POST to `/checkin`
4. Success animation with streak update
5. Auto-return to Home

**Elements:**
- Camera view
- QR frame overlay
- Cancel button
- Success confetti animation

---

### 3. Workout Intent Selector (`WorkoutIntent`)
**Purpose:** Set what you're training today.

**Elements:**
- Grid of muscle group cards (Legs, Chest, Back, Shoulders, Arms, Cardio, Rest)
- Selected state with checkmark
- Optional note input
- Visibility toggle (Public/Friends/Private)
- Start Workout button

**Data needed:** POST `/intent`

---

### 4. Gym Buddies Screen (`GymBuddies`)
**Purpose:** View friends and their workout activities.

**Elements:**
- Header with search button
- Your Intent card
- Friends activity feed
  - Avatar, name, muscle group badge
  - Time ago, optional note
  - Like/wave reaction button
- Pending requests indicator

**Data needed:** `/friends`, `/intent/feed`

---

### 5. Learn Screen (`Learn`)
**Purpose:** Duolingo-style fitness education.

**Elements:**
- Progress bar at top
- XP and streak display
- Unit cards with progress
- Lesson nodes on path
  - Completed (checkmark)
  - Current (pulsing, start button)
  - Locked (grayed out)
- Bonus XP nodes

**Data needed:** `/learn/lessons`

---

### 6. Lesson Screen (`LessonQuiz`)
**Purpose:** Take an MCQ lesson.

**Flow:**
1. Show question
2. Four option buttons
3. Select → show correct/incorrect
4. Next question
5. Final score with XP earned

**Elements:**
- Question text
- Option cards
- Progress indicator
- XP animation on correct

---

### 7. Classes Screen (`ClassBooking`)
**Purpose:** View and book group classes.

**Elements:**
- Date filter pills (Today, Tomorrow, etc.)
- Time-grouped session list
  - Morning / Evening sections
  - Class name, trainer, time
  - Slots available badge
  - Book/Join button

**Data needed:** `/classes`

---

### 8. Profile Screen (`MemberProfile`)
**Purpose:** View stats, badges, and settings.

**Elements:**
- Avatar and name
- Membership tier badge
- Streak card with fire
- Badges grid (earned + locked)
- Learning path progress
- Settings toggles
  - Public profile
  - Show badges

---

## Trainer Screens

### 9. Trainer Home (`TrainerHome`)
**Purpose:** Quick view of assigned members.

**Elements:**
- Member list cards
  - Avatar, name
  - Check-in status icon (today)
  - Today's intent badge
  - Streak indicator
- Filter: All / Checked In / Not Checked In

**Data needed:** `/trainer/members`

---

### 10. Member Detail (`TrainerMemberDetail`)
**Purpose:** Deep view of a specific member.

**Elements:**
- Member header (avatar, name, joined date)
- Today's intent (even if private)
- Attendance calendar (simple icon grid)
- Workout plan summary
- Calorie plan summary

**Data needed:** `/trainer/members/:id`

---

## Manager Screens

### 11. Manager Dashboard (`ManagerDashboard`)
**Purpose:** Quick gym status overview.

**Elements:**
- Today's check-ins count (big number)
- Crowd indicator
- Active trainers count
- Upcoming classes list
- Quick add buttons (member/trainer)

**Data needed:** `/manager/dashboard`

---

### 12. People Management (`ManagePeople`)
**Purpose:** Add trainers and members.

**Flow:**
1. Tap "Add Member" or "Add Trainer"
2. Enter email, name
3. Assign trainer (for members)
4. Send invite

**Elements:**
- Tab: Members / Trainers
- People list
- Add button
- Simple form modal

---

## Navigation Structure

```
┌─────────────────────────────────────────┐
│              Tab Navigator              │
├─────────┬─────────┬─────────┬───────────┤
│  Home   │ Buddies │ (Scan)  │   Learn   │
├─────────┼─────────┼─────────┼───────────┤
│  📍     │  👥     │  📷     │   📚     │
└─────────┴─────────┴─────────┴───────────┘
                      ↓
             QR Scanner Modal
```

**Member Navigation:**
- Home (default)
- Buddies (social)
- QR Scan (center button, modal)
- Learn (education)
- Profile (accessed from Home header)
- Classes (accessed from Home)

**Trainer Navigation:**
- Home (member list)
- Schedule
- Profile

**Manager Navigation:**
- Dashboard
- People
- Classes
- Profile

---

## Screen Complexity Rating

| Screen | Complexity | Priority |
|--------|------------|----------|
| MemberHome | Medium | P0 |
| QRCheckin | Low | P0 |
| WorkoutIntent | Low | P0 |
| GymBuddies | Medium | P1 |
| Learn | Medium | P1 |
| LessonQuiz | Medium | P2 |
| ClassBooking | Medium | P1 |
| MemberProfile | Medium | P2 |
| TrainerHome | Low | P1 |
| TrainerMemberDetail | Medium | P2 |
| ManagerDashboard | Low | P1 |
| ManagePeople | Low | P2 |
