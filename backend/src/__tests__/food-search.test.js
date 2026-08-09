const {
    normalize,
    squash,
    editDistance,
    scoreToken,
    scoreFood,
    rankFoods,
} = require('../utils/foodSearch');

const f = (name, category = 'Fast Food', region = 'Generic') => ({ name, category, region });

describe('normalize / squash', () => {
    test('lowercases, strips diacritics and punctuation', () => {
        expect(normalize("McDonald's Café")).toBe('mcdonald s cafe');
        expect(normalize('Amul-Kool  (200ml)')).toBe('amul kool 200ml');
    });

    test('squash removes separators for join/split matching', () => {
        expect(squash('Smash Burger')).toBe('smashburger');
        expect(squash('smashburger')).toBe('smashburger');
    });

    test('empty and nullish input never throws', () => {
        expect(normalize(null)).toBe('');
        expect(normalize(undefined)).toBe('');
        expect(normalize('')).toBe('');
    });
});

describe('editDistance', () => {
    test('counts substitutions, insertions and deletions', () => {
        expect(editDistance('chiken', 'chicken', 2)).toBe(1);
        expect(editDistance('burgar', 'burger', 2)).toBe(1);
        expect(editDistance('paneer', 'paneer', 2)).toBe(0);
    });

    test('counts a transposition as one edit, not two', () => {
        // The reason for using Damerau rather than plain Levenshtein: adjacent
        // key swaps are the most common real typo.
        expect(editDistance('panere', 'paneer', 2)).toBe(1);
    });

    test('abandons early beyond the bound rather than returning a real distance', () => {
        expect(editDistance('paneer', 'biryani', 1)).toBeGreaterThan(1);
    });
});

describe('scoreToken confidence ordering', () => {
    test('exact beats prefix beats substring beats fuzzy', () => {
        const exact = scoreToken('paneer', ['paneer']);
        const prefix = scoreToken('pane', ['paneer']);
        const substr = scoreToken('anee', ['paneer']);
        const fuzzy = scoreToken('panner', ['paneer']);
        expect(exact).toBeGreaterThan(prefix);
        expect(prefix).toBeGreaterThan(substr);
        expect(substr).toBeGreaterThan(fuzzy);
        expect(fuzzy).toBeGreaterThan(0);
    });

    test('short tokens are never fuzzy-matched', () => {
        // "oat" within edit distance 1 of "eat"/"cat"/"oats" would match half
        // the catalogue, so anything under MIN_FUZZY_LEN must be exact/prefix.
        expect(scoreToken('oat', ['eat'])).toBe(0);
        expect(scoreToken('oat', ['oats'])).toBeGreaterThan(0); // prefix still works
    });
});

describe('the regression this module was written for', () => {
    // Observed against the real dataset: "smash burger" ranked a bread bun
    // first, because matching 1 of 2 words scored the same per word as 2 of 2.
    const bun = f('English Oven Burger Bun', 'Breads', 'English Oven');
    const kfcBurger = f('KFC Zinger Burger', 'Fast Food', 'KFC');
    const smash = f('Smash Burger (Single Patty)', 'Fast Food', 'Smashburger');

    test('a half-matching item never outranks a full match', () => {
        const ranked = rankFoods('smash burger', [bun, kfcBurger, smash]);
        expect(ranked[0].food.name).toBe('Smash Burger (Single Patty)');
    });

    test('a one-of-two-token accident scores below a two-of-two match', () => {
        expect(scoreFood('smash burger', smash)).toBeGreaterThan(scoreFood('smash burger', bun));
    });

    test('joined and split spellings both find the brand', () => {
        expect(scoreFood('smashburger', smash)).toBeGreaterThan(0);
        expect(scoreFood('smash burger', smash)).toBeGreaterThan(0);
    });
});

describe('typo tolerance', () => {
    test('single-word typos that previously returned nothing now match', () => {
        expect(scoreFood('chiken', f('Chicken Biryani'))).toBeGreaterThan(0);
        expect(scoreFood('burgar', f('KFC Zinger Burger'))).toBeGreaterThan(0);
        expect(scoreFood('panner', f('Paneer Butter Masala'))).toBeGreaterThan(0);
    });

    test('a typo still ranks below the correct spelling', () => {
        const correct = scoreFood('chicken', f('Chicken Biryani'));
        const typo = scoreFood('chiken', f('Chicken Biryani'));
        expect(correct).toBeGreaterThan(typo);
    });

    test('fuzziness does not make unrelated foods match', () => {
        expect(scoreFood('paneer', f('Chicken Biryani'))).toBe(0);
        expect(scoreFood('biryani', f('Cold Coffee'))).toBe(0);
    });
});

describe('ranking quality', () => {
    test('the plain item wins over a longer dish containing the word', () => {
        const plain = f('Paneer (100g)', 'Dairy', 'Generic');
        const dish = f('Faasos Butter Paneer Meal', 'Fast Food', 'Faasos');
        const ranked = rankFoods('paneer', [dish, plain]);
        expect(ranked[0].food.name).toBe('Paneer (100g)');
    });

    test('brand queries surface that brand', () => {
        const mc = f("McDonald's McAloo Tikki Burger", 'Fast Food', "McDonald's");
        const other = f('Veg Burger', 'Fast Food', 'Generic');
        const ranked = rankFoods('mcdonalds', [other, mc]);
        expect(ranked[0].food.name).toBe("McDonald's McAloo Tikki Burger");
    });

    test('adjacent in-order words beat scattered ones', () => {
        const adjacent = f('Chicken Biryani');
        const scattered = f('Chicken Curry with Rice and Biryani Masala');
        expect(scoreFood('chicken biryani', adjacent))
            .toBeGreaterThan(scoreFood('chicken biryani', scattered));
    });

    test('a filler word costs the user nothing', () => {
        // Regression: "with" used to block the phrase bonus, because the
        // phrase check ran against the raw query while coverage ran against
        // the stop-word-stripped one. A filler word made the same dish score
        // 110 points lower.
        const withStop = scoreFood('chicken with rice', f('Chicken Rice Bowl'));
        const without = scoreFood('chicken rice', f('Chicken Rice Bowl'));
        expect(withStop).toBe(without);
    });

    test('empty query returns nothing rather than everything', () => {
        expect(rankFoods('', [f('Paneer'), f('Rice')])).toHaveLength(0);
        expect(rankFoods('   ', [f('Paneer')])).toHaveLength(0);
    });

    test('respects the limit', () => {
        const many = Array.from({ length: 50 }, (_, i) => f(`Chicken Dish ${i}`));
        expect(rankFoods('chicken', many, 10)).toHaveLength(10);
    });
});
