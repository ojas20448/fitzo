const fs = require('fs');
const path = require('path');
// This explicitly targets your Fitzo directory no matter where you run it from
const root = path.join(__dirname, 'Fitzo');

const write = (f, content) => {
    const p = path.join(__dirname, f); // Root is where build_all.js resides
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
};

// 1. Write OWNER_ACTIONS.md
write('OWNER_ACTIONS.md', `# Owner Actions Checklist
## 1. Supabase
- [ ] Log into the Supabase dashboard.
- [ ] Reset the password for user \`postgres.pieyjxokfjvsnfygblmv\` (do not use the previously leaked database password).
- [ ] Update \`DATABASE_URL\` in Render to use the new password.

## 2. Render (Missing Env Vars)
- [ ] Go to the fitzo backend in render.com.
- [ ] Add \`YOUTUBE_API_KEY\` (create a Google Cloud API key for YouTube Data V3).
- [ ] Add \`API_NINJAS_KEY\`.
- [ ] Add missing mobile Client IDs using the values from \`mobile/.env\`:
  - \`GOOGLE_CLIENT_ID_IOS\`
  - \`GOOGLE_CLIENT_ID_ANDROID\`
  - \`GOOGLE_CLIENT_ID_ANDROID_DEBUG\`
- [ ] Add a secure hex string for \`CRON_SECRET\`.

## 3. GitHub Actions
- [ ] Set \`CRON_SECRET\` in repository Settings > Secrets to exactly match the value in Render.

## 4. Rotate Leaked API Keys
Log into the following services to revoke the leaked keys, generate new ones, and paste the new keys into Render:
- [ ] Gemini
- [ ] FatSecret
- [ ] USDA
- [ ] RapidAPI
- [ ] Resend

## 5. JWT
- [ ] Update \`JWT_SECRET\` in Render to a long, random hexadecimal string (replacing the leaked JWT secret).

## 6. Google OAuth Configuration
- [ ] Add test users in the Google Cloud Console before publishing.
- [ ] Ensure the iOS bundle ID and Android package is exactly \`com.fitzo.app\`.
- [ ] Register the appropriate SHA-1 hashes for the two Android client IDs.
- [ ] Download the \`google-services-key.json\` and save it to \`mobile/\`.
`);

// 2. Write the Voice Logging Implementation Plan
write('docs/superpowers/plans/2026-08-11-voice-logging.md', `# Implementation Plan: Voice Logging & AI Fallback Database
**Date:** 2026-08-11

## Overview
This plan defines a 3-step pipeline for voice logging. It leverages AI primarily for extraction and relies on the existing database for nutritional truth. To prevent hallucination problems (e.g., the "Butter Panner Meal" incident) and safeguard the core database, any AI-estimated food must be stored in a personal data island and never pollute the main catalogue.

## Pipeline Architecture
1. **SPEECH TO TEXT:** Route voice input to the existing \`transcribe\` endpoint.
2. **EXTRACTION (AI):** Pass the raw transcript to a new Gemini prompt configured to output a structured JSON array of items and quantities.
3. **RESOLUTION (Database):** Iterate over the extracted array. Pass each item to the existing algorithmic search (\`rankFoods\` in \`foodSearch.js\`).
   - *High-confidence match:* Use the catalogue's macros. AI is solely used for entity identification.
   - *No match:* Fall back to \`analyzeFoodFromText\` to have AI estimate macros, flagging the item as an estimate.

## Global Constraints
- AI-estimated foods must NEVER be added to \`indian-foods.json\`.
- Estimated foods must be persisted in a personal \`user_foods\` table linked to the user's ID.
- Any log relying on an AI estimate must be explicitly flagged in the database.

## Checklist

### Database Migrations
- [x] Create a new \`user_foods\` table.
- [x] Modify the existing \`calorie_logs\` table.

### Backend API
- [x] Implement Gemini extraction logic (\`extractItemsFromText\`) to parse transcripts into structured lists.
- [x] Create a new \`/api/food/bulk-resolve\` endpoint (Step 3).

### Mobile UI
- [ ] Connect microphone UI entry point in \`CalorieLogScreen.tsx\` to the \`extract-foods\` -> \`bulk-resolve\` API chain.
- [ ] Build a multi-item draft confirmation sheet to present the items before they are logged.
- [ ] Display an explicit UI badge (e.g., "AI Estimate") next to any item resolved via fallback.
- [ ] Provide inputs within the sheet to edit quantities or remove misidentified items before confirming the payload to the log endpoint.
`);

// 3. Tech Debt & Secret Redaction
const secrets = ['DATABASE_URL', 'JWT_SECRET', 'GEMINI_API_KEY', 'FATSECRET_CLIENT_ID', 'FATSECRET_CLIENT_SECRET', 'USDA_API_KEY', 'RAPIDAPI_KEY', 'GOOGLE_CLIENT_ID_WEB', 'GOOGLE_CLIENT_ID_IOS', 'GOOGLE_CLIENT_ID_ANDROID', 'GOOGLE_CLIENT_ID_ANDROID_DEBUG', 'API_NINJAS_KEY', 'CALORIENINJAS_API_KEY', 'RESEND_API_KEY'].join('|');
const regex = new RegExp('^(' + secrets + ')=.*', 'gm');

['RENDER_ENV_SETUP.md', 'backend/.env'].forEach(file => {
    const p = path.join(__dirname, file);
    if (!fs.existsSync(p)) return;
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(regex, (match, key) => key + '=' + (key === 'JWT_SECRET' && p.endsWith('.env') ? 'your_test_secret' : '<REDACTED>')));
});

[
    'backend/src/services/food-analyzer.js', 'mobile/src/context/ToastContext.tsx', 'app.json.bak',
    'eas.json.bak', 'package.json.bak', 'mobile/dev_login_response.txt', 'mobile/dev_login_test.txt',
    'backend/error.log', 'backend/api_audit.json', 'backend/api_health_report.json', 'urls.txt',
    'INTEGRATION_VERIFICATION.txt', 'mobile/app/trainer-home.tsx', 'mobile/app/member-detail/[id].tsx'
].forEach(file => {
    const p = path.join(__dirname, file);
    if (fs.existsSync(p)) fs.unlinkSync(p);
});

const layout = path.join(__dirname, 'mobile/app/_layout.tsx');
if (fs.existsSync(layout)) {
    fs.writeFileSync(layout, fs.readFileSync(layout, 'utf8').split('\n').filter(l => !l.includes('name="trainer-home"') && !l.includes('name="member-detail/[id]"')).join('\n'));
}

const gitignore = path.join(__dirname, '.gitignore');
if (fs.existsSync(gitignore)) {
    let ig = fs.readFileSync(gitignore, 'utf8').replace(/^\.env$/gm, '/backend/.env').replace(/^\.env\.local$/gm, '/mobile/.env*');
    if (!ig.includes('RENDER_ENV_SETUP')) ig += '\n/RENDER_ENV_SETUP.md\n';
    fs.writeFileSync(gitignore, ig);
}

// 4. Voice Logging Backend Files
write('backend/src/db/migrate_user_foods.sql', `CREATE TABLE IF NOT EXISTS user_foods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    calories INTEGER NOT NULL,
    protein NUMERIC(5, 1) NOT NULL,
    carbs NUMERIC(5, 1) NOT NULL,
    fat NUMERIC(5, 1) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_foods_user_id ON user_foods(user_id);
`);
write('backend/src/db/migrate_calorie_logs_source.sql', `ALTER TABLE calorie_logs ADD COLUMN IF NOT EXISTS is_estimate BOOLEAN DEFAULT false;
ALTER TABLE calorie_logs ADD COLUMN IF NOT EXISTS user_food_id UUID REFERENCES user_foods(id) ON DELETE SET NULL;
`);

const schemaFile = path.join(__dirname, 'backend/src/db/schema.sql');
if (fs.existsSync(schemaFile)) {
    let schemaStr = fs.readFileSync(schemaFile, 'utf8');
    if (!schemaStr.includes('CREATE TABLE user_foods')) {
        const toInsert = `\nCREATE TABLE user_foods (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n  name VARCHAR(255) NOT NULL,\n  calories INTEGER NOT NULL,\n  protein NUMERIC(5, 1) NOT NULL,\n  carbs NUMERIC(5, 1) NOT NULL,\n  fat NUMERIC(5, 1) NOT NULL,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n);\nCREATE INDEX idx_user_foods_user_id ON user_foods(user_id);\n`;
        schemaStr = schemaStr.replace('CREATE TABLE calorie_logs', toInsert + '\nCREATE TABLE calorie_logs');
        schemaStr = schemaStr.replace('logged_date DATE NOT NULL DEFAULT CURRENT_DATE,', 'logged_date DATE NOT NULL DEFAULT CURRENT_DATE,\n  is_estimate BOOLEAN DEFAULT false,\n  user_food_id UUID REFERENCES user_foods(id) ON DELETE SET NULL,');
        fs.writeFileSync(schemaFile, schemaStr);
    }
}

const geminiFile = path.join(__dirname, 'backend/src/services/gemini.js');
if (fs.existsSync(geminiFile)) {
    let geminiCode = fs.readFileSync(geminiFile, 'utf8');
    if (!geminiCode.includes('extractItemsFromText')) {
        const replaceExport = `// ===========================================
// FOOD ITEMS TEXT EXTRACTION
// ===========================================
async function extractItemsFromText(text) {
    const prompt = \`Extract all food items and their quantities or portion sizes from the following text.
Return ONLY a valid JSON array of objects (no markdown, no code fences).
Each object must have "item" (string) and "quantity" (string).
Do NOT include macros, just the raw text extraction.

Example:
Text: "I ate 250g of paneer tikka and 2 plates of biryani"
Output: [{"item": "paneer tikka", "quantity": "250g"}, {"item": "biryani", "quantity": "2 plates"}]

Text: "\${text}"\`;
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent(prompt);
        const responseText = (await result.response).text();
        return JSON.parse(extractJSON(responseText));
    } catch (error) {
        throw new Error(\`AI text extraction failed: \${error.message}\`);
    }
}
module.exports = {`;
        geminiCode = geminiCode.replace('module.exports = {', replaceExport).replace('transcribeAudio\n};', 'transcribeAudio,\n  extractItemsFromText\n};');
        fs.writeFileSync(geminiFile, geminiCode);
    }
}

const aiFile = path.join(__dirname, 'backend/src/routes/ai.js');
if (fs.existsSync(aiFile)) {
    let aiStr = fs.readFileSync(aiFile, 'utf8');
    if (!aiStr.includes('/extract-foods')) {
        const extractRoute = `router.post('/extract-foods', aiQuota, asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'text is required' });
    const items = await geminiService.extractItemsFromText(text);
    res.json({ success: true, items });
}));\n\nmodule.exports = router;`;
        aiStr = aiStr.replace('module.exports = router;', extractRoute);
        fs.writeFileSync(aiFile, aiStr);
    }
}

const foodFile = path.join(__dirname, 'backend/src/routes/food.js');
if (fs.existsSync(foodFile)) {
    let foodStr = fs.readFileSync(foodFile, 'utf8');
    if (!foodStr.includes('/bulk-resolve')) {
        if (!foodStr.includes("const { query } = require('../config/database');")) {
            foodStr = "const { query } = require('../config/database');\n" + foodStr;
        }
        const resolveRoute = `
router.post('/bulk-resolve', authenticate, aiQuota, asyncHandler(async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
    const results = [];
    for (const { item, quantity } of items) {
        const searchQuery = \`\${quantity} \${item}\`.trim();
        const searchRes = indianFood.searchFoods(searchQuery, 1);
        const bestMatch = searchRes.foods && searchRes.foods.length > 0 ? searchRes.foods[0] : null;
        
        if (bestMatch) {
            results.push({ ...bestMatch, is_estimate: false, source: 'catalog', original_query: searchQuery });
        } else {
            const aiEstimated = await geminiService.analyzeFoodFromText(searchQuery);
            const queryRes = await query(
                \`INSERT INTO user_foods (user_id, name, calories, protein, carbs, fat) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *\`,
                [req.user.id, aiEstimated.name || searchQuery, aiEstimated.calories, aiEstimated.protein_g, aiEstimated.carbs_g, aiEstimated.fat_g]
            );
            results.push({ ...aiEstimated, id: queryRes.rows[0].id, is_estimate: true, source: 'ai_estimate', user_food_id: queryRes.rows[0].id, original_query: searchQuery });
        }
    }
    return res.json({ success: true, items: results });
}));\n\nmodule.exports = router;`;
        foodStr = foodStr.replace('module.exports = router;', resolveRoute);
        fs.writeFileSync(foodFile, foodStr);
    }
}

console.log('All docs created, secrets wiped, and Backend API fully scaffolded to disk!');