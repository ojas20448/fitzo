/**
 * Community Food Catalog Tests
 *
 * The catalog is auto-publish: a submission is live in global search with no
 * human in between. That makes the submit-time guards the only thing standing
 * between a typo and every member seeing it, so they are unit tested here.
 *
 * The DB-backed paths (flag thresholds, unique-name collisions, ON DELETE
 * SET NULL) were verified against the live schema in a rolled-back transaction
 * — see the notes in db/migrate_community_foods.sql.
 */

const { macroSanityError, isCommunityId, stripPrefix, PREFIX } = require('../services/communityFoods');

describe('macroSanityError', () => {
    const err = (v) => macroSanityError(v);

    it('accepts a real food whose macros match its calories', () => {
        // Roti: 3.5×4 + 20×4 + 3×9 = 121 kcal against a stated 120.
        expect(err({ calories: 120, protein: 3.5, carbs: 20, fat: 3 })).toBeNull();
    });

    it('accepts a high-fat dish where fat dominates the total', () => {
        expect(err({ calories: 450, protein: 8, carbs: 30, fat: 30 })).toBeNull();
    });

    it('accepts a protein shake', () => {
        expect(err({ calories: 120, protein: 24, carbs: 3, fat: 1 })).toBeNull();
    });

    it('rejects calories far above what the macros can account for', () => {
        // The classic fat-finger: an extra zero on calories.
        const msg = err({ calories: 500, protein: 2, carbs: 1, fat: 0 });
        expect(msg).toMatch(/work out to about 12 kcal/);
    });

    it('rejects calories far below what the macros imply', () => {
        // Symmetric to the case above — 100 g of macros cannot be 10 kcal.
        expect(err({ calories: 10, protein: 20, carbs: 30, fat: 10 })).toBeTruthy();
    });

    it('rejects an entry that is nothing at all', () => {
        expect(err({ calories: 0, protein: 0, carbs: 0, fat: 0 })).toMatch(/at least some calories/);
    });

    it('lets very small entries through — percentages are meaningless there', () => {
        // Black coffee, green tea, a squeeze of lemon. Atwater rounding noise
        // on a 5 kcal item would reject every legitimate low-calorie food.
        expect(err({ calories: 5, protein: 0, carbs: 1, fat: 0 })).toBeNull();
        expect(err({ calories: 2, protein: 0, carbs: 0, fat: 0 })).toBeNull();
    });

    it('tolerates the drift real foods have from fibre and rounding', () => {
        // 12×4 + 40×4 + 8×9 = 280 against a stated 250 — 11% off, fine.
        expect(err({ calories: 250, protein: 12, carbs: 40, fat: 8 })).toBeNull();
    });

    it('draws the line before drift becomes fabrication', () => {
        // 5×4 + 5×4 + 1×9 = 49 against a stated 300. Not rounding.
        expect(err({ calories: 300, protein: 5, carbs: 5, fat: 1 })).toBeTruthy();
    });
});

describe('community food ids', () => {
    it('recognises its own prefix', () => {
        expect(isCommunityId(`${PREFIX}abc-123`)).toBe(true);
    });

    it('does not claim curated catalog ids', () => {
        // This matters: GET /api/food/:id defaults source='indian', so a
        // mis-classified id silently 404s against the wrong store.
        expect(isCommunityId('ind_1')).toBe(false);
        expect(isCommunityId('12345')).toBe(false);
    });

    it('survives junk input without throwing', () => {
        expect(isCommunityId(null)).toBe(false);
        expect(isCommunityId(undefined)).toBe(false);
        expect(isCommunityId(42)).toBe(false);
    });

    it('strips the prefix and leaves bare uuids alone', () => {
        expect(stripPrefix(`${PREFIX}abc-123`)).toBe('abc-123');
        expect(stripPrefix('abc-123')).toBe('abc-123');
    });
});
