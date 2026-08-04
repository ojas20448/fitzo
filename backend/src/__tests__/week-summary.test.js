/**
 * Week Summary Tests
 *
 * Two things these fixtures deliberately do NOT do: land on clean arithmetic,
 * and use numbers. SUM() over an INTEGER column comes back from node-pg as a
 * STRING, so a summary that adds without coercing concatenates — "2333" + "200"
 * is "2333200". Earlier bugs in this codebase survived precisely because the
 * fixture was the benign case.
 */

const { summariseWeek, CALORIE_BAND } = require('../utils/weekSummary');

const targets = { target_calories: 2000, target_protein: 150 };

describe('summariseWeek', () => {
    it('coerces string sums rather than concatenating them', () => {
        const r = summariseWeek(
            [{ calories: '2333', protein: '100' }, { calories: '200', protein: '50' }],
            targets,
        );
        // Concatenation would give 2333200 / 2 — a nonsense number.
        expect(r.avgCalories).toBe(1267); // (2333 + 200) / 2 = 1266.5 -> 1267
        expect(r.avgProtein).toBe(75);
    });

    it('averages over days logged, not over seven', () => {
        const r = summariseWeek(
            [{ calories: 2000, protein: 150 }, { calories: 2000, protein: 150 }, { calories: 2000, protein: 150 }],
            targets,
        );
        expect(r.daysLogged).toBe(3);
        expect(r.avgCalories).toBe(2000); // NOT 857 (6000/7)
    });

    it('counts a calorie day on target only within the band', () => {
        const within = 2000 * (1 + CALORIE_BAND);   // 2200, inclusive
        const over = within + 1;
        const r = summariseWeek(
            [{ calories: 2000, protein: 0 }, { calories: within, protein: 0 }, { calories: over, protein: 0 }],
            targets,
        );
        expect(r.calorieTargetDays).toBe(2);
    });

    it('counts under-eating as off target too — it is a band, not a ceiling', () => {
        const r = summariseWeek([{ calories: 900, protein: 0 }], targets);
        expect(r.calorieTargetDays).toBe(0);
    });

    it('treats protein as a floor, so over target still counts', () => {
        const r = summariseWeek(
            [{ calories: 0, protein: 150 }, { calories: 0, protein: 220 }, { calories: 0, protein: 149 }],
            targets,
        );
        expect(r.proteinTargetDays).toBe(2);
    });

    it('returns zeros rather than NaN for an empty week', () => {
        const r = summariseWeek([], targets);
        expect(r).toMatchObject({
            daysLogged: 0, avgCalories: 0, avgProtein: 0,
            calorieTargetDays: 0, proteinTargetDays: 0,
        });
        expect(Number.isNaN(r.avgCalories)).toBe(false);
    });

    it('survives a null or malformed history', () => {
        expect(summariseWeek(null, targets).daysLogged).toBe(0);
        expect(summariseWeek(undefined, targets).daysLogged).toBe(0);
    });

    it('counts a zero-calorie day as logged — the row exists', () => {
        const r = summariseWeek([{ calories: 0, protein: 0 }], targets);
        expect(r.daysLogged).toBe(1);
        expect(r.avgCalories).toBe(0);
    });

    it('skips malformed rows without dragging the average down', () => {
        const r = summariseWeek(
            [{ calories: 2000, protein: 150 }, null, { calories: 'abc', protein: 'xyz' }],
            targets,
        );
        expect(r.daysLogged).toBe(2); // the null is dropped; 'abc' coerces to 0
        expect(r.avgCalories).toBe(1000);
    });

    it('falls back to sane targets when none are supplied', () => {
        const r = summariseWeek([{ calories: 2000, protein: 150 }], null);
        expect(r.targetCalories).toBe(2000);
        expect(r.targetProtein).toBe(150);
    });

    it('echoes the targets it used so the card need not fetch them', () => {
        const r = summariseWeek([], { target_calories: 2146, target_protein: 188 });
        expect(r.targetCalories).toBe(2146);
        expect(r.targetProtein).toBe(188);
    });
});
