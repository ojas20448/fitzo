/**
 * Food search relevance — pure, dependency-free, testable.
 *
 * WHY THIS EXISTS
 * The previous scorer counted how many query words appeared anywhere in
 * "name + category + region" and added 2 points each. Two consequences, both
 * observed against the real 10,388-item dataset:
 *
 *   "smash burger"  -> top hit "English Oven Burger Bun"
 *   "chiken"        -> 0 results
 *   "burgar"        -> 0 results
 *
 * The first is the important one. A query where only HALF the words matched
 * scored the same per-word as one where all of them did, so a bread bun that
 * happened to contain "burger" beat everything. Users read that as "the app
 * doesn't have my food" when the real failure is ranking.
 *
 * So this module is built on two ideas the old one lacked:
 *
 *   1. COVERAGE. A query token that matches nothing is a penalty, not a
 *      neutral. Matching 1 of 2 tokens is much worse than matching 2 of 2 —
 *      not merely half as good.
 *   2. TYPO TOLERANCE, bounded. Edit distance is only consulted after exact,
 *      prefix and substring all miss, only for tokens long enough that a typo
 *      is more likely than a different word, and with a hard distance cap.
 *      Unbounded fuzziness makes every query match everything.
 *
 * It also handles the join/split problem in both directions ("smashburger"
 * vs "smash burger"), which is how brand names are actually typed.
 */

// Tokens shorter than this are never fuzzy-matched: at 3 characters an edit
// distance of 1 reaches a large share of the dictionary, so "oat" would match
// "eat", "cat", "oats", "goat". Exact and prefix matching still apply to them.
const MIN_FUZZY_LEN = 4;

// Words that carry no discriminating power in a food catalogue. Dropped from
// coverage so "chicken biryani" is not penalised for a missing "with".
const STOP_WORDS = new Set(['and', 'or', 'with', 'the', 'a', 'of', 'in', 'per']);

/**
 * Lowercase, strip diacritics, and reduce punctuation to spaces.
 * McDonald's -> mcdonald s, Café -> cafe, Amul-Kool -> amul kool
 */
function normalize(text) {
    if (!text) return '';
    return String(text)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/** Normalized with all separators removed — "smash burger" -> "smashburger". */
function squash(text) {
    return normalize(text).replace(/ /g, '');
}

function tokenize(text) {
    const out = normalize(text).split(' ').filter(Boolean);
    return out;
}

/**
 * Damerau-Levenshtein distance, abandoned early once it exceeds `max`.
 *
 * The bound is not just an optimisation: it is what keeps the scorer honest.
 * Without it every long name is "close" to every other and fuzzy matching
 * swamps exact matching.
 */
function editDistance(a, b, max) {
    if (a === b) return 0;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    if (la === 0) return lb;
    if (lb === 0) return la;

    let prev2 = null;
    let prev = new Array(lb + 1);
    let cur = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;

    for (let i = 1; i <= la; i++) {
        cur[0] = i;
        let rowMin = cur[0];
        for (let j = 1; j <= lb; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            let v = Math.min(
                cur[j - 1] + 1,      // insertion
                prev[j] + 1,         // deletion
                prev[j - 1] + cost   // substitution
            );
            // transposition ("recieve" -> "receive")
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                v = Math.min(v, prev2[j - 2] + cost);
            }
            cur[j] = v;
            if (v < rowMin) rowMin = v;
        }
        if (rowMin > max) return max + 1; // whole row already too far
        prev2 = prev;
        prev = cur;
        cur = new Array(lb + 1);
    }
    return prev[lb];
}

/** How far a token of this length is allowed to be off. */
function maxDistanceFor(len) {
    if (len < MIN_FUZZY_LEN) return 0;
    if (len <= 6) return 1;
    return 2;
}

/**
 * Best score in [0,1] for one query token against a list of target tokens.
 * Tried in descending confidence so a real match is never beaten by a fuzzy one.
 */
function scoreToken(queryToken, targetTokens) {
    let best = 0;
    for (const t of targetTokens) {
        if (t === queryToken) return 1;                                  // exact
        if (t.startsWith(queryToken) && queryToken.length >= 3) {
            best = Math.max(best, 0.88);                                  // prefix
            continue;
        }
        if (queryToken.length >= 4 && t.includes(queryToken)) {
            best = Math.max(best, 0.72);                                  // substring
            continue;
        }
        const max = maxDistanceFor(queryToken.length);
        if (max > 0 && Math.abs(t.length - queryToken.length) <= max) {
            const d = editDistance(queryToken, t, max);
            if (d <= max) {
                // 1 edit off scores 0.62, 2 edits 0.45 — always below substring
                best = Math.max(best, d === 1 ? 0.62 : 0.45);
            }
        }
    }
    return best;
}

/** True when every query token appears consecutively, in order, in the name. */
function hasAdjacentRun(queryTokens, nameTokens) {
    if (queryTokens.length < 2) return false;
    for (let i = 0; i + queryTokens.length <= nameTokens.length; i++) {
        let ok = true;
        for (let j = 0; j < queryTokens.length; j++) {
            const nt = nameTokens[i + j];
            if (nt !== queryTokens[j] && !nt.startsWith(queryTokens[j])) { ok = false; break; }
        }
        if (ok) return true;
    }
    return false;
}

/**
 * Derive a food's search fields once, so a query does not re-tokenize all
 * ~10k names on every keystroke. Purely a cache of what scoreFood would have
 * computed inline — it changes cost, never ranking.
 */
function prepareFood(food) {
    return {
        food,
        name: normalize(food.name),
        category: normalize(food.category || ''),
        region: normalize(food.region || ''),
        nameTokens: tokenize(food.name),
        brandTokens: tokenize(`${food.region || ''} ${food.category || ''}`),
        nSquash: squash(food.name),
        nameLen: (food.name || '').length,
    };
}

function prepareFoods(foods) {
    return foods.map(prepareFood);
}

/** Derive the query's fields once per search rather than once per food. */
function prepareQuery(query) {
    const qNorm = normalize(query);
    const allQueryTokens = tokenize(query);
    // Keep stop words out of coverage, but never let filtering empty the query.
    const qTokens = allQueryTokens.filter(t => !STOP_WORDS.has(t));
    const queryTokens = qTokens.length ? qTokens : allQueryTokens;
    // Phrase signals are tested against the stop-word-stripped form too, so
    // "chicken with rice" still earns the phrase bonus on "Chicken Rice Bowl" —
    // a filler word must not cost the user points.
    const qCore = queryTokens.join(' ');
    return {
        qNorm,
        queryTokens,
        qCore,
        qSquash: squash(query),
        qCoreSquash: squash(qCore),
    };
}

/**
 * Relevance of one food to one query. 0 means "do not show".
 *
 * @param {string} query
 * @param {{name:string, category?:string, region?:string}} food
 * @returns {number}
 */
function scoreFood(query, food) {
    return scorePrepared(prepareQuery(query), prepareFood(food));
}

function scorePrepared(q, p) {
    const { qNorm, queryTokens, qCore, qSquash, qCoreSquash } = q;
    if (!qNorm) return 0;

    const { name, category, region, nameTokens, brandTokens, nSquash } = p;
    if (!name) return 0;

    let score = 0;

    // --- whole-phrase signals -------------------------------------------
    const phrase = (q) => {
        if (!q) return 0;
        if (name === q) return 120;                         // exact name
        if (name.startsWith(q)) return 70;                  // name begins with it
        if (name.includes(q)) return 45;                    // phrase inside name
        return 0;
    };
    score += Math.max(phrase(qNorm), phrase(qCore));

    // Join/split: "smashburger" should find "Smash Burger" and vice versa.
    const squashScore = (s) => {
        if (!s || s.length < 5) return 0;
        if (nSquash === s) return 110;
        if (nSquash.includes(s)) return 40;
        return 0;
    };
    score += Math.max(squashScore(qSquash), squashScore(qCoreSquash));

    if (region && region === qNorm) score += 50;            // brand exactly
    else if (region && qSquash.length >= 4 && squash(region).startsWith(qSquash)) score += 35;

    // --- per-token coverage ---------------------------------------------
    let matchedSum = 0;
    let matchedCount = 0;
    for (const qt of queryTokens) {
        const inName = scoreToken(qt, nameTokens);
        const inBrand = scoreToken(qt, brandTokens) * 0.55; // brand matches count less
        const best = Math.max(inName, inBrand);
        if (best > 0) { matchedSum += best; matchedCount++; }
    }

    // Nothing matched at all and no phrase signal fired -> not a result.
    if (matchedCount === 0 && score === 0) return 0;

    const coverage = queryTokens.length ? matchedCount / queryTokens.length : 0;
    const quality = matchedCount ? matchedSum / matchedCount : 0;

    // THE FIX for "smash burger" -> "English Oven Burger Bun".
    // Coverage is squared, so half the tokens matching is worth a quarter, not
    // a half. A one-word-of-two accident can no longer outrank a full match.
    score += 60 * quality * coverage * coverage;

    // Every query token found, in order, next to each other.
    if (hasAdjacentRun(queryTokens, nameTokens)) score += 25;

    if (category && category.includes(qNorm)) score += 8;

    // Prefer the plainer item: "Paneer (100g)" over "Faasos Butter Paneer Meal"
    // when both match equally. Small, so it only breaks near-ties.
    score += Math.max(0, 6 - nameTokens.length * 0.5);

    // A single weak fuzzy hit on one token of a multi-token query is noise.
    if (coverage < 0.5 && score < 30) return 0;

    return score;
}

/**
 * Rank foods for a query.
 *
 * `foods` may be raw food objects or the output of prepareFoods(). Passing
 * prepared entries is what makes this affordable at ~10k rows on every
 * keystroke — without it, each query re-tokenizes every name and re-normalizes
 * the query once per food.
 *
 * @returns {Array<{food:object, score:number}>} sorted, best first
 */
function rankFoods(query, foods, limit = 25) {
    const q = prepareQuery(query);
    if (!q.qNorm) return [];

    const out = [];
    for (const entry of foods) {
        const p = entry.nameTokens ? entry : prepareFood(entry);
        const score = scorePrepared(q, p);
        if (score > 0) out.push({ food: p.food, score, len: p.nameLen });
    }
    out.sort((a, b) => (b.score - a.score) || (a.len - b.len));
    return out.slice(0, limit).map(({ food, score }) => ({ food, score }));
}

module.exports = {
    prepareFood,
    prepareFoods,
    prepareQuery,
    normalize,
    squash,
    tokenize,
    editDistance,
    scoreToken,
    scoreFood,
    rankFoods,
    MIN_FUZZY_LEN,
};
