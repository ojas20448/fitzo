/**
 * Learn content v2 — 22 rewritten lessons + 8 new ones.
 *
 * Source of truth for this content:
 *   docs/learn-content-draft-sample.md    (4)
 *   docs/learn-content-draft-rewrites.md  (18)
 *   docs/learn-content-draft-new.md       (8 new)
 *
 * WHY THIS IS A SCRIPT AND NOT A .sql FILE
 * Lesson bodies are markdown full of apostrophes. Hand-doubling quotes across
 * ~30 bodies is a defect waiting to happen, and a mis-escape produces valid SQL
 * with silently wrong text. Template literals + parameterised queries remove
 * the entire class.
 *
 * WHY `answer` IS TEXT AND NOT AN INDEX
 * The stored shape is {question, options, correct: <int index>, explanation}.
 * Transcribing 120 indexes by hand guarantees at least one off-by-one, and a
 * wrong index is invisible — it validates fine and just teaches the wrong
 * answer. So each question carries the answer TEXT and buildQuestions() derives
 * the index, throwing if the text is not among the options. A typo becomes a
 * crash instead of a lesson that marks correct answers wrong.
 *
 * SAFETY
 * 28 learn_attempts reference lesson uuids. Nothing is deleted. The 22 existing
 * lessons are UPDATEd by title; the 8 new ones INSERT only if absent, so
 * re-running is a no-op rather than a duplicate.
 *
 * Usage:
 *   node scripts/seed_learn_v2.js --dry     verify + print plan, roll back
 *   node scripts/seed_learn_v2.js --commit  apply
 */

require('dotenv').config();
const { Client } = require('pg');

// Same formula as migration 009, so read_seconds stays consistent for rows
// whose content changed here: chars/5 ~= words, /200wpm * 60 = seconds, min 30.
const readSeconds = (content) =>
    Math.max(30, Math.round(content.length / 5.0 / 200.0 * 60));

function buildQuestions(title, list) {
    if (list.length !== 4) {
        throw new Error(`${title}: expected 4 questions, got ${list.length}`);
    }
    return list.map((item, i) => {
        const where = `${title} Q${i + 1}`;
        if (item.options.length !== 4) {
            throw new Error(`${where}: expected 4 options, got ${item.options.length}`);
        }
        if (new Set(item.options).size !== 4) {
            throw new Error(`${where}: duplicate options`);
        }
        const correct = item.options.indexOf(item.answer);
        if (correct === -1) {
            throw new Error(`${where}: answer ${JSON.stringify(item.answer)} is not one of the options`);
        }
        if (!item.explanation || item.explanation.trim().length < 20) {
            throw new Error(`${where}: missing or trivial explanation`);
        }
        return {
            question: item.q,
            options: item.options,
            correct,
            explanation: item.explanation,
        };
    });
}

// ---------------------------------------------------------------------------
// GROUP 1 — full content replacement (9 lessons)
// The 4 from the sample draft plus the 5 Group A rewrites. "Creating a
// Sustainable Deficit" is listed in Group A of the rewrites file but its body
// lives in the sample file, which is why Group A reads as 6 and only 5 bodies
// appear there.
// ---------------------------------------------------------------------------

const REWRITE = [
    {
        title: 'Protein: The Building Block',
        description: 'How much protein you need, and where to get it',
        topics: ['nutrition', 'muscle'],
        connects_to: 'food_log',
        content: `# Protein

Protein is the macronutrient your body uses to build and repair muscle. Eat too
little and training gives you less than it should.

## How much

- **Not training:** 0.8g per kg of bodyweight
- **Training regularly:** 1.6–2.2g per kg
- **Losing weight:** stay at the top of that range — protein is what protects
  muscle while you're in a deficit

A 70kg person training four days a week wants roughly **110–150g a day**.

## Where it comes from

| Food | Typical serving | Protein |
|---|---|---|
| Paneer | 100g | 18g |
| Chicken breast | 100g | 31g |
| Eggs | 2 large | 12g |
| Curd | 1 katori (150g) | 5g |
| Toor dal, cooked | 1 katori (150g) | 6g |
| Soya chunks, dry | 50g | 26g |
| Whey isolate | 1 scoop | 24g |

## The part people get wrong

Dal is not a protein source in the way it feels like one. A katori gets you
about 6g. Two katoris with rice and a sabzi is a normal meal and lands near
12–15g total — a third of what a 70kg lifter needs in a day, from a full meal.

This is not a reason to eat less dal. It is a reason to add something: paneer,
eggs, curd, soya, or a scoop of whey. Vegetarian diets hit protein targets
fine, but not by accident.

**Spread it out.** Four meals of 30g beats one of 120g.`,
        questions: [
            {
                q: 'A 70kg person training four days a week should aim for roughly how much protein daily?',
                options: ['40–60g', '70–90g', '110–150g', '200–250g'],
                answer: '110–150g',
                explanation: "1.6–2.2g per kg is the range for people training regularly. For 70kg that's 112–154g. Below this you're leaving muscle on the table; far above it isn't harmful, just unnecessary.",
            },
            {
                q: 'One katori of cooked toor dal gives you about:',
                options: ['2g protein', '6g protein', '15g protein', '25g protein'],
                answer: '6g protein',
                explanation: "Dal feels like a protein food because it's a pulse, but cooked dal is mostly water. A katori is roughly 6g. It counts — it just won't carry your daily total alone.",
            },
            {
                q: "Why does protein matter more when you're eating in a deficit?",
                options: [
                    'It burns fat directly',
                    'It stops you feeling hungry entirely',
                    'It protects muscle while you lose weight',
                    'It speeds up your metabolism permanently',
                ],
                answer: 'It protects muscle while you lose weight',
                explanation: "In a deficit your body will break down tissue for energy. Enough protein plus resistance training biases that loss toward fat rather than muscle. It doesn't burn fat by itself.",
            },
            {
                q: 'Which of these is the most protein-dense per rupee for a vegetarian?',
                options: ['Curd', 'Milk', 'Soya chunks', 'Paneer'],
                answer: 'Soya chunks',
                explanation: 'Dry soya chunks are around 52g protein per 100g and among the cheapest sources available. Paneer is more protein-dense per serving but costs considerably more per gram of protein.',
            },
        ],
    },

    {
        title: 'What Actually Works',
        description: 'The short list worth paying for',
        topics: ['supplements', 'nutrition'],
        connects_to: null,
        content: `# Supplements worth buying

Most supplements do nothing. A few are well-studied and cheap. The gap between
those two groups is where most money gets wasted.

## Worth it

**Creatine monohydrate**
The most studied supplement in sport. Roughly 5–10% more strength over months
of training. 3–5g daily, every day, timing irrelevant. No loading phase needed.
Buy plain monohydrate — the flavoured, "micronised", "HCL" versions cost more
and do the same thing.

**Whey or plant protein**
Not magic. It is food in powder form, useful when hitting your protein target
from meals alone is inconvenient. Whey, casein and soy all work.

**Caffeine**
Real effect on performance and perceived effort. 3–6mg per kg, 30–60 minutes
before training. Two cups of coffee is roughly the low end of that.

## Situational

**Vitamin D** — worth testing before supplementing rather than guessing.
**Omega-3** — if you rarely eat fish. Flax and chia contribute, though the body
converts plant omega-3 to the useful forms inefficiently.

## Not worth it

BCAAs (redundant if you eat enough protein), fat burners, testosterone
boosters, mass gainers (sugar with a markup), glutamine.

**Sequence matters.** Supplements are the last 5%. Food, training and sleep are
the other 95%, and no powder compensates for missing them.`,
        questions: [
            {
                q: 'How much creatine monohydrate should you take daily?',
                options: ['1g', '3–5g', '20g with a loading week', '50g'],
                answer: '3–5g',
                explanation: "3–5g daily is the maintenance dose and it's all you need. Loading phases speed saturation by about two weeks but aren't necessary. Timing doesn't matter — take it whenever you'll remember.",
            },
            {
                q: 'Which of these has the strongest evidence behind it?',
                options: ['BCAAs', 'Fat burners', 'Creatine monohydrate', 'Testosterone boosters'],
                answer: 'Creatine monohydrate',
                explanation: "Creatine has hundreds of trials behind it. BCAAs are redundant if you're eating enough total protein, and the other two categories have essentially no support for their claims.",
            },
            {
                q: 'Protein powder is best described as:',
                options: [
                    'Essential for muscle growth',
                    'A convenient way to hit your protein target',
                    'More effective than food protein',
                    'Only useful right after training',
                ],
                answer: 'A convenient way to hit your protein target',
                explanation: "It's food in a convenient format. It has no properties whole-food protein lacks. If you're already hitting your target from meals, it adds nothing.",
            },
            {
                q: 'You have limited money for supplements. What should you buy first?',
                options: ['A mass gainer', 'BCAAs for during training', 'Creatine', 'A fat burner'],
                answer: 'Creatine',
                explanation: 'Creatine is the cheapest supplement with a real, repeatedly demonstrated effect. The other three range from redundant to useless.',
            },
        ],
    },

    {
        title: 'Understanding RPE',
        description: 'How hard a set actually was',
        topics: ['training'],
        connects_to: 'rir',
        content: `# RPE and reps in reserve

RPE is how hard a set felt, on a scale of 1–10. The useful way to think about
it is **reps in reserve** — how many more you could have done.

| RIR | RPE | What it felt like |
|---|---|---|
| 4+ | ≤6 | Comfortable, clearly had more |
| 3 | 7 | Working, three left |
| 2 | 8 | Hard, two left |
| 1 | 9 | Very hard, one left |
| 0 | 10 | Nothing left — form was breaking |

## Why bother

Fixed percentages of your max assume every day is the same. They aren't. RPE
adjusts to how you actually turned up — after bad sleep, 80% might feel like a
9 rather than a 7, and pushing anyway buys fatigue rather than progress.

## Where to sit

Most working sets belong at **RIR 1–3**. Training to failure on everything
costs more recovery than the extra stimulus is worth. Save RIR 0 for the last
set of an isolation exercise, if at all.

## Getting it right takes practice

Most people underestimate how many reps they have left. If you think you have
one left, you usually have two or three. This calibrates with experience.`,
        questions: [
            {
                q: 'RIR 2 means:',
                options: ['You did two reps', 'You could have done two more', 'Two sets remain', 'Rest two minutes'],
                answer: 'You could have done two more',
                explanation: 'Reps In Reserve counts what you left, not what you did. RIR 2 is a hard set where two more were available — roughly RPE 8.',
            },
            {
                q: 'Most working sets should sit at:',
                options: ['RIR 0, always to failure', 'RIR 1–3', 'RIR 5–6', "It doesn't matter"],
                answer: 'RIR 1–3',
                explanation: 'RIR 1–3 gets nearly all the stimulus at a fraction of the fatigue. Training everything to failure means worse performance on later sets and slower recovery between sessions.',
            },
            {
                q: 'Why use RPE instead of fixed percentages of your max?',
                options: [
                    "It's more precise",
                    'It adjusts to how you feel on the day',
                    "It's easier to calculate",
                    "Percentages don't work for beginners",
                ],
                answer: 'It adjusts to how you feel on the day',
                explanation: "Your true capacity moves daily with sleep, stress and food. A fixed percentage ignores that; RPE responds to it. It's less precise on paper and more accurate in practice.",
            },
            {
                q: 'Most people estimating their RIR tend to:',
                options: [
                    'Overestimate reps left',
                    'Underestimate reps left',
                    'Estimate accurately from the start',
                    'Not be able to learn it',
                ],
                answer: 'Underestimate reps left',
                explanation: 'Beginners commonly call a set RIR 1 when three were left. This is why early RPE-based training often under-stimulates — and why it calibrates with practice.',
            },
        ],
    },

    {
        title: 'Creating a Sustainable Deficit',
        description: "Losing fat without a diet you'll quit",
        topics: ['nutrition', 'fat-loss'],
        connects_to: 'nutrition_targets',
        content: `# A deficit you can actually hold

Fat loss requires eating less energy than you burn. Everything else — timing,
food choice, meal frequency — only matters insofar as it helps you hold that
deficit without misery.

## How big

**300–500 kcal below maintenance.** That's roughly 0.25–0.5kg a week.

Bigger deficits work faster and fail more often. They cost muscle, wreck
training quality, and end in the kind of week that undoes a fortnight.

## Where the calories usually hide

Not in the rice. In the cooking medium and the extras:

- A tablespoon of oil or ghee is **~120 kcal**, and a restaurant sabzi may carry
  three or four of them
- Chai with sugar, four times a day, is **200–300 kcal** before any food
- The same dal at home and at a restaurant can differ by **2×**, almost entirely
  from added fat

This is exactly why Fitzo asks how something was cooked. It is usually the
single biggest gap between what people log and what they ate.

## What makes it survivable

- **Protein and fibre stay high** — they keep you full at a lower calorie count
- **Don't ban foods, budget for them** — a portion of mithai inside your target
  costs nothing but the calories
- **Expect a stall around week 3–4** — this is normal, not failure

## Weight fluctuates for reasons that aren't fat

Salt, carbs and hormonal cycles move the scale by a kilo or more in a day. Judge
progress on a weekly average, never a single morning.`,
        questions: [
            {
                q: 'A sustainable weekly rate of fat loss is roughly:',
                options: ['0.1kg', '0.25–0.5kg', '1.5kg', '3kg'],
                answer: '0.25–0.5kg',
                explanation: '0.25–0.5kg a week comes from a 300–500 kcal daily deficit. Faster loss increasingly comes from muscle and water, and the required restriction is harder to sustain.',
            },
            {
                q: 'Where do unaccounted calories most often come from in home cooking?',
                options: ['Rice portions', 'Oil and ghee used in cooking', 'Vegetables', 'Spices'],
                answer: 'Oil and ghee used in cooking',
                explanation: "A tablespoon of any cooking fat is around 120 kcal and is easy to under-count because you don't serve it separately. The same dish can vary two-fold depending on how much went in.",
            },
            {
                q: 'The scale jumped 1kg overnight. The most likely cause is:',
                options: [
                    'You gained 1kg of fat',
                    'The scale is broken',
                    'Water, salt or food still in your system',
                    'Your metabolism stopped',
                ],
                answer: 'Water, salt or food still in your system',
                explanation: 'A kilo of fat is roughly 7,700 kcal — you cannot gain it overnight. Day-to-day swings are water, sodium and gut contents. Weekly averages are the signal.',
            },
            {
                q: 'Progress stalls in week 4 of a diet. The best first response is:',
                options: [
                    'Cut another 500 calories',
                    'Add an hour of daily cardio',
                    "Check your weekly average and how accurately you're logging",
                    'Stop dieting',
                ],
                answer: "Check your weekly average and how accurately you're logging",
                explanation: 'Stalls are usually measurement drift — portions creeping up, or untracked oil — rather than metabolism. Verify the deficit is still real before making it deeper.',
            },
        ],
    },

    {
        title: 'Energy Balance Equation',
        description: 'Why weight changes, and what actually moves it',
        topics: ['nutrition', 'fat-loss'],
        connects_to: 'nutrition_targets',
        content: `# Energy balance

Bodyweight follows one rule: energy in versus energy out. Eat more than you
burn and you gain, less and you lose. Everything else is detail about how
easily you hold that balance.

## What "out" is actually made of

- **BMR (~60–70%)** — what you burn existing. Breathing, organs, staying warm.
- **Daily movement (~15–30%)** — walking, stairs, fidgeting, standing. This is
  the part that quietly collapses when you're tired or busy.
- **Exercise (~5–10%)** — smaller than most people assume. An hour of lifting
  is often 250–350 kcal.
- **Digestion (~10%)** — protein costs the most to process.

## Why the gym is not where fat loss happens

An hour of training burns roughly what's in two parathas. That is not an
argument against training — it's the argument for why what you eat decides the
outcome and training decides what you keep while it happens.

## The measurement problem

Most people underestimate what they eat by 20–30%, and it isn't dishonesty. It
is the oil in the sabzi, the second roti, the chai between meals, the bite
while cooking. None of it feels like eating.

**This is the whole reason to log.** Not to obsess — to find out where the gap
between what you think you eat and what you eat actually sits.`,
        questions: [
            {
                q: 'Which component of daily energy expenditure is largest?',
                options: ['Exercise', 'Your resting metabolism', 'Digestion', 'Daily walking'],
                answer: 'Your resting metabolism',
                explanation: 'BMR is 60–70% of what you burn — the cost of simply being alive. Exercise is usually 5–10%, which is why training alone rarely drives fat loss.',
            },
            {
                q: 'Roughly how much does an hour of weight training burn?',
                options: ['100 kcal', '250–350 kcal', '700 kcal', '1,200 kcal'],
                answer: '250–350 kcal',
                explanation: 'Around 250–350 kcal for most people. It’s easy to eat that back in minutes, which is why the food side decides the result.',
            },
            {
                q: 'Most people underestimate their daily intake by about:',
                options: ['They usually overestimate', '5%', '20–30%', '60%'],
                answer: '20–30%',
                explanation: "Consistently 20–30%, and not through dishonesty. Cooking oil, drinks and small bites don't register as meals but carry real calories.",
            },
            {
                q: "You're eating in a deficit but not losing weight over three weeks. The most likely explanation is:",
                options: [
                    'Your metabolism has stopped',
                    'You need to eat more to lose weight',
                    "The deficit isn't as large as you think",
                    "You're gaining muscle at the same rate",
                ],
                answer: "The deficit isn't as large as you think",
                explanation: 'Almost always measurement drift — portions creeping up or untracked cooking fat. Metabolism adapts modestly, not enough to halt loss entirely.',
            },
        ],
    },

    {
        title: 'Carbohydrates & Performance',
        description: 'How carbs affect training, and how much you need',
        topics: ['nutrition', 'training'],
        connects_to: 'food_log',
        content: `# Carbs

Carbs are your body's preferred fuel for hard training. They are not fattening,
not optional, and not something to fear.

## What they do

Carbs become muscle glycogen — the fuel that powers a set of eight. Train with
low glycogen and you'll feel it: fewer reps, heavier weights feeling heavier,
sessions that drag.

## How much

Whatever's left after protein and fat are set. For most people training
regularly that lands at **3–5g per kg** — around 200–350g for a 70kg person.

Lower-carb diets work for fat loss if calories are controlled. They just tend
to make hard training feel worse.

## The rice question

Rice, roti, poha, idli, dosa — none of these are a problem. A cup of cooked
rice is roughly 200 kcal. It is a normal amount of food, not an indulgence.

What matters is total intake, not which grain it came from. Brown rice has more
fibre than white; that is the whole difference, and it is a small one.

## Timing

Mostly irrelevant, with one exception worth knowing: eating carbs an hour or
two before training gives you more to work with. Training fasted is fine if it
suits you, but expect slightly less in the tank.`,
        questions: [
            {
                q: 'The main role of carbohydrate in training is to:',
                options: ['Build muscle directly', 'Fuel hard sets', 'Prevent injury', 'Speed digestion'],
                answer: 'Fuel hard sets',
                explanation: 'Carbs become muscle glycogen, the fuel for high-effort work. Protein builds tissue; carbs power the session that triggers it.',
            },
            {
                q: 'For someone training regularly, a typical carb intake is:',
                options: ['Under 50g a day', '100g a day', '3–5g per kg of bodyweight', 'As much as possible'],
                answer: '3–5g per kg of bodyweight',
                explanation: '3–5g per kg is the common range — roughly 200–350g at 70kg. Carbs generally fill whatever calories remain after protein and fat are set.',
            },
            {
                q: 'Brown rice versus white rice:',
                options: [
                    'Brown has significantly fewer calories',
                    'White rice causes fat gain',
                    'Brown has more fibre; the difference is small',
                    'They’re nutritionally identical',
                ],
                answer: 'Brown has more fibre; the difference is small',
                explanation: 'Brown retains more fibre and micronutrients. Calorie content is nearly identical, and neither makes you gain fat on its own — total intake does.',
            },
            {
                q: 'When do carbs genuinely matter for timing?',
                options: [
                    'Only within 30 minutes after training',
                    'Only at breakfast',
                    'In the hours before hard training',
                    'Timing never matters at all',
                ],
                answer: 'In the hours before hard training',
                explanation: 'Eating carbs 1–2 hours before training means more available fuel. The old "anabolic window" after training is far less critical than once believed.',
            },
        ],
    },

    {
        title: 'Fats: The Essential Macro',
        description: 'Why you need fat, and where it hides',
        topics: ['nutrition'],
        connects_to: 'food_log',
        content: `# Fat

Fat is essential — hormone production, vitamin absorption, cell structure all
depend on it. It is also the densest source of calories you eat, at 9 kcal per
gram, which makes it the easiest thing to overshoot without noticing.

## How much

**0.8–1g per kg of bodyweight** as a floor. Going much below that for long
stretches can affect hormones. Above it is fine — it just uses calories that
could have gone to carbs.

## Where fat actually enters your day

Not usually where people look. It is mostly the cooking medium:

| | Approx. |
|---|---|
| 1 tbsp oil or ghee | 120 kcal |
| Handful of almonds (~15) | 100 kcal |
| 100g paneer | 20g fat |
| 2 tbsp coconut, grated | 70 kcal |

A sabzi made with one spoon of oil and the same sabzi made with four differ by
around **360 kcal** — same vegetables, same portion on the plate.

## Kinds of fat

Unsaturated fats — nuts, seeds, mustard oil, groundnut oil, fish — are the ones
to build around. Saturated fat (ghee, coconut, butter) is fine in normal
amounts; the evidence against it is weaker than the 1990s suggested, but it
isn't a reason to cook everything in it either.

**Omega-3** is the one most diets fall short on. Fatty fish is the best source.
Flax and chia contribute, though the body converts plant forms inefficiently —
if you don't eat fish, a supplement is reasonable.`,
        questions: [
            {
                q: 'Fat contains how many calories per gram?',
                options: ['4', '7', '9', '12'],
                answer: '9',
                explanation: "9 kcal per gram, versus 4 for protein and carbs. That density is why cooking oil moves a meal's total so sharply.",
            },
            {
                q: 'A minimum daily fat intake is around:',
                options: ['0.2g per kg', '0.8–1g per kg', '3g per kg', "There's no minimum"],
                answer: '0.8–1g per kg',
                explanation: '0.8–1g per kg supports hormone production and fat-soluble vitamin absorption. Sustained intake well below this can cause problems.',
            },
            {
                q: 'One tablespoon of cooking oil adds roughly:',
                options: ['20 kcal', '50 kcal', '120 kcal', '300 kcal'],
                answer: '120 kcal',
                explanation: "About 120 kcal — and it doesn't appear as a separate item on the plate, which is why it's the most commonly under-counted thing people eat.",
            },
            {
                q: 'Which fat do most diets fall short on?',
                options: ['Saturated fat', 'Omega-3', 'Trans fat', 'Total fat'],
                answer: 'Omega-3',
                explanation: 'Omega-3, particularly the EPA and DHA forms found in fatty fish. Plant sources like flax convert to those forms inefficiently, so a supplement is reasonable if you don’t eat fish.',
            },
        ],
    },

    {
        title: 'What to Skip',
        description: "What the evidence doesn't support",
        topics: ['supplements', 'nutrition'],
        connects_to: null,
        content: `# Supplements to skip

Not because they're dangerous — because they cost money and do nothing you
couldn't get elsewhere.

## BCAAs

The claim is muscle preservation and reduced soreness. The problem is that
BCAAs are three of the amino acids already in any complete protein. If you're
eating enough protein, you have them. If you aren't, fix the protein — BCAAs
won't cover the gap.

## Fat burners

Usually caffeine plus something unproven, sold at many times the price of
caffeine. Any real effect is the caffeine, which you can buy for a fraction of
the cost or get from coffee.

## Testosterone boosters

Tribulus, ashwagandha blends, "T-support" formulas. Ashwagandha has some
evidence for stress and sleep, which is worth knowing — but not for
meaningfully raising testosterone in healthy men. If you genuinely suspect low
testosterone, that's a blood test and a doctor, not a tub.

## Mass gainers

Sugar and maltodextrin with some protein, priced well above what the same
calories cost as food. If you struggle to eat enough, a banana-milk-peanut
butter shake does the same job for less.

## Glutamine, arginine, most "pre-workout blends"

Glutamine has failed to show benefit in healthy people repeatedly.
Pre-workouts vary — the caffeine works, the proprietary blend around it mostly
doesn't, and you rarely know the doses.

**The pattern:** if a supplement's marketing is about how it makes you feel
rather than what it measurably does, be sceptical.`,
        questions: [
            {
                q: 'Why are BCAAs usually unnecessary?',
                options: [
                    "They're unsafe",
                    "They're poorly absorbed",
                    'Complete protein sources already contain them',
                    'They only work for endurance athletes',
                ],
                answer: 'Complete protein sources already contain them',
                explanation: "BCAAs are three amino acids already present in whey, eggs, dairy and meat. If your total protein is adequate you're getting them; if it isn't, fixing total protein is the answer.",
            },
            {
                q: 'The active ingredient in most fat burners is:',
                options: [
                    'A proprietary fat-oxidising compound',
                    'Caffeine',
                    'Green tea extract',
                    'L-carnitine',
                ],
                answer: 'Caffeine',
                explanation: 'Nearly always caffeine, sold at a large markup. The other ingredients rarely have evidence behind them at the doses included.',
            },
            {
                q: 'Ashwagandha has reasonable evidence for:',
                options: [
                    'Substantially raising testosterone',
                    'Direct fat loss',
                    'Stress and sleep',
                    'Muscle growth',
                ],
                answer: 'Stress and sleep',
                explanation: "There's decent support for effects on stress and sleep quality. Claims about meaningfully raising testosterone in healthy men are much weaker.",
            },
            {
                q: 'You want to gain weight but struggle to eat enough. The better option is:',
                options: [
                    'A mass gainer supplement',
                    'Calorie-dense whole food like a milk and peanut butter shake',
                    'Eating only at night',
                    'Doubling your protein powder',
                ],
                answer: 'Calorie-dense whole food like a milk and peanut butter shake',
                explanation: 'Mass gainers are mostly sugar and maltodextrin at a premium. The same calories from food cost less and bring more with them.',
            },
        ],
    },

    {
        title: 'Metabolic Adaptation',
        description: "Why loss slows, and what's actually happening",
        topics: ['nutrition', 'fat-loss'],
        connects_to: null,
        content: `# Why fat loss slows down

Diets stall. Usually the explanation isn't metabolic — but some of it is real,
and knowing which part is which decides what you do next.

## What genuinely happens

**You get smaller.** A 90kg body costs more to run than an 80kg one. The
deficit that worked at the start is smaller now simply because maintenance
dropped.

**You move less without noticing.** This is the big one. In a deficit people
walk less, fidget less, take the lift. It can account for several hundred
calories a day and it happens below awareness.

**Adaptive thermogenesis.** Your body does become modestly more efficient. Real,
measurable, and much smaller than the internet claims — typically on the order
of 5–10%, not a shut-down.

## What doesn't happen

Your metabolism does not "stop". Starvation mode as popularly described isn't a
thing at normal dieting intensities. If the scale hasn't moved in a month, the
deficit almost certainly isn't there any more.

## What to do

1. **Check the logging first.** Portions drift. Oil goes untracked. Verify
   before you cut.
2. **Add steps rather than subtracting food.** Recovers the movement you lost
   without making the diet harder.
3. **Take a diet break.** One to two weeks at maintenance. Doesn't erase
   progress, and makes the next block easier to hold.
4. **Only then, cut further** — and by 100–200 kcal, not 500.`,
        questions: [
            {
                q: 'The largest real contributor to a fat-loss plateau is usually:',
                options: [
                    'Metabolic shutdown',
                    'Eating more than you think, plus moving less',
                    'Hormonal damage',
                    'Muscle gain offsetting fat loss',
                ],
                answer: 'Eating more than you think, plus moving less',
                explanation: 'Logging drift and unconscious reductions in daily movement account for most stalls. Genuine adaptation is real but far smaller than either.',
            },
            {
                q: 'Adaptive thermogenesis typically reduces energy expenditure by around:',
                options: ['0%', '5–10%', '30%', '50%'],
                answer: '5–10%',
                explanation: 'Modest and measurable, on the order of 5–10%. Enough to slow progress, nowhere near enough to stop weight loss in a genuine deficit.',
            },
            {
                q: "Your weight hasn't moved in four weeks. The best first step is:",
                options: [
                    'Cut 500 more calories',
                    'Add an hour of cardio daily',
                    'Audit how accurately you’re logging',
                    'Give up',
                ],
                answer: 'Audit how accurately you’re logging',
                explanation: 'Before making the diet harder, confirm the deficit still exists. Most stalls are measurement drift, and cutting further on bad data makes things worse.',
            },
            {
                q: 'A diet break means:',
                options: [
                    'Stopping all training',
                    'Eating whatever you want for a month',
                    'One to two weeks at maintenance calories',
                    'Switching to a different diet',
                ],
                answer: 'One to two weeks at maintenance calories',
                explanation: 'Eating at maintenance for one or two weeks. It restores some of the lost movement and adherence capacity without undoing progress.',
            },
        ],
    },
];

// ---------------------------------------------------------------------------
// GROUP 2 — existing content kept, one paragraph appended (4 lessons)
// These are the "anti-island" connections: each names a feature that exists,
// earned by the lesson's own subject rather than bolted on. The append is
// idempotent — re-running detects the marker and skips.
// ---------------------------------------------------------------------------

const APPEND = [
    {
        title: 'Progressive Overload',
        topics: ['training', 'muscle'],
        connects_to: 'volume',
        marker: 'Fitzo tracks total volume',
        appendix: `

## Seeing it in the app

Fitzo tracks total volume — weight × reps, summed. That number going up over
weeks is progressive overload, measured. If it's flat for a month, the training
is maintaining rather than building.`,
        questions: [
            {
                q: 'Progressive overload means:',
                options: [
                    'Training to failure every set',
                    'Gradually increasing the demand over time',
                    'Adding weight every session',
                    'Training more often',
                ],
                answer: 'Gradually increasing the demand over time',
                explanation: 'Increasing demand over time — more weight, more reps, more sets, or better control. Adding weight every single session works briefly for beginners and then stops.',
            },
            {
                q: 'Which is NOT a valid way to progress?',
                options: [
                    'More reps at the same weight',
                    'More weight at the same reps',
                    'Better control at the same load',
                    'Resting longer between sessions',
                ],
                answer: 'Resting longer between sessions',
                explanation: "Reps, load and quality all increase demand. Longer rest between sessions reduces frequency; it isn't overload.",
            },
            {
                q: 'A beginner can usually add weight:',
                options: ['Every set', 'Almost every session, early on', 'Once a year', 'Never'],
                answer: 'Almost every session, early on',
                explanation: 'Early adaptation is mostly neurological and fast, so beginners often progress session to session. That rate slows sharply after the first few months.',
            },
            {
                q: 'Your volume figure has been flat for a month. That means:',
                options: [
                    "You're overtraining",
                    'The training is maintaining rather than building',
                    'You need a new programme immediately',
                    'Your logging is broken',
                ],
                answer: 'The training is maintaining rather than building',
                explanation: "Flat volume means the stimulus isn't increasing, so neither is the adaptation. Maintenance is a legitimate goal — it just isn't growth.",
            },
        ],
    },

    {
        title: 'Training Volume',
        topics: ['training', 'muscle'],
        connects_to: 'volume',
        marker: '1 SIDE toggle',
        appendix: `

## Counting unilateral work

Counting sets for one side only undercounts unilateral work. A set of ten
single-arm rows on each arm is two working sets, not one. Fitzo's 1 SIDE toggle
handles this — reps are entered per side and the volume counts both.`,
        questions: [
            {
                q: 'Weekly volume for a muscle is best counted as:',
                options: [
                    'Total time in the gym',
                    'Hard sets per week',
                    'Number of exercises',
                    'Total weight lifted',
                ],
                answer: 'Hard sets per week',
                explanation: 'Hard sets per muscle per week is the most practical measure and the one most research uses. Total tonnage varies too much with exercise choice.',
            },
            {
                q: 'A commonly cited productive range is:',
                options: [
                    '2–4 sets per muscle per week',
                    '10–20 sets per muscle per week',
                    '40–50 sets per muscle per week',
                    'As many as possible',
                ],
                answer: '10–20 sets per muscle per week',
                explanation: 'Roughly 10–20 hard sets per muscle per week for most trainees. Below that under-stimulates; far above it usually outpaces recovery.',
            },
            {
                q: 'You do 10 reps of single-arm rows on each arm. That counts as:',
                options: ['One set', 'Two working sets', 'Half a set', 'It depends on the weight'],
                answer: 'Two working sets',
                explanation: 'Each arm did its own work. Counting it once undercounts the session — which is what the 1 SIDE toggle exists to correct.',
            },
            {
                q: 'More volume is:',
                options: [
                    'Always better',
                    'Always worse',
                    'Better up to a point, then limited by recovery',
                    'Irrelevant to growth',
                ],
                answer: 'Better up to a point, then limited by recovery',
                explanation: "Volume drives growth until recovery can't keep up, after which added sets cost more than they return. The ceiling is individual and moves with sleep, food and stress.",
            },
        ],
    },

    {
        title: 'Rest Between Sets',
        topics: ['training', 'recovery'],
        connects_to: 'rest_timer',
        marker: 'rest timer starts automatically',
        appendix: `

## Use the timer

The rest timer starts automatically when you complete a set. Guessing tends to
undershoot — most people rest less than they think.`,
        questions: [
            {
                q: 'For heavy compound lifts, rest should be roughly:',
                options: ['30 seconds', '1 minute', '2–5 minutes', '10 minutes'],
                answer: '2–5 minutes',
                explanation: 'Heavy compounds need 2–5 minutes for the phosphocreatine system to recover. Cutting rest short means the next set is limited by fatigue rather than by the muscle.',
            },
            {
                q: 'Shorter rest periods primarily cost you:',
                options: [
                    'Nothing',
                    'Performance on the following set',
                    'Muscle growth directly',
                    'Joint health',
                ],
                answer: 'Performance on the following set',
                explanation: "Insufficient rest reduces reps or load on the next set, which lowers total quality volume. That's the mechanism by which growth suffers — indirectly.",
            },
            {
                q: 'Isolation work like curls generally needs:',
                options: [
                    'The same rest as squats',
                    'Less rest, around 1–2 minutes',
                    'No rest',
                    'More rest than compounds',
                ],
                answer: 'Less rest, around 1–2 minutes',
                explanation: 'Smaller muscles and lower systemic demand recover faster, so 1–2 minutes usually suffices for isolation work.',
            },
            {
                q: 'Most people, when resting by feel, tend to:',
                options: [
                    'Rest too long',
                    'Rest less than they think',
                    'Judge it accurately',
                    'Vary randomly',
                ],
                answer: 'Rest less than they think',
                explanation: "Perceived rest runs short — what feels like two minutes is often seventy seconds. It's the main reason to use a timer rather than instinct.",
            },
        ],
    },

    {
        title: 'Cardio: LISS vs HIIT',
        topics: ['training', 'fat-loss'],
        connects_to: null,
        marker: 'daily walking beats both',
        appendix: `

## The under-rated option

For fat loss specifically, daily walking beats both for most people. It burns
meaningful calories, costs almost no recovery, and doesn't compete with
lifting. Ten thousand steps is roughly 300–400 kcal for most people, spread
across a day you were living anyway.`,
        questions: [
            {
                q: 'LISS stands for:',
                options: [
                    'Low-intensity steady state',
                    'Long interval sprint session',
                    'Light impact strength system',
                    'Low intensity split session',
                ],
                answer: 'Low-intensity steady state',
                explanation: 'Low-Intensity Steady State — walking, cycling, easy work held at a conversational pace.',
            },
            {
                q: 'Compared with LISS, HIIT:',
                options: [
                    'Burns far more total calories',
                    'Burns similar calories in less time but costs more recovery',
                    'Has no benefits',
                    'Is always better for fat loss',
                ],
                answer: 'Burns similar calories in less time but costs more recovery',
                explanation: 'HIIT is time-efficient but demanding. That recovery cost competes directly with lifting, which matters if muscle retention is the goal.',
            },
            {
                q: 'For fat loss with minimal interference to lifting, the most practical tool is:',
                options: ['Daily sprints', 'Walking', 'Long-distance running', 'Circuit training to failure'],
                answer: 'Walking',
                explanation: 'Walking burns meaningful energy at almost no recovery cost, so it adds to the deficit without degrading training quality.',
            },
            {
                q: 'Roughly how much does 10,000 steps burn for most people?',
                options: ['100 kcal', '300–400 kcal', '800 kcal', '1,500 kcal'],
                answer: '300–400 kcal',
                explanation: 'Around 300–400 kcal depending on bodyweight and pace — a meaningful contribution accumulated across an ordinary day.',
            },
        ],
    },
];

// ---------------------------------------------------------------------------
// GROUP 3 — questions only (9 lessons)
// Content is already accurate and location-neutral. Group B's three
// "no change of substance" lessons plus all six of Group C. Their bodies are
// left exactly as they are in the database.
// ---------------------------------------------------------------------------

const QUESTIONS_ONLY = [
    {
        title: 'Hypertrophy 101',
        questions: [
            {
                q: 'The primary driver of muscle growth is:',
                options: ['Mechanical tension', 'Muscle soreness', 'Sweating', 'Training duration'],
                answer: 'Mechanical tension',
                explanation: 'Mechanical tension — hard contractions against meaningful resistance. Soreness and fatigue accompany training but neither causes growth.',
            },
            {
                q: 'Soreness after a session indicates:',
                options: [
                    'A good workout',
                    'Muscle growth',
                    'Unfamiliar or unusually demanding work',
                    'Correct technique',
                ],
                answer: 'Unfamiliar or unusually demanding work',
                explanation: 'Soreness reflects novelty and eccentric stress, not effectiveness. Well-trained lifters often grow with very little soreness.',
            },
            {
                q: 'Muscle is built:',
                options: [
                    'During the set',
                    'During recovery between sessions',
                    'Only while asleep',
                    'Immediately after training',
                ],
                answer: 'During recovery between sessions',
                explanation: "Training is the signal; the building happens during recovery, given adequate protein and sleep. This is why rest days aren't lost days.",
            },
            {
                q: 'For growth, training a muscle twice a week versus once, with volume equal:',
                options: [
                    'Once is clearly better',
                    'Twice is generally slightly better or equal',
                    "Frequency doesn't matter at all",
                    'Once a week is optimal for everyone',
                ],
                answer: 'Twice is generally slightly better or equal',
                explanation: 'With volume matched, higher frequency is equal or modestly better, largely because quality holds up better across two sessions than one long one.',
            },
        ],
    },

    {
        title: 'Rep Ranges Explained',
        questions: [
            {
                q: 'For hypertrophy, the most productive range is generally:',
                options: ['1–3 reps', '6–15 reps', '30–40 reps', 'Only 10 reps'],
                answer: '6–15 reps',
                explanation: '6–15 reps balances tension and total work well. Growth happens across a wider span than this, but this range is the most practical.',
            },
            {
                q: 'Low reps with heavy load primarily build:',
                options: ['Endurance', 'Maximal strength', 'Flexibility', 'Only size'],
                answer: 'Maximal strength',
                explanation: '1–5 reps at high load mostly develops neural efficiency and maximal strength. Size gains occur but less efficiently per unit of fatigue.',
            },
            {
                q: 'Sets of 20–30 reps:',
                options: [
                    'Are useless for growth',
                    'Can build muscle if taken close to failure',
                    'Are better than all other ranges',
                    'Only build endurance',
                ],
                answer: 'Can build muscle if taken close to failure',
                explanation: "High-rep sets grow muscle provided effort is high — they simply need to be taken nearer failure, and they're more uncomfortable.",
            },
            {
                q: 'The most important factor across any rep range is:',
                options: [
                    'The exact number of reps',
                    'Getting close enough to failure',
                    'The tempo',
                    'The exercise order',
                ],
                answer: 'Getting close enough to failure',
                explanation: 'Proximity to failure determines whether a set is stimulating. Rep range shifts the emphasis; effort decides whether it counts.',
            },
        ],
    },

    {
        title: 'Mind-Muscle Connection',
        questions: [
            {
                q: 'Mind-muscle connection means:',
                options: [
                    'Visualising your goals',
                    'Deliberately focusing on the working muscle',
                    'Training without music',
                    'Meditating before lifting',
                ],
                answer: 'Deliberately focusing on the working muscle',
                explanation: 'Consciously attending to the muscle you intend to work, which measurably increases its activation during a set.',
            },
            {
                q: 'The effect is most useful on:',
                options: ['Heavy deadlifts', 'Isolation exercises', 'Sprinting', 'Warm-up sets'],
                answer: 'Isolation exercises',
                explanation: 'Isolation work benefits most. On heavy compounds, focusing on moving the weight well generally produces a better outcome.',
            },
            {
                q: 'On heavy compound lifts, you should focus on:',
                options: [
                    'Squeezing each individual muscle',
                    'Moving the weight efficiently',
                    'Closing your eyes',
                    'Slowing every rep down',
                ],
                answer: 'Moving the weight efficiently',
                explanation: 'Under heavy load, external focus on the movement produces better performance than internal focus on individual muscles.',
            },
            {
                q: 'Mind-muscle connection primarily improves:',
                options: [
                    'Maximum strength',
                    'Activation of the target muscle',
                    'Cardiovascular fitness',
                    'Recovery speed',
                ],
                answer: 'Activation of the target muscle',
                explanation: 'It increases how much the intended muscle contributes to a lift. Useful for growth, largely irrelevant for maximal strength.',
            },
        ],
    },

    {
        title: 'Sleep: The Natural Steroid',
        questions: [
            {
                q: 'Adults should target how much sleep?',
                options: ['4–5 hours', '6 hours', '7–9 hours', '12 hours'],
                answer: '7–9 hours',
                explanation: '7–9 hours for most adults. Below that, training performance, appetite regulation and recovery all measurably degrade.',
            },
            {
                q: 'Poor sleep most directly affects:',
                options: [
                    'Only mood',
                    'Recovery, appetite and training performance',
                    'Nothing measurable',
                    'Only cardiovascular fitness',
                ],
                answer: 'Recovery, appetite and training performance',
                explanation: 'Short sleep raises hunger signalling, lowers training output, and slows recovery — it works against every goal at once.',
            },
            {
                q: 'The most effective single sleep habit is:',
                options: [
                    'A supplement',
                    'A consistent sleep and wake time',
                    'Sleeping in at weekends',
                    'A darker room',
                ],
                answer: 'A consistent sleep and wake time',
                explanation: 'Consistency anchors your circadian rhythm, which improves both how fast you fall asleep and the quality of what follows.',
            },
            {
                q: 'In a deficit, poor sleep tends to:',
                options: [
                    'Have no effect',
                    'Increase hunger and reduce adherence',
                    'Speed fat loss',
                    'Only affect strength',
                ],
                answer: 'Increase hunger and reduce adherence',
                explanation: 'Sleep loss raises appetite signalling and lowers impulse control, which makes an already-hard deficit considerably harder to hold.',
            },
        ],
    },

    {
        title: 'Active Recovery',
        questions: [
            {
                q: 'Active recovery means:',
                options: [
                    'Complete rest',
                    'Light movement on non-training days',
                    'Training at 50% weight',
                    'Stretching only',
                ],
                answer: 'Light movement on non-training days',
                explanation: 'Easy movement — walking, light cycling, mobility — that promotes blood flow without adding meaningful fatigue.',
            },
            {
                q: 'Its main benefit is:',
                options: [
                    'Building muscle',
                    'Burning significant calories',
                    'Reducing stiffness and maintaining movement',
                    'Replacing a training session',
                ],
                answer: 'Reducing stiffness and maintaining movement',
                explanation: "It keeps you moving and eases soreness. It doesn't build muscle and shouldn't be treated as a substitute for training.",
            },
            {
                q: 'On a rest day you should:',
                options: [
                    'Do nothing at all',
                    'Train anyway',
                    'Move normally; light activity is fine',
                    'Do a full cardio session',
                ],
                answer: 'Move normally; light activity is fine',
                explanation: 'Rest days mean no hard training, not immobility. Ordinary daily movement supports recovery rather than hindering it.',
            },
            {
                q: 'Stretching immediately before heavy lifting:',
                options: [
                    'Is essential',
                    'Can slightly reduce force output if held long',
                    'Prevents all injury',
                    'Should always last 20 minutes',
                ],
                answer: 'Can slightly reduce force output if held long',
                explanation: 'Long static holds before lifting can modestly reduce strength. Dynamic warm-ups are the better choice pre-session; save static work for after.',
            },
        ],
    },

    {
        title: 'Building Unbreakable Habits',
        questions: [
            {
                q: 'The most reliable predictor of long-term results is:',
                options: ['Training intensity', 'Supplement use', 'Consistency over time', 'Programme design'],
                answer: 'Consistency over time',
                explanation: 'An average programme followed for two years beats an optimal one abandoned in six weeks. Consistency compounds; nothing else does.',
            },
            {
                q: 'When starting a new habit, you should:',
                options: [
                    'Change everything at once',
                    'Start smaller than feels necessary',
                    'Rely on motivation',
                    'Set the hardest possible target',
                ],
                answer: 'Start smaller than feels necessary',
                explanation: 'Small starts survive bad weeks. Ambitious ones depend on motivation, which is exactly what disappears when life gets busy.',
            },
            {
                q: 'You miss a week of training. The best response is:',
                options: [
                    'Start over from scratch',
                    'Train twice as hard to catch up',
                    'Resume where you left off',
                    'Abandon the programme',
                ],
                answer: 'Resume where you left off',
                explanation: 'A missed week costs very little. Trying to compensate usually causes soreness or injury, which costs another week.',
            },
            {
                q: 'Motivation is best understood as:',
                options: [
                    'The foundation of consistency',
                    'Unreliable, so systems matter more',
                    "Something you either have or don't",
                    'Increased by supplements',
                ],
                answer: 'Unreliable, so systems matter more',
                explanation: "Motivation fluctuates. Habits, fixed times and low friction keep training happening on the days motivation doesn't show up.",
            },
        ],
    },

    {
        title: 'Dealing with Plateaus',
        questions: [
            {
                q: 'A genuine strength plateau means:',
                options: [
                    'One bad session',
                    'No progress across several weeks',
                    'Missing a personal best once',
                    'Feeling tired',
                ],
                answer: 'No progress across several weeks',
                explanation: 'Single sessions vary with sleep, food and stress. A plateau is a trend across weeks, not a bad Tuesday.',
            },
            {
                q: 'The first thing to check when progress stalls is:',
                options: ['Your programme', 'Your supplements', 'Sleep, food and stress', 'Your genetics'],
                answer: 'Sleep, food and stress',
                explanation: "Recovery inputs explain most stalls. Changing the programme while under-eating and under-sleeping just changes what isn't working.",
            },
            {
                q: 'Deloading during a plateau:',
                options: [
                    'Wastes time',
                    'Often allows progress to resume',
                    'Only helps beginners',
                    'Should last a month',
                ],
                answer: 'Often allows progress to resume',
                explanation: 'Accumulated fatigue can mask fitness. A lighter week lets that dissipate, and performance frequently rebounds above the previous level.',
            },
            {
                q: 'Changing your entire programme at the first stall is:',
                options: ['Always correct', 'Usually premature', 'The only solution', 'Necessary monthly'],
                answer: 'Usually premature',
                explanation: 'Programmes need time to work. Switching constantly means never accumulating enough consistent stimulus to progress from.',
            },
        ],
    },

    {
        title: 'Periodization Basics',
        questions: [
            {
                q: 'Periodisation means:',
                options: [
                    'Training the same way permanently',
                    'Structuring training into phases over time',
                    'Only training in season',
                    'Changing exercises weekly',
                ],
                answer: 'Structuring training into phases over time',
                explanation: 'Organising training into blocks with different emphases so that stress and recovery are planned rather than accidental.',
            },
            {
                q: 'Its main purpose is:',
                options: [
                    'Variety for its own sake',
                    'Managing fatigue while progressing',
                    'Reducing training time',
                    'Preventing boredom',
                ],
                answer: 'Managing fatigue while progressing',
                explanation: "It lets you push hard in some phases and recover in others, so fatigue doesn't accumulate to the point of stalling progress.",
            },
            {
                q: 'A beginner should:',
                options: [
                    'Follow an elaborate periodised plan',
                    'Focus on consistent progression first',
                    'Change phases weekly',
                    'Avoid structure entirely',
                ],
                answer: 'Focus on consistent progression first',
                explanation: 'Beginners progress on almost any consistent stimulus. Periodisation matters once straightforward progression stops working.',
            },
            {
                q: 'A typical training block runs:',
                options: ['3 days', '1 week', '4–8 weeks', '2 years'],
                answer: '4–8 weeks',
                explanation: 'Four to eight weeks is long enough to adapt to an emphasis and short enough to change before fatigue dominates.',
            },
        ],
    },

    {
        title: 'Deload Weeks',
        questions: [
            {
                q: 'A deload week means:',
                options: [
                    'Stopping training entirely',
                    'Reduced volume or intensity for a week',
                    'Training harder than usual',
                    'Only doing cardio',
                ],
                answer: 'Reduced volume or intensity for a week',
                explanation: 'Typically cutting volume roughly in half, or reducing load, while continuing to train. The aim is dissipating fatigue without losing the habit.',
            },
            {
                q: 'Deloads are typically taken:',
                options: [
                    'Daily',
                    'Every 4–8 weeks, or when performance stalls',
                    'Once a year',
                    'Never',
                ],
                answer: 'Every 4–8 weeks, or when performance stalls',
                explanation: 'Either scheduled every 4–8 weeks, or triggered by stalling performance, persistent soreness or poor sleep.',
            },
            {
                q: 'During a deload you should expect:',
                options: [
                    'To lose significant muscle',
                    'To lose all your strength',
                    'To keep your gains and feel fresher',
                    'To gain fat rapidly',
                ],
                answer: 'To keep your gains and feel fresher',
                explanation: "A week of reduced training doesn't cost muscle. Performance usually returns higher because accumulated fatigue was masking fitness.",
            },
            {
                q: 'The clearest sign you need a deload is:',
                options: [
                    'One tough session',
                    'Feeling bored',
                    'Performance dropping while effort rises',
                    'Gaining weight',
                ],
                answer: 'Performance dropping while effort rises',
                explanation: 'Working harder for less output is the classic signature of accumulated fatigue — and the point at which pushing further stops helping.',
            },
        ],
    },
];

// ---------------------------------------------------------------------------
// GROUP 4 — new lessons (8)
// Slotted into existing units. "Your First Month" takes order_index 0 so it
// sorts ahead of Progressive Overload in Training Essentials, where a beginner
// lesson belongs.
// ---------------------------------------------------------------------------

const NEW = [
    {
        title: 'Hitting Protein Without Meat',
        unit: 1,
        unit_title: 'Nutrition Fundamentals',
        order_index: 5,
        description: 'The vegetarian protein problem, and how to solve it',
        topics: ['nutrition', 'muscle'],
        connects_to: 'food_log',
        xp_reward: 50,
        content: `# Protein without meat

Vegetarian diets hit protein targets fine. They just don't do it by accident,
because the foods that feel like protein here mostly aren't dense in it.

## The gap

A 70kg person training needs roughly 110–150g a day. A typical vegetarian day —
poha, dal-rice-sabzi, chai, roti-sabzi — lands around 40–50g. That is not a
small shortfall.

## What actually moves the number

| Food | Serving | Protein |
|---|---|---|
| Soya chunks (dry) | 50g | 26g |
| Paneer | 100g | 18g |
| Whey isolate | 1 scoop | 24g |
| Greek yoghurt | 150g | 15g |
| Rajma / chana, cooked | 1 katori | 8g |
| Eggs, if you eat them | 2 | 12g |
| Tofu | 100g | 12g |
| Milk | 250ml | 8g |
| Toor dal, cooked | 1 katori | 6g |

## The practical version

You don't need to redesign your meals. You need to add one protein anchor to
each of them:

- **Breakfast:** eggs, or milk with your poha, or a scoop in water
- **Lunch:** paneer or curd alongside the dal, not instead of it
- **Dinner:** soya, rajma, chana, or paneer as the main sabzi
- **Anywhere:** a glass of milk is 8g for very little effort

Four anchors of 20–25g plus what your base meals already provide gets you there.

## On completeness

You may have read that plant proteins are "incomplete". True per food, largely
irrelevant in practice — eating varied protein across a day covers the full
amino acid profile. Dal and rice together is the classic example, and you were
probably eating that anyway.

**Soya is the exception worth knowing:** it is a complete protein on its own,
and the cheapest gram-for-gram source available.`,
        questions: [
            {
                q: 'A typical vegetarian day without planning provides roughly:',
                options: ['10–20g protein', '40–50g protein', '90–100g protein', '150g protein'],
                answer: '40–50g protein',
                explanation: "Around 40–50g from poha, dal, roti and sabzi. That's well short of the 110–150g a 70kg person training needs — the gap has to be filled deliberately.",
            },
            {
                q: 'The cheapest dense protein source available is:',
                options: ['Paneer', 'Whey isolate', 'Soya chunks', 'Almonds'],
                answer: 'Soya chunks',
                explanation: "Dry soya chunks are roughly 52g protein per 100g and cost far less per gram of protein than paneer or whey. They're also a complete protein.",
            },
            {
                q: '"Plant proteins are incomplete" matters:',
                options: [
                    'A great deal — you must combine at every meal',
                    'Very little, if your protein sources vary across the day',
                    'Only for athletes',
                    'Not at all, ever',
                ],
                answer: 'Very little, if your protein sources vary across the day',
                explanation: "Individual plant foods can be low in specific amino acids, but eating varied sources across a day covers the profile. Combining within a single meal isn't required.",
            },
            {
                q: 'The most practical way to close the gap is:',
                options: [
                    'Replace dal with meat',
                    'Eat twice as much of everything',
                    'Add one protein anchor to each meal',
                    'Take BCAAs',
                ],
                answer: 'Add one protein anchor to each meal',
                explanation: 'Four additions of 20–25g each — paneer, eggs, soya, curd or a scoop — reaches the target without restructuring how you eat.',
            },
        ],
    },

    {
        title: 'Eating Out Without Losing the Plot',
        unit: 1,
        unit_title: 'Nutrition Fundamentals',
        order_index: 6,
        description: "Restaurants, weddings, and the meals you didn't cook",
        topics: ['nutrition', 'fat-loss'],
        connects_to: 'food_log',
        xp_reward: 50,
        content: `# Eating out

Most diets don't fail at home. They fail at the meals you didn't cook, where
you don't know what went in and don't want to make it weird.

## Why restaurant food is different

Not the ingredients — the fat. Restaurant cooking uses considerably more oil,
butter and cream than home cooking, because that is what makes it taste like
that. The same paneer sabzi can carry two to three times the calories of the
version at home, with identical vegetables and an identical-looking portion.

**This is exactly what Fitzo's cooking-medium option is for.** Logging a
restaurant dish as "restaurant" rather than "as listed" is usually the single
biggest accuracy gain available.

## What actually works

**Decide before you arrive.** Choosing while hungry and surrounded by options
goes badly.

**Anchor on protein.** Tandoori and grilled items, dal, curd, eggs, paneer
tikka. Get that on the table and the rest matters less.

**Gravies are where the calories live.** Dry and tandoori preparations are
usually far lighter than anything in a rich gravy — with no loss of protein.

**Drinks count.** A large soft drink or a sweet lassi can be 250–350 kcal that
you won't remember eating.

## The bigger picture

One meal doesn't matter. Eating out four times a week without adjusting does.

If you know a heavy meal is coming, eat a little lighter earlier that day —
not to "make room" in a moral sense, just because your target is daily, not
per-meal.

**Don't skip the meal or eat before you go.** Turning up starving to a
restaurant reliably produces a worse outcome than turning up fed.`,
        questions: [
            {
                q: 'Restaurant food usually carries more calories than home cooking because of:',
                options: ['Larger vegetables', 'More salt', 'More oil, butter and cream', 'Different spices'],
                answer: 'More oil, butter and cream',
                explanation: "The ingredients are similar; the cooking fat isn't. That's what produces the taste, and it can double or triple a dish's calories at the same portion size.",
            },
            {
                q: 'For lower calories with the same protein, choose:',
                options: [
                    'A rich gravy dish',
                    'A tandoori or dry preparation',
                    'Anything labelled "healthy"',
                    'A larger portion of rice',
                ],
                answer: 'A tandoori or dry preparation',
                explanation: "Gravies carry the fat. Tandoori and dry preparations deliver the same protein with substantially less.",
            },
            {
                q: 'Before a meal out, the best approach is:',
                options: [
                    'Skip breakfast and lunch',
                    'Eat a full meal beforehand',
                    'Eat slightly lighter earlier and arrive fed, not starving',
                    'Nothing different',
                ],
                answer: 'Eat slightly lighter earlier and arrive fed, not starving',
                explanation: 'Your target is daily, so adjusting earlier makes sense. Arriving starving reliably produces worse choices than arriving comfortable.',
            },
            {
                q: 'When logging a restaurant dish, the most useful thing you can do is:',
                options: [
                    'Guess the portion precisely',
                    'Log it as a home-cooked version',
                    'Select the restaurant cooking option',
                    'Skip logging it',
                ],
                answer: 'Select the restaurant cooking option',
                explanation: 'The cooking medium is the largest single variable between a home and restaurant version of the same dish. Selecting it is the biggest available accuracy gain.',
            },
        ],
    },

    {
        title: 'Alcohol and Training',
        unit: 1,
        unit_title: 'Nutrition Fundamentals',
        order_index: 7,
        description: 'What it actually costs, without the lecture',
        topics: ['nutrition', 'recovery'],
        connects_to: null,
        xp_reward: 50,
        content: `# Alcohol

Not a moral question. Alcohol has specific, measurable effects, and knowing
them lets you decide what you're willing to trade.

## The calories

7 kcal per gram — closer to fat than to carbs, and they bring nothing with
them. No protein, no meaningful micronutrients.

| | Approx. |
|---|---|
| A beer (330ml) | 150 kcal |
| A large beer (650ml) | 300 kcal |
| A peg of spirits (30ml) | 70 kcal |
| A glass of wine | 125 kcal |
| A cocktail | 250–400 kcal |

Four drinks is often 600–800 kcal, which is most of a day's deficit.

## The other effects

**Sleep.** Alcohol makes you fall asleep faster and sleep considerably worse.
The deep sleep where most recovery happens is what it suppresses. This is
probably the biggest cost.

**Protein synthesis** is reduced for roughly a day after significant drinking.

**Next-day training** is worse — partly dehydration, partly poor sleep, partly
that you don't feel like it.

**Judgement about food** while drinking and the following day is consistently
worse.

## The practical version

You can drink and still make progress. The reasonable version:

- Keep it occasional rather than routine
- Eat protein before, not instead
- Water between drinks
- Don't schedule a hard session the next morning
- Log it, honestly — this is the most commonly omitted thing in any food diary

**The stack is what does the damage,** not the drink itself: calories, plus bad
sleep, plus a poor food day after, plus a skipped session.`,
        questions: [
            {
                q: 'Alcohol provides how many calories per gram?',
                options: ['4', '7', '9', '0'],
                answer: '7',
                explanation: '7 kcal per gram, between carbohydrate and fat — with no protein, vitamins or minerals accompanying them.',
            },
            {
                q: "Alcohol's most significant effect on training is probably:",
                options: [
                    'Direct muscle loss',
                    'Dehydration alone',
                    'Disrupted sleep quality',
                    'Reduced flexibility',
                ],
                answer: 'Disrupted sleep quality',
                explanation: 'It reduces deep sleep, which is when most recovery happens. That compounds across performance, appetite regulation and next-day training.',
            },
            {
                q: 'Four drinks typically costs:',
                options: ['100 kcal', '300 kcal', '600–800 kcal', '2,000 kcal'],
                answer: '600–800 kcal',
                explanation: 'Usually 600–800 kcal depending on what you drink — often most or all of a day’s deficit, before any food eaten alongside.',
            },
            {
                q: 'The biggest problem with drinking while dieting is:',
                options: [
                    'The alcohol itself',
                    'The combination of calories, poor sleep and a worse next day',
                    'Losing muscle immediately',
                    'It stops fat burning permanently',
                ],
                answer: 'The combination of calories, poor sleep and a worse next day',
                explanation: 'No single effect is severe. The stack — liquid calories, degraded sleep, poorer food choices after, and a skipped session — is what accumulates.',
            },
        ],
    },

    {
        title: 'Your First Month',
        unit: 2,
        unit_title: 'Training Essentials',
        order_index: 0,
        description: 'What to actually do when you start',
        topics: ['training', 'mindset'],
        connects_to: null,
        xp_reward: 50,
        content: `# Your first month

The first month decides whether there's a second one. The goal is not results.
It is building the habit of turning up.

## What to do

**Train three days a week.** Not six. Three sessions you complete beats six you
abandon in week two.

**Full body each session.** As a beginner every muscle recovers fast enough to
train three times weekly, and you'll practise each movement more often — which
is what actually drives early progress.

**Six to eight exercises, that's all:**

- A squat or leg press
- A hinge (Romanian deadlift, back extension)
- A push (bench, dumbbell press)
- A pull (row, lat pulldown)
- A shoulder press
- Something for arms, if you want it

**Two to three sets each, 8–12 reps, stopping two or three reps short of
failure.**

## What to expect

**Weeks 1–2:** Everything feels awkward. You'll be sore. Weights will feel
heavy that later feel light. This is normal and temporary.

**Weeks 3–4:** Movements start feeling like movements rather than puzzles. The
weight goes up almost every session — that's your nervous system learning, not
muscle yet.

**Visible change:** two to three months, honestly. Anyone promising faster is
selling something.

## What not to do

- Don't train to failure on everything. You'll be too sore to return.
- Don't add exercises because you saw them online. Six is enough.
- Don't change programmes. Consistency is the entire variable right now.
- Don't buy supplements yet. Sort food and sleep first.

**The only measure that matters this month is whether you showed up.**`,
        questions: [
            {
                q: 'A beginner should train roughly:',
                options: ['Every day', 'Six days a week', 'Three days a week', 'Once a week'],
                answer: 'Three days a week',
                explanation: 'Three full-body sessions provide plenty of stimulus for a beginner, allow recovery, and are far more likely to survive a busy week than six.',
            },
            {
                q: 'Full-body training suits beginners because:',
                options: [
                    'It burns more calories',
                    "It's faster",
                    'You practise each movement more often',
                    "Splits don't work",
                ],
                answer: 'You practise each movement more often',
                explanation: 'Early progress is largely skill acquisition. Squatting three times a week teaches you to squat considerably faster than doing it once.',
            },
            {
                q: 'Visible physical change typically takes:',
                options: ['One week', 'Two weeks', 'Two to three months', 'Two years'],
                answer: 'Two to three months',
                explanation: "Strength climbs quickly in the first month, but that's neural. Visible composition change generally needs two to three consistent months.",
            },
            {
                q: 'In your first month, the most important thing is:',
                options: [
                    'Lifting as heavy as possible',
                    'Trying many exercises',
                    'Turning up consistently',
                    'Buying the right supplements',
                ],
                answer: 'Turning up consistently',
                explanation: 'Everything else is downstream of consistency. A modest programme done reliably beats an optimal one abandoned in week three.',
            },
        ],
    },

    {
        title: 'Warming Up',
        unit: 2,
        unit_title: 'Training Essentials',
        order_index: 5,
        description: "What a warm-up is for, and what it isn't",
        topics: ['training'],
        connects_to: null,
        xp_reward: 50,
        content: `# Warming up

A warm-up prepares you for the work. It is not a workout, and it is not
stretching for twenty minutes.

## What it does

Raises muscle temperature, gets joints moving through range, and lets your
nervous system rehearse the movement before it matters. Practically: your first
work set feels like your third.

## What it looks like

**Five minutes of general movement.** Walking, cycling, skipping — anything
that raises your heart rate slightly.

**Then ramp the specific lift.** For a working set of 60kg:

- Empty bar × 10
- 30kg × 5
- 45kg × 3
- 55kg × 1
- 60kg — first working set

Each set is easy. The point is rehearsal, not fatigue.

**For isolation work,** one light set is usually enough.

## What to skip

**Long static stretching before lifting.** Holding a stretch for 30+ seconds
can slightly reduce force output for a while afterward. Save it for after, or
for its own session.

**A warm-up that tires you.** If you're breathing hard before your first work
set, it was a workout.

## The honest bit

Warm-ups are more useful the heavier you lift and the older you get. If you're
doing three sets of dumbbell curls, five minutes of movement and a light set
covers it. Nobody needs a twenty-minute mobility routine before a bicep session.`,
        questions: [
            {
                q: 'The main purpose of a warm-up is:',
                options: [
                    'Burning extra calories',
                    'Stretching your muscles',
                    'Preparing you to perform the work well',
                    'Preventing all injury',
                ],
                answer: 'Preparing you to perform the work well',
                explanation: 'It raises tissue temperature and rehearses the movement so your first working set performs like a later one. Injury prevention claims are weaker than commonly stated.',
            },
            {
                q: 'Long static stretching immediately before lifting:',
                options: [
                    'Is essential',
                    'Can slightly reduce force output',
                    'Increases strength',
                    'Has no effect at all',
                ],
                answer: 'Can slightly reduce force output',
                explanation: 'Holds beyond about 30 seconds can temporarily reduce force production. Dynamic movement beforehand, static work afterward.',
            },
            {
                q: 'Warming up for a working set of 60kg should involve:',
                options: [
                    'Going straight to 60kg',
                    'One set at 59kg',
                    'Progressively lighter sets ramping up to it',
                    'Twenty minutes of cardio',
                ],
                answer: 'Progressively lighter sets ramping up to it',
                explanation: 'Ramping — empty bar, then progressively heavier easy sets — prepares the movement pattern without accumulating fatigue.',
            },
            {
                q: "If you're breathing hard before your first work set:",
                options: [
                    'The warm-up was ideal',
                    'The warm-up was too much',
                    'You need more warm-up',
                    "You're unfit",
                ],
                answer: 'The warm-up was too much',
                explanation: 'A warm-up should leave you ready, not tired. Fatigue spent there is performance removed from the sets that count.',
            },
        ],
    },

    {
        title: 'When Something Hurts',
        unit: 6,
        unit_title: 'Sleep & Recovery',
        order_index: 3,
        description: 'Telling soreness from injury, and what to do',
        topics: ['training', 'recovery'],
        connects_to: null,
        xp_reward: 50,
        content: `# When something hurts

Some discomfort is normal. Some isn't. Knowing which is which is the difference
between training around something and making it worse.

## Normal

**Muscle soreness.** Dull, spread across the muscle belly, worst 24–48 hours
after, eases as you move. Common after new exercises or more volume than usual.
It is not a measure of how good the session was.

**Working discomfort.** The burn during a hard set. Uncomfortable, immediate,
gone when you rack the weight.

## Not normal

- **Sharp pain**, particularly at a joint
- Pain that is **worse the next morning**, not better
- **One side only**, where the movement is symmetrical
- Anything with **numbness, tingling or weakness**
- Pain that **persists at rest**

## What to do

**Stop the movement that causes it.** Not the whole session necessarily — the
specific movement. Pushing through sharp joint pain does not build resilience.

**Don't self-diagnose from the internet.** The same shoulder pain has a dozen
possible causes and they are not distinguishable from a search result.

**Modify rather than quit.** Most pain is exercise-specific. If flat bench
hurts your shoulder, a slight incline or dumbbells may not. If squats hurt your
knee, the range or stance may be the issue. Training around something usually
beats stopping entirely.

**See a physiotherapist or doctor if:** it persists beyond a week or two,
involves numbness or weakness, followed a specific incident, or is bad enough
to affect ordinary daily activity.

## The thing people get wrong

Complete rest is rarely the answer. Tissue adapts to load, and prolonged total
rest often leaves you deconditioned and no less painful. The usual answer is
less load, not no load — but which, and how much, is a question for someone who
can actually examine you.`,
        questions: [
            {
                q: 'Which of these is normal after training?',
                options: [
                    'Sharp pain in a joint',
                    'Numbness down your arm',
                    'Dull muscle soreness 24–48 hours later',
                    'Pain that’s worse the next morning',
                ],
                answer: 'Dull muscle soreness 24–48 hours later',
                explanation: 'Delayed muscle soreness is a normal response to unfamiliar or increased work. The other three are signals to stop and get assessed.',
            },
            {
                q: 'Your shoulder hurts sharply on bench press. The best first response is:',
                options: [
                    'Push through it',
                    'Stop training entirely for a month',
                    'Stop that movement and try a variation',
                    'Take painkillers and continue',
                ],
                answer: 'Stop that movement and try a variation',
                explanation: 'Pain is often specific to a movement and angle. Changing the exercise frequently lets you keep training while avoiding what provokes it. Masking it with painkillers removes the signal without addressing the cause.',
            },
            {
                q: 'You should see a professional when pain:',
                options: [
                    'Lasts more than one session',
                    'Is felt during any exercise',
                    'Persists beyond a week or two, or involves numbness or weakness',
                    'Occurs on both sides equally',
                ],
                answer: 'Persists beyond a week or two, or involves numbness or weakness',
                explanation: 'Persistence, numbness, weakness, or a specific injuring incident all warrant proper assessment. This lesson can help you notice; it cannot diagnose.',
            },
            {
                q: 'For most persistent aches, complete rest is:',
                options: [
                    'Always the right answer',
                    'Often less effective than reduced load',
                    'Required for six weeks minimum',
                    'The only safe option',
                ],
                answer: 'Often less effective than reduced load',
                explanation: 'Tissue adapts to appropriate load, and prolonged total rest often leaves you deconditioned without resolving the problem. How much to reduce is a question for someone who can examine you.',
            },
        ],
    },

    {
        title: 'Training Around Your Cycle',
        unit: 6,
        unit_title: 'Sleep & Recovery',
        order_index: 4,
        description: "What changes, what doesn't, and what to adjust",
        topics: ['training', 'recovery'],
        connects_to: null,
        xp_reward: 50,
        content: `# Training and your cycle

Your cycle can affect how training feels. How much varies enormously between
individuals — some notice very little, others notice a great deal, and both are
normal.

## What people commonly report

**Days 1–5 (period).** Energy often lower, particularly the first two days.
Some find training helps with cramps; some don't. Both are fine.

**Days 6–14 (follicular).** Often when people feel strongest. Many find heavy
sessions easiest here.

**Around ovulation.** Some report joints feeling slightly less stable. Worth
noting if you're going for a maximal lift, not worth fearing.

**Days 15–28 (luteal).** Body temperature runs slightly higher, so sessions can
feel harder in heat. Appetite frequently increases, particularly in the last
week — this is physiological, not a failure of will.

## What's honest about the evidence

Studies on programming training around cycle phases are mixed. Some show
meaningful differences in strength across phases, others show very little. What
is well established is that individual experience varies widely.

**The useful conclusion is not a phase-based programme.** It is: track how you
actually feel, and give yourself permission to adjust.

## Practical adjustments

- **Feeling strong?** Push. Don't hold back because a chart says this is a
  "low" week.
- **Feeling flat?** Reduce volume rather than skipping. Two lighter sessions
  beat none.
- **Hungrier in the second half?** Expect it. A modest planned increase beats
  fighting it and then overshooting.
- **Weight up 1–2kg before your period?** Water. It resolves. Don't let it
  change your plan.

## When it's more than an inconvenience

If pain regularly prevents you training, or your cycle is very irregular,
that's worth raising with a doctor. Very low body fat and large training loads
can affect cycles, and that's a genuine health matter rather than a training
one.`,
        questions: [
            {
                q: 'Research on training programmed around cycle phases is:',
                options: [
                    'Conclusive and consistent',
                    'Mixed, with wide individual variation',
                    'Non-existent',
                    'Entirely negative',
                ],
                answer: 'Mixed, with wide individual variation',
                explanation: "Findings differ across studies and effect sizes are often small. What's well established is that individuals vary considerably — which is why tracking your own experience beats following a generic phase template.",
            },
            {
                q: 'A 1–2kg weight increase before your period is most likely:',
                options: ['Fat gain', 'Muscle gain', 'Water retention', 'A broken scale'],
                answer: 'Water retention',
                explanation: "Hormonal fluctuation causes water retention that resolves on its own. It isn't fat, and it isn't a reason to change your plan.",
            },
            {
                q: 'Increased appetite in the luteal phase is:',
                options: [
                    'A failure of discipline',
                    'A physiological change worth planning for',
                    'Imaginary',
                    'A sign of illness',
                ],
                answer: 'A physiological change worth planning for',
                explanation: "It's a real hormonal effect. Planning a modest increase generally works better than resisting it and then overshooting.",
            },
            {
                q: 'If your cycle becomes very irregular while training hard, you should:',
                options: [
                    'Ignore it',
                    'Train harder',
                    'Raise it with a doctor',
                    'Stop training permanently',
                ],
                answer: 'Raise it with a doctor',
                explanation: "Very low body fat combined with high training loads can disrupt cycles, and that's a health issue rather than a training one. It warrants proper medical input.",
            },
        ],
    },

    {
        title: 'Training While Fasting',
        unit: 8,
        unit_title: 'Advanced Topics',
        order_index: 3,
        description: "Navratri, Ramzan, Ekadashi, or any day you're not eating",
        topics: ['training', 'nutrition'],
        connects_to: null,
        xp_reward: 50,
        content: `# Training while fasting

People fast for many reasons, and the reasons aren't the app's business. What
is useful is knowing how to train sensibly around it.

## Short fasts, up to about 16 hours

Training fasted is fine. Performance on hard sets may dip slightly, mostly
noticeable on long or high-rep work. Strength on heavy, low-rep sets is largely
unaffected.

**Train close to when you'll eat** if you can. Finishing a session shortly
before your first meal means recovery starts immediately.

## Longer or water-restricted fasts

Two things change, and the second matters more.

**Hydration first.** If the fast includes water, performance and safety are
affected far more than by the lack of food. Train lighter, keep sessions short,
and avoid heat. This is not the week for personal bests.

**Reduce volume, keep intensity.** A shorter session at reasonable weight
maintains muscle better than a long depleting one. Two or three hard sets per
muscle is enough to hold on to what you have.

## Multi-day patterns like Navratri

Nine days of altered eating will not cost you meaningful muscle. What it may
cost is protein intake, which is easier to fix than most people assume — curd,
paneer, milk, and rajgira or kuttu preparations all contribute depending on
what your observance permits.

**Train, but with adjusted expectations.** Maintain rather than push. Progress
resumes afterwards, and a week or two of maintenance costs nothing over a year.

## Coming off a fast

Eat normally, not enormously. There's no need to compensate, and a very large
first meal after a long fast is uncomfortable more than it is useful.`,
        questions: [
            {
                q: 'Training during a fast of up to about 16 hours:',
                options: [
                    'Is dangerous',
                    'Will cost you muscle',
                    'Is generally fine, with a possible small performance dip',
                    'Requires halving all weights',
                ],
                answer: 'Is generally fine, with a possible small performance dip',
                explanation: "Short fasts affect performance modestly, mainly on longer sets. Heavy low-rep work is largely unaffected, and muscle isn't lost over this timescale.",
            },
            {
                q: 'During a fast that also restricts water, the priority is:',
                options: [
                    'Maintaining your usual volume',
                    'Setting personal bests',
                    'Reducing volume and avoiding heat',
                    'Training twice daily',
                ],
                answer: 'Reducing volume and avoiding heat',
                explanation: 'Lack of water affects performance and safety far more than lack of food. Shorter, lighter sessions away from heat are the sensible adjustment.',
            },
            {
                q: 'Over a nine-day period of altered eating, you should expect:',
                options: [
                    'Significant muscle loss',
                    'Little to no muscle loss',
                    'Complete loss of strength',
                    'Permanent metabolic damage',
                ],
                answer: 'Little to no muscle loss',
                explanation: "Muscle isn't lost over that timescale, particularly if you keep training. Protein intake usually dips, which is worth attending to, but the effect is small and reversible.",
            },
            {
                q: 'The best training approach during an extended fast is:',
                options: [
                    'Push harder to compensate',
                    'Stop training completely',
                    'Reduce volume, keep some intensity, aim to maintain',
                    'Only do cardio',
                ],
                answer: 'Reduce volume, keep some intensity, aim to maintain',
                explanation: "A few hard sets per muscle preserve muscle well. Long depleting sessions cost recovery you don't have; stopping entirely isn't necessary either.",
            },
        ],
    },
];

// ---------------------------------------------------------------------------

async function main() {
    const commit = process.argv.includes('--commit');
    const dry = process.argv.includes('--dry');
    if (!commit && !dry) {
        console.error('Pass --dry or --commit');
        process.exit(1);
    }

    // Validate every question set BEFORE opening a transaction. A bad answer
    // string should never get as far as the database.
    const built = new Map();
    for (const group of [REWRITE, APPEND, QUESTIONS_ONLY, NEW]) {
        for (const lesson of group) {
            built.set(lesson.title, buildQuestions(lesson.title, lesson.questions));
        }
    }
    console.log(`Validated ${built.size} lessons, ${built.size * 4} questions.`);

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    try {
        await client.query('BEGIN');

        const attemptsBefore = (await client.query('SELECT count(*)::int n FROM learn_attempts')).rows[0].n;

        let updated = 0;
        let inserted = 0;
        let skipped = 0;

        // --- full content replacement -------------------------------------
        for (const l of REWRITE) {
            const r = await client.query(
                `UPDATE learn_lessons
                    SET description = $2,
                        content = $3,
                        questions = $4::jsonb,
                        topics = $5,
                        connects_to = $6,
                        read_seconds = $7
                  WHERE title = $1`,
                [l.title, l.description, l.content, JSON.stringify(built.get(l.title)),
                 l.topics, l.connects_to, readSeconds(l.content)]
            );
            if (r.rowCount === 0) throw new Error(`REWRITE: no row matched title ${JSON.stringify(l.title)}`);
            updated += r.rowCount;
        }

        // --- append a paragraph, idempotently ------------------------------
        for (const l of APPEND) {
            const cur = await client.query('SELECT content FROM learn_lessons WHERE title = $1', [l.title]);
            if (cur.rows.length === 0) throw new Error(`APPEND: no row matched title ${JSON.stringify(l.title)}`);
            const existing = cur.rows[0].content || '';
            const already = existing.includes(l.marker);
            const next = already ? existing : existing + l.appendix;
            if (already) skipped++;
            const r = await client.query(
                `UPDATE learn_lessons
                    SET content = $2,
                        questions = $3::jsonb,
                        topics = $4,
                        connects_to = $5,
                        read_seconds = $6
                  WHERE title = $1`,
                [l.title, next, JSON.stringify(built.get(l.title)), l.topics, l.connects_to, readSeconds(next)]
            );
            updated += r.rowCount;
        }

        // --- questions only ------------------------------------------------
        for (const l of QUESTIONS_ONLY) {
            const r = await client.query(
                `UPDATE learn_lessons SET questions = $2::jsonb WHERE title = $1`,
                [l.title, JSON.stringify(built.get(l.title))]
            );
            if (r.rowCount === 0) throw new Error(`QUESTIONS_ONLY: no row matched title ${JSON.stringify(l.title)}`);
            updated += r.rowCount;
        }

        // --- new lessons, insert only if absent ----------------------------
        for (const l of NEW) {
            const r = await client.query(
                `INSERT INTO learn_lessons
                     (title, unit, unit_title, order_index, description, content,
                      xp_reward, questions, topics, connects_to, read_seconds)
                 SELECT $1::varchar, $2::int, $3::varchar, $4::int, $5::text,
                        $6::text, $7::int, $8::jsonb, $9::text[], $10::varchar,
                        $11::int
                  WHERE NOT EXISTS (SELECT 1 FROM learn_lessons WHERE title = $1)`,
                [l.title, l.unit, l.unit_title, l.order_index, l.description, l.content,
                 l.xp_reward, JSON.stringify(built.get(l.title)), l.topics,
                 l.connects_to, readSeconds(l.content)]
            );
            if (r.rowCount === 1) inserted++; else skipped++;
        }

        // --- verification ---------------------------------------------------
        const checks = [];
        const fail = (msg) => checks.push(['FAIL', msg]);
        const pass = (msg) => checks.push(['ok', msg]);

        const total = (await client.query('SELECT count(*)::int n FROM learn_lessons')).rows[0].n;
        total === 30 ? pass(`30 lessons`) : fail(`expected 30 lessons, found ${total}`);

        const untagged = (await client.query(
            `SELECT count(*)::int n FROM learn_lessons WHERE topics = '{}' OR topics IS NULL`
        )).rows[0].n;
        untagged === 0 ? pass('every lesson tagged') : fail(`${untagged} lessons untagged`);

        const noExpl = (await client.query(
            `SELECT title FROM learn_lessons l
              WHERE EXISTS (
                SELECT 1 FROM jsonb_array_elements(l.questions) q
                 WHERE q->>'explanation' IS NULL OR length(q->>'explanation') < 20)`
        )).rows;
        noExpl.length === 0
            ? pass('every question has an explanation')
            : fail(`missing explanations: ${noExpl.map(r => r.title).join(', ')}`);

        const badShape = (await client.query(
            `SELECT title FROM learn_lessons l
              WHERE EXISTS (
                SELECT 1 FROM jsonb_array_elements(l.questions) q
                 WHERE jsonb_array_length(q->'options') <> 4
                    OR (q->>'correct')::int < 0
                    OR (q->>'correct')::int > 3)`
        )).rows;
        badShape.length === 0
            ? pass('all questions have 4 options and an in-range answer')
            : fail(`bad question shape: ${badShape.map(r => r.title).join(', ')}`);

        const qCount = (await client.query(
            `SELECT count(*)::int n FROM learn_lessons WHERE jsonb_array_length(questions) <> 4`
        )).rows[0].n;
        qCount === 0 ? pass('every lesson has 4 questions') : fail(`${qCount} lessons not at 4 questions`);

        const attemptsAfter = (await client.query('SELECT count(*)::int n FROM learn_attempts')).rows[0].n;
        attemptsAfter === attemptsBefore
            ? pass(`learn_attempts intact (${attemptsAfter})`)
            : fail(`learn_attempts changed: ${attemptsBefore} -> ${attemptsAfter}`);

        const orphans = (await client.query(
            `SELECT count(*)::int n FROM learn_attempts a
              WHERE NOT EXISTS (SELECT 1 FROM learn_lessons l WHERE l.id = a.lesson_id)`
        )).rows[0].n;
        orphans === 0 ? pass('no orphaned attempts') : fail(`${orphans} orphaned attempts`);

        const dupes = (await client.query(
            `SELECT title FROM learn_lessons GROUP BY title HAVING count(*) > 1`
        )).rows;
        dupes.length === 0
            ? pass('no duplicate titles')
            : fail(`duplicate titles: ${dupes.map(r => r.title).join(', ')}`);

        console.log(`\nupdated ${updated}, inserted ${inserted}, skipped ${skipped}\n`);
        for (const [status, msg] of checks) {
            console.log(`  ${status === 'ok' ? '✓' : '✗'} ${msg}`);
        }

        const failed = checks.filter(([s]) => s === 'FAIL');
        if (failed.length > 0) {
            await client.query('ROLLBACK');
            console.error(`\n${failed.length} check(s) failed. Rolled back.`);
            process.exit(1);
        }

        if (commit) {
            await client.query('COMMIT');
            console.log('\nCOMMITTED.');
        } else {
            await client.query('ROLLBACK');
            console.log('\nDry run — rolled back. Re-run with --commit to apply.');
        }
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('\nFailed, rolled back:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
