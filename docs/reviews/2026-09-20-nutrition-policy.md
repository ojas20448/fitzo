# Practical nutrition defaults — 20 September 2026

Implemented locally, formula version 4. The owner's final preference is protein within 1.8–2.0 g/kg and 30% fat. Fitzo uses the lower end for maintenance and muscle gain, and the upper end for fat loss. These are starting targets for adult fitness planning, not an individually optimal diet.

## Decision

| Goal | Protein per day | Fat | Carbohydrate |
| --- | --- | --- | --- |
| Maintain | 1.8 g/kg body weight | About 30% of calories | Remaining calories |
| Build muscle | 1.8 g/kg body weight | About 30% of calories | Remaining calories |
| Lose fat | 2.0 g/kg body weight | About 30% of calories | Remaining calories |

Protein grams are calculated first, independently of calories. Fat grams are calories × 0.30 ÷ 9, rounded to the nearest gram. Carbohydrate grams are the remaining calories ÷ 4, rounded to the nearest gram. The resulting total can differ from the calorie target by up to 2 kcal. Percentages describe the result; they do not force protein upward when calories rise. Deliberate custom targets remain supported.

For a 70 kg person, daily protein is 126 g for maintenance or muscle gain, and 140 g for fat loss. This is roughly 32–35 g across four meals; meal timing and distribution are flexible.

At an **illustrative 2,200 kcal budget held constant for comparison**, the actual percentages are:

| Goal | Protein | Carbs | Fat | Approximate P / C / F |
| --- | --- | --- | --- | --- |
| Maintain | 126 g | 260 g | 73 g | 23% / 47% / 30% |
| Build muscle | 126 g | 260 g | 73 g | 23% / 47% / 30% |
| Lose fat | 140 g | 246 g | 73 g | 25% / 45% / 30% |

These calorie budgets are examples, not a prescription for every 70 kg person. Fitzo's existing goal-specific calorie estimate still runs separately. Increasing fat from 25% to 30% reduces the carbohydrate allocation at the same calorie and protein targets. Lowering all three macros simultaneously would require lowering total calories.

## Competitor research

- [Lose It: Nutrition Strategies](https://loseit.zendesk.com/hc/en-us/articles/47773469433364-Nutrition-Strategies), accessed 20 September 2026: describes personalized targets aligned with a calorie budget. Its Balanced strategy uses moderate protein, fat and carbohydrate; it also offers High Protein, Mediterranean and other strategies. **The official page does not publish exact percentages**, so no precise Lose It ratio is claimed here.
- [MyFitnessPal: Macro Calculator](https://support.myfitnesspal.com/hc/en-us/articles/24763932864397-Macro-Calculator), accessed 20 September 2026: explicitly lists the standard split as 20% protein, 50% carbohydrate and 30% fat. Its separate personalized calculator determines protein from body weight and activity before allocating the remainder to fat and carbohydrate. Fitzo adopts a similar weight-first approach rather than copying a percentage regardless of body size.

## Evidence and interpretation

- [ISSN position stand on protein and exercise (2017)](https://pubmed.ncbi.nlm.nih.gov/28642676/): 1.4–2.0 g/kg/day is sufficient for most exercising individuals. All three chosen defaults fall within that range. This does not establish the exact chosen numbers as uniquely best.
- [Morton et al., resistance-training meta-analysis (2018)](https://pubmed.ncbi.nlm.nih.gov/28698222/): across 49 studies, the estimated average breakpoint for additional fat-free-mass benefit was approximately 1.62 g/kg/day. This is not a universal individual ceiling. The selected 1.8 g/kg muscle-gain default is within the sports-nutrition range; extra protein is not automatically extra muscle.
- [Leidy et al., protein and weight-management review (2015)](https://pubmed.ncbi.nlm.nih.gov/25926512/): diets around 1.2–1.6 g/kg/day may help appetite and weight management, with long-term adherence important. This shows that 2.0 g/kg is not a requirement for everyone losing weight. Fitzo's 2.0 g/kg fat-loss default is a product choice at the upper end of the owner's requested range for exercising users, informed by the ISSN discussion of muscle retention during energy restriction. It is not a direct numerical recommendation from this review.

The supplied inspiration table's 35–40% protein cutting preset is not enforced: it could recreate excessive protein targets at higher calorie budgets. Likewise, protein above a muscle-growth breakpoint is not necessarily protein the body cannot use. Maintenance and muscle gain share a protein factor; their separately calculated calorie budgets produce different carbohydrate amounts and percentages.

Thirty percent fat is a product default and user preference, not a claim that it is superior to every other split. Carbohydrate needs and dietary preferences vary. There is no single best macro percentage for all bodies and goals.

## Implementation and validation

- Backend and mobile calculators use the same goal-specific protein factors and 30% fat default.
- Onboarding and Fitness Profile pass the selected goal to the calculator; changing the goal updates the preview. Both explain weight-based protein and the remaining calorie allocation.
- Formula version is 4. The existing repair script imports the version constant and therefore selects eligible automatic profiles below version 4. It defaults to preview and skips ambiguous legacy records and custom macros. It has not been run against production.
- Custom calories, custom protein/fat, final calorie validation and macro/calorie consistency checks are retained.
- Validation passed: 42 backend suites / 417 tests, 25 mobile suites / 246 tests, and mobile TypeScript. Calculator parity covers all three goals, multiple weights and calorie budgets, and custom overrides.

## Scope and release limits

No calorie-estimation formula was changed in this update. The existing adult-oriented energy model and minimum-calorie checks do not establish adequate intake for every individual. Existing support for ages 14–17 requires a separate age-appropriate nutrition-policy review; adult evidence here must not be presented as validation for adolescents. Pregnancy, clinical conditions and specialist athletic diets likewise require individualized guidance.

These changes are local. Existing accounts will need the reviewed target repair or an explicit save using suggested macros after backend deployment. Mobile previews and copy require a compatible app update. Production data and App Store binaries have not been changed by this work.
