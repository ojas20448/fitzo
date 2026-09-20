/**
 * Preview by default: node scripts/repair_nutrition_targets.js
 * Explicit write mode: node scripts/repair_nutrition_targets.js --apply
 * Run after migration 020. Only explicitly automatic macros are eligible;
 * ambiguous legacy profiles and deliberate personal targets are left untouched.
 */
require('dotenv').config();
const { pool } = require('../src/config/database');
const { resolveTargets, FORMULA_VERSION } = require('../src/utils/nutritionTargets');

async function main() {
    const apply = process.argv.includes('--apply');
    const client = await pool.connect();
    try {
        await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
        const result = await client.query(`SELECT * FROM nutrition_profiles
            WHERE macro_target_mode = 'automatic'
              AND calorie_target_mode IN ('automatic', 'custom')
              AND COALESCE(target_formula_version, 0) < $1${apply ? ' FOR UPDATE' : ''}`, [FORMULA_VERSION]);
        let changed = 0;
        let skipped = 0;
        for (const row of result.rows) {
            let target;
            try { target = resolveTargets(row); } catch { skipped++; continue; }
            // Intentionally omit names, IDs and health measurements from output.
            if (apply) await client.query(`UPDATE nutrition_profiles SET
                target_calories = $1, target_protein = $2, target_carbs = $3,
                target_fat = $4, target_formula_version = $5, updated_at = NOW()
                WHERE id = $6`, [target.target_calories, target.target_protein,
                target.target_carbs, target.target_fat, FORMULA_VERSION, row.id]);
            changed++;
        }
        await client.query(apply ? 'COMMIT' : 'ROLLBACK');
        console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', eligible: result.rows.length, changed, skipped }));
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
