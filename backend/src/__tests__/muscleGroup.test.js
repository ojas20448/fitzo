const { inferMuscleGroup, resolveMuscleGroup, normalizeMuscleGroup } = require('../utils/muscleGroup');

describe('inferMuscleGroup', () => {
    // The failure this guards against is silent: a misclassified custom
    // exercise still renders, just under the wrong muscle, so only a test
    // catches it.
    const cases = [
        ['Incline Dumbbell Press', 'chest'],
        ['Cable Fly', 'chest'],
        ['Barbell Bench Press', 'chest'],
        ['Push-Up', 'chest'],
        ['Triceps Rope Pushdown', 'arms'],
        ['Barbell Curl', 'arms'],
        ['Skull Crusher', 'arms'],
        ['Hammer Curl', 'arms'],
        ['Face Pull', 'back'],
        ['Barbell Row', 'back'],
        ['Lat Pulldown', 'back'],
        ['Pull Up', 'back'],
        ['Romanian Deadlift', 'legs'],
        ['Leg Curl', 'legs'],
        ['Back Squat', 'legs'],
        ['Standing Calf Raise', 'legs'],
        ['Bulgarian Split Squat', 'legs'],
        ['Overhead Press', 'shoulders'],
        ['Lateral Raise', 'shoulders'],
        ['Arnold Press', 'shoulders'],
        ['Russian Twist', 'core'],
        ['Hanging Leg Raise', 'core'],
        ['Plank', 'core'],
    ];

    test.each(cases)('%s -> %s', (name, expected) => {
        expect(inferMuscleGroup(name)).toBe(expected);
    });

    describe('ordering traps', () => {
        // Each of these matches an earlier, more general rule as well. They are
        // the reason RULES is order-dependent, so they get their own block.
        test('"Leg Curl" is legs, not arms (both contain "curl")', () => {
            expect(inferMuscleGroup('Leg Curl')).toBe('legs');
        });

        test('"Romanian Deadlift" is legs, not back (both contain "deadlift")', () => {
            expect(inferMuscleGroup('Romanian Deadlift')).toBe('legs');
        });

        test('"Bench Press" is chest, not shoulders (both contain "press")', () => {
            expect(inferMuscleGroup('Bench Press')).toBe('chest');
        });

        test('"Face Pull" is back, not legs (both contain "pull")', () => {
            expect(inferMuscleGroup('Face Pull')).toBe('back');
        });

        test('"Calf Raise" is legs, not shoulders (both contain "raise")', () => {
            expect(inferMuscleGroup('Calf Raise')).toBe('legs');
        });
    });

    describe('returns null rather than guessing', () => {
        // A wrong muscle group corrupts the heatmap worse than a missing one,
        // so anything unrecognised must stay null.
        test.each([
            [''], ['   '], [null], [undefined], [42], [{}],
            ['Chalk Up'], ['Warmup'], ['zzzzz'],
        ])('%p -> null', (input) => {
            expect(inferMuscleGroup(input)).toBeNull();
        });
    });

    test('is case and whitespace insensitive', () => {
        expect(inferMuscleGroup('  bARBELL rOW  ')).toBe('back');
    });
});

describe('normalizeMuscleGroup', () => {
    test('accepts the six valid groups in any case', () => {
        expect(normalizeMuscleGroup('CHEST')).toBe('chest');
        expect(normalizeMuscleGroup(' legs ')).toBe('legs');
    });

    test('rejects anything else, so bad client input cannot reach the DB', () => {
        expect(normalizeMuscleGroup('other')).toBeNull();
        expect(normalizeMuscleGroup('biceps')).toBeNull();
        expect(normalizeMuscleGroup('; DROP TABLE users;')).toBeNull();
        expect(normalizeMuscleGroup(null)).toBeNull();
    });
});

describe('resolveMuscleGroup', () => {
    test('an explicit valid value wins over inference', () => {
        expect(resolveMuscleGroup({
            custom_exercise_name: 'Barbell Curl', muscle_group: 'shoulders',
        })).toBe('shoulders');
    });

    test('an invalid explicit value falls back to inference', () => {
        expect(resolveMuscleGroup({
            custom_exercise_name: 'Barbell Curl', muscle_group: 'nonsense',
        })).toBe('arms');
    });

    test('catalogue exercises resolve to null so exercises.muscle_groups stays the single source of truth', () => {
        expect(resolveMuscleGroup({
            exercise_id: 'abc-123', custom_exercise_name: 'Barbell Curl',
        })).toBeNull();
    });

    test('custom exercise with no explicit group is inferred', () => {
        expect(resolveMuscleGroup({ custom_exercise_name: 'Cable Fly' })).toBe('chest');
    });

    test('unrecognised custom exercise stays null', () => {
        expect(resolveMuscleGroup({ custom_exercise_name: 'Mystery Move' })).toBeNull();
    });
});
