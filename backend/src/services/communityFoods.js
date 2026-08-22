/**
 * Community food catalog — submit / search / flag.
 *
 * The write path into the global food database. See
 * src/db/migrate_community_foods.sql for why this is a third store rather than
 * an extension of user_foods or of indian-foods.json.
 *
 * Moderation is auto-publish with flag-driven takedown, so everything that
 * protects data quality has to happen at submit time or via distinct-user
 * flags. There is no reviewer standing between a member and global search.
 */

const { query } = require('../config/database');
const { rankFoods } = require('../utils/foodSearch');
const { buildServingVariants } = require('../utils/cookingMedium');
const indianFood = require('./indianFood');
const { ValidationError, ConflictError, NotFoundError } = require('../utils/errors');

// Distinct members who must flag a food before it drops out of global search.
// One is too few (any member could unilaterally delete a food for everyone);
// much more than three and junk stays visible for weeks on a small user base.
const FLAG_THRESHOLD = 3;

// Similarity at or above which a submission is treated as already curated.
//
// This is a RATIO, not a raw score. utils/foodSearch returns unbounded absolute
// scores — "Masala Dosa" against itself is 320, "Idli" against itself is 185 —
// so any fixed cutoff would be meaningless across names of different lengths.
// Dividing the candidate's score by the submission's self-score normalises to
// 0..1 regardless of the scorer's internal scale.
//
// Measured against the live 9,923-row catalog:
//   1.000  exact / case / whitespace variants of a curated name
//   0.728  "Roti"     -> "Roti (Chapati)"        genuinely the same food
//   0.591  "Chapati"  -> "Chapati with Ghee"     NOT the same food, different macros
//   0.163  "Ragi Ambali", and everything else genuinely new, at 0.16 and below
// 0.70 sits in the gap. Erring low here is the expensive direction: a false
// duplicate silently blocks a legitimate contribution behind a 409.
const DUPLICATE_SCORE = 0.70;

// Atwater factors. Macro grams imply a calorie count; if the submitted number
// disagrees badly, one of the two is wrong and the row is junk either way.
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

// Generous band — real foods miss Atwater legitimately (fibre, sugar alcohols,
// rounding on a 40 g roti). This is a junk filter, not a nutrition audit: it
// exists to catch "500 kcal, 2 g protein, 1 g carbs, 0 g fat" typos and
// invented numbers, not to second-guess a careful member.
const MACRO_TOLERANCE = 0.35;
const MACRO_FLOOR_KCAL = 60; // below this, absolute error matters more than %

const PREFIX = 'com_';
const withPrefix = (id) => `${PREFIX}${id}`;
const stripPrefix = (id) => (String(id).startsWith(PREFIX) ? String(id).slice(PREFIX.length) : id);
const isCommunityId = (id) => typeof id === 'string' && id.startsWith(PREFIX);

/**
 * Shape a DB row the way indianFood.searchFoods shapes a curated row, so the
 * two can be concatenated in /api/food/search without the client branching.
 */
function toSearchResult(row) {
    return {
        id: withPrefix(row.id),
        name: row.name,
        brand: row.category,
        type: 'Community',
        description: `Per ${row.serving_size} - Calories: ${row.calories}kcal | Fat: ${row.fat}g | Carbs: ${row.carbs}g | Protein: ${row.protein}g`,
        calories: Number(row.calories),
        protein: Number(row.protein),
        carbs: Number(row.carbs),
        fat: Number(row.fat),
        // Client badges these differently — a member-contributed number does
        // not carry the same authority as an IFCT2017 one.
        isCommunity: true,
        submittedBy: row.submitter_username || null,
        logCount: Number(row.log_count || 0),
    };
}

/**
 * Reject arithmetic that cannot describe a real food.
 * Returns null when acceptable, or a human-readable reason string.
 */
function macroSanityError({ calories, protein, carbs, fat }) {
    const implied =
        protein * KCAL_PER_G.protein +
        carbs * KCAL_PER_G.carbs +
        fat * KCAL_PER_G.fat;

    // Nothing at all: a food with zero of everything is not a food.
    if (calories === 0 && implied === 0) {
        return 'A food needs at least some calories or macros.';
    }

    // Compare against the larger of the two so the check is symmetric —
    // 500 kcal from 10 g of macros fails as loudly as 10 kcal from 100 g.
    const larger = Math.max(calories, implied);
    if (larger < MACRO_FLOOR_KCAL) return null; // too small for % to mean much

    const drift = Math.abs(calories - implied) / larger;
    if (drift > MACRO_TOLERANCE) {
        return `Those macros work out to about ${Math.round(implied)} kcal, but you entered ${calories} kcal. Please check the numbers.`;
    }
    return null;
}

/**
 * Is this food already in the curated JSON catalog?
 * Cheap in-memory check — no DB round trip.
 */
function findCuratedDuplicate(name) {
    const { foods } = indianFood.searchFoods(name, 1);
    if (!foods.length) return null;
    const top = foods[0];

    // searchFoods does not surface the score, so re-score the single candidate
    // through the same ranker — then divide by the submission's score against
    // ITSELF to get a scale-free 0..1 similarity. See DUPLICATE_SCORE.
    const [cand] = rankFoods(name, [{ name: top.name, category: 'Other' }], 1);
    const [self] = rankFoods(name, [{ name, category: 'Other' }], 1);
    if (!cand || !self || !self.score) return null;

    return cand.score / self.score >= DUPLICATE_SCORE ? top : null;
}

/**
 * Search live community foods.
 *
 * Two stages on purpose: a cheap ILIKE sweep narrows the table to plausible
 * candidates (trigram-indexed where pg_trgm is available), then the SAME
 * scorer the curated catalog uses ranks them. Ranking in SQL would mean two
 * different notions of relevance in one result list — "chiken" would fuzzy-
 * match a curated roti but miss a community one.
 */
async function searchFoods(searchTerm, limit = 8) {
    const term = (searchTerm || '').trim();
    if (!term) return { foods: [], total: 0 };

    // Match tokens individually so "paneer tikka" still finds "Tikka Paneer
    // Roll". Capped at 5 tokens: the scorer, not SQL, decides relevance.
    const tokens = term.toLowerCase().split(/\s+/).filter((t) => t.length >= 2).slice(0, 5);
    if (!tokens.length) return { foods: [], total: 0 };

    const clauses = tokens.map((_, i) => `lower(cf.name) LIKE $${i + 1}`).join(' OR ');
    const params = tokens.map((t) => `%${t}%`);

    const { rows } = await query(
        `SELECT cf.id, cf.name, cf.category, cf.serving_size, cf.calories,
                cf.protein, cf.carbs, cf.fat, cf.log_count,
                u.username AS submitter_username
           FROM community_foods cf
           LEFT JOIN users u ON u.id = cf.submitted_by
          WHERE cf.status = 'live' AND (${clauses})
          LIMIT 120`,
        params
    );
    if (!rows.length) return { foods: [], total: 0 };

    const ranked = rankFoods(term, rows, limit);
    return {
        foods: ranked.map(({ food }) => toSearchResult(food)),
        total: ranked.length,
    };
}

/**
 * Full detail for one community food, shaped like indianFood.getFoodDetails
 * (servings[] with cooking-medium variants) so CalorieLogScreen renders it
 * through the existing code path.
 */
async function getFoodDetails(prefixedId) {
    const { rows } = await query(
        `SELECT cf.*, u.username AS submitter_username
           FROM community_foods cf
           LEFT JOIN users u ON u.id = cf.submitted_by
          WHERE cf.id = $1 AND cf.status = 'live'`,
        [stripPrefix(prefixedId)]
    );
    if (!rows.length) throw new NotFoundError('That food is no longer available.');
    const food = rows[0];

    const baseServing = {
        id: 'default',
        description: food.serving_size,
        measurementDescription: food.serving_size,
        calories: Number(food.calories),
        protein: Number(food.protein),
        carbs: Number(food.carbs),
        fat: Number(food.fat),
        fiber: Number(food.fiber || 0),
        sugar: 0,
        sodium: 0,
        saturatedFat: 0,
        cholesterol: 0,
    };

    return {
        id: withPrefix(food.id),
        name: food.name,
        brand: food.category,
        type: 'Community',
        isCommunity: true,
        submittedBy: food.submitter_username || null,
        logCount: Number(food.log_count || 0),
        flagCount: Number(food.flag_count || 0),
        servings: buildServingVariants(baseServing, food.category),
    };
}

/**
 * Add a food to the global catalog. Live immediately on success.
 *
 * Throws ConflictError carrying the existing food when this is a duplicate —
 * the route turns that into a 409 the client can use to send the member
 * straight to the entry that already exists.
 */
async function submitFood(userId, input) {
    const name = input.name.trim().replace(/\s+/g, ' ');

    const numbers = {
        calories: Math.round(input.calories),
        protein: Number(input.protein) || 0,
        carbs: Number(input.carbs) || 0,
        fat: Number(input.fat) || 0,
    };

    const sanity = macroSanityError(numbers);
    if (sanity) throw new ValidationError(sanity);

    // 1. Already curated? Point at the authoritative row, never shadow it.
    const curated = findCuratedDuplicate(name);
    if (curated) {
        const err = new ConflictError(`"${curated.name}" is already in the food database.`);
        err.existing = { ...curated, source: 'indian' };
        throw err;
    }

    // 2. Already contributed? The unique index is the real guarantee; this
    //    check exists so the common case returns the row, not an error code.
    const existing = await query(
        `SELECT cf.id, cf.name, cf.category, cf.serving_size, cf.calories,
                cf.protein, cf.carbs, cf.fat, cf.log_count,
                u.username AS submitter_username
           FROM community_foods cf
           LEFT JOIN users u ON u.id = cf.submitted_by
          WHERE lower(cf.name) = lower($1) AND cf.status <> 'removed'`,
        [name]
    );
    if (existing.rows.length) {
        const err = new ConflictError(`"${existing.rows[0].name}" is already in the food database.`);
        err.existing = toSearchResult(existing.rows[0]);
        throw err;
    }

    try {
        const { rows } = await query(
            `INSERT INTO community_foods
                (submitted_by, name, category, region, serving_size,
                 calories, protein, carbs, fat, fiber)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                userId,
                name,
                input.category || 'Other',
                input.region || 'All India',
                input.serving_size.trim(),
                numbers.calories,
                numbers.protein,
                numbers.carbs,
                numbers.fat,
                Number(input.fiber) || 0,
            ]
        );
        return toSearchResult(rows[0]);
    } catch (e) {
        // 23505 = the unique index fired between the SELECT and the INSERT.
        if (e.code === '23505') {
            const err = new ConflictError(`"${name}" was just added by someone else.`);
            err.existing = null;
            throw err;
        }
        throw e;
    }
}

/**
 * Flag a food as wrong. Auto-hides at FLAG_THRESHOLD distinct members.
 *
 * flag_count is recomputed from the flags table rather than incremented, so a
 * double-submit or a retried request can never inflate it past the number of
 * real distinct flaggers.
 */
async function flagFood(userId, prefixedId, { reason = 'other', note = null } = {}) {
    const id = stripPrefix(prefixedId);

    const target = await query(
        `SELECT id, status FROM community_foods WHERE id = $1`,
        [id]
    );
    if (!target.rows.length || target.rows[0].status === 'removed') {
        throw new NotFoundError('That food no longer exists.');
    }

    await query(
        `INSERT INTO community_food_flags (food_id, user_id, reason, note)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (food_id, user_id) DO UPDATE
            SET reason = EXCLUDED.reason, note = EXCLUDED.note`,
        [id, userId, reason, note]
    );

    const { rows } = await query(
        `UPDATE community_foods cf
            SET flag_count = sub.c,
                status = CASE WHEN sub.c >= $2 AND cf.status = 'live'
                              THEN 'hidden' ELSE cf.status END,
                updated_at = NOW()
           FROM (SELECT COUNT(*)::int AS c FROM community_food_flags WHERE food_id = $1) sub
          WHERE cf.id = $1
      RETURNING cf.flag_count, cf.status`,
        [id, FLAG_THRESHOLD]
    );

    return {
        flagCount: rows[0].flag_count,
        hidden: rows[0].status === 'hidden',
        threshold: FLAG_THRESHOLD,
    };
}

/**
 * Withdraw your own submission. Allowed only while nobody else has adopted it
 * — once other members are logging a food, one person cannot yank it out from
 * under them. Past that point it takes flags or the CLI.
 */
async function withdrawFood(userId, prefixedId) {
    const id = stripPrefix(prefixedId);
    const { rows } = await query(
        `SELECT submitted_by, log_count, name FROM community_foods
          WHERE id = $1 AND status <> 'removed'`,
        [id]
    );
    if (!rows.length) throw new NotFoundError('That food no longer exists.');
    if (rows[0].submitted_by !== userId) {
        throw new ValidationError('You can only remove foods you added.');
    }
    if (Number(rows[0].log_count) > 1) {
        throw new ConflictError(
            `Other members are logging "${rows[0].name}". Flag it instead if the numbers are wrong.`
        );
    }
    await query(
        `UPDATE community_foods SET status = 'removed', updated_at = NOW() WHERE id = $1`,
        [id]
    );
    return { removed: true };
}

/** Bump usage. Fire-and-forget from the log path — never block a log on it. */
async function recordLog(prefixedId) {
    if (!isCommunityId(prefixedId)) return;
    try {
        await query(
            `UPDATE community_foods SET log_count = log_count + 1 WHERE id = $1`,
            [stripPrefix(prefixedId)]
        );
    } catch (e) {
        console.error('community food log_count bump failed:', e.message);
    }
}

module.exports = {
    FLAG_THRESHOLD,
    PREFIX,
    isCommunityId,
    stripPrefix,
    searchFoods,
    getFoodDetails,
    submitFood,
    flagFood,
    withdrawFood,
    recordLog,
    // exported for tests
    macroSanityError,
};
