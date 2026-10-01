// Headlines deliberately stay complete within one screenshot.
export const panels = [
  { file: '01-workouts', source: '04-logger', fresh: true, theme: 'paper', eyebrow: 'WORKOUT TRACKER', title: ['Make every', 'rep count.'], support: 'Sets, reps and your last session. Right here.', angle: -4, tag: 'LESS GUESSWORK. MORE TRAINING.' },
  { file: '02-nutrition', source: '05-nutrition', theme: 'paper', eyebrow: 'VOICE + PHOTO FOOD LOGGING', title: ['Your food.', 'Your way.'], support: 'Speak it. Snap it. Track your macros.', angle: 4, tag: 'INDIAN FOOD. HINGLISH INCLUDED.' },
  { file: '03-muscle-map', source: '02-stats', theme: 'paper', eyebrow: 'VISUAL MUSCLE VOLUME', title: ['See what', 'you trained.'], support: 'Your weekly work, muscle by muscle.', angle: -3, tag: 'SEE THE PATTERN. PLAN THE NEXT SESSION.', crop: 'map' },
  { file: '04-spotter', source: '03-coach', fresh: true, theme: 'paper', eyebrow: 'SPOTTER · AI COACH', title: ['A coach with', 'your context.'], support: 'Ask about your training, food and recovery.', angle: 3, tag: 'YOUR LOGS START THE CONVERSATION.', sample: true, crop: 'coach' },
  { file: '05-progress', source: '06-profile', theme: 'paper', eyebrow: 'PERSONAL PROGRESS', title: ['Small steps.', 'Real progress.'], support: 'Keep your streak and body metrics in view.', angle: -3, tag: 'BUILD A ROUTINE YOU CAN SEE.' },
  { file: '06-today', source: '01-home', theme: 'paper', eyebrow: 'YOUR DAILY OVERVIEW', title: ['Your day.', 'All together.'], support: 'Next workout. Daily macros. Weekly progress.', angle: 3, tag: 'OPEN FITZO. FIND YOUR FOCUS.' },
  { file: '07-learn', source: '07-learn', theme: 'paper', eyebrow: 'BITE-SIZED FITNESS LESSONS', title: ['Train with', 'understanding.'], support: 'Learn the why behind your workouts.', angle: -3, tag: 'TRAINING. NUTRITION. RECOVERY.' },
  { file: '08-buddies', source: '08-buddies', fresh: true, theme: 'paper', eyebrow: 'GYM BUDDIES', title: ['Better', 'with buddies.'], support: 'See shared activity. Keep showing up.', angle: 3, tag: 'YOUR ROUTINE. YOUR PEOPLE.' },
];
export const targets = [
  { key: 'app-store-6.9', width: 1320, height: 2868 },
  { key: 'app-store-6.5', width: 1284, height: 2778 },
  { key: 'google-play', width: 1080, height: 2160 },
];
export const metadata = {
  name: 'Fitzo: Gym & Nutrition Tracker',
  subtitle: 'Log lifts, meals & progress',
  promotionalText: 'Make every rep count. Log workouts, track Indian meals by voice or photo, and see your progress with a visual muscle map and an AI coach that uses your logs.',
  keywords: 'workout,calorie,protein,macro,indian,food,hinglish,strength,weightlifting,diary,fitness,coach',
};
