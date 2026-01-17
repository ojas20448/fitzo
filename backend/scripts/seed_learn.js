require('dotenv').config();
const { Client } = require('pg');

const LEARNING_LEVELS = [
    {
        id: 1,
        name: "Nutrition Fundamentals",
        difficulty: "Beginner",
        xpRequired: 0,
        questions: [
            {
                question: "What's the main function of protein?",
                options: ["Energy source", "Building tissues", "Storing vitamins", "Temperature control"],
                correct: "Building tissues",
                explanation: "Protein builds and repairs tissues like muscles, skin, and organs.",
                xp_reward: 10
            },
            {
                question: "Which macronutrient provides the most calories per gram?",
                options: ["Protein", "Carbohydrates", "Fat", "Fiber"],
                correct: "Fat",
                explanation: "Fat is most calorie-dense at 9 cal/g, more than double protein and carbs (both 4 cal/g).",
                xp_reward: 10
            },
            {
                question: "Which vitamin comes from sunlight?",
                options: ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin E"],
                correct: "Vitamin D",
                explanation: "Vitamin D is synthesized by skin when exposed to UVB sunlight.",
                xp_reward: 10
            },
            {
                question: "What percentage of body is water?",
                options: ["30-40%", "50-60%", "60-70%", "80-90%"],
                correct: "60-70%",
                explanation: "Human body is ~60-70% water.",
                xp_reward: 10
            },
            {
                question: "What is BMI?",
                options: ["Body Mass Index", "Basal Metabolic Index", "Body Muscle Indicator", "Basic Mineral Intake"],
                correct: "Body Mass Index",
                explanation: "BMI (Body Mass Index) = weight(kg) / height(m)²",
                xp_reward: 10
            },
            {
                question: "How many essential amino acids?",
                options: ["6", "9", "12", "20"],
                correct: "9",
                explanation: "There are 9 essential amino acids your body can't produce.",
                xp_reward: 10
            },
            {
                question: "What causes muscle soreness after workout?",
                options: ["Lactic acid", "Micro-tears in fibers", "Dehydration", "Toxin buildup"],
                correct: "Micro-tears in fibers",
                explanation: "DOMS (Delayed Onset Muscle Soreness) is from micro-tears, not lactic acid.",
                xp_reward: 10
            },
            {
                question: "Complete protein contains all?",
                options: ["Vitamins", "Minerals", "Essential amino acids", "Fatty acids"],
                correct: "Essential amino acids",
                explanation: "Complete proteins have all 9 essential amino acids (meat, dairy, soy).",
                xp_reward: 10
            },
            {
                question: "What is glycemic index (GI)?",
                options: ["Sugar content", "Blood sugar impact", "Calorie density", "Fiber content"],
                correct: "Blood sugar impact",
                explanation: "GI measures how fast food raises blood sugar levels.",
                xp_reward: 10
            },
            {
                question: "Which mineral is crucial for bone health?",
                options: ["Iron", "Calcium", "Zinc", "Magnesium"],
                correct: "Calcium",
                explanation: "Calcium is primary mineral for bone strength and density.",
                xp_reward: 10
            },
            {
                question: "What are empty calories?",
                options: ["Zero-cal foods", "High cal, low nutrients", "Sugar substitutes", "Fiber foods"],
                correct: "High cal, low nutrients",
                explanation: "Empty calories = high energy but minimal vitamins/minerals (soda, candy).",
                xp_reward: 10
            },
            {
                question: "Which vitamin is fat-soluble?",
                options: ["Vitamin C", "Vitamin B12", "Vitamin A", "Vitamin B6"],
                correct: "Vitamin A",
                explanation: "Fat-soluble vitamins: A, D, E, K. Stored in body fat.",
                xp_reward: 10
            },
            {
                question: "What is RDA?",
                options: ["Recommended Daily Allowance", "Required Diet Amount", "Reduced Diet Approach", "Rapid Diet Adaptation"],
                correct: "Recommended Daily Allowance",
                explanation: "RDA = Recommended Daily Allowance of nutrients for health.",
                xp_reward: 10
            },
            {
                question: "Which macronutrient is most satiating?",
                options: ["Carbs", "Fats", "Protein", "Fiber"],
                correct: "Protein",
                explanation: "Protein provides most satiety per calorie.",
                xp_reward: 10
            },
            {
                question: "What is thermic effect of food (TEF)?",
                options: ["Food temperature", "Calories burned digesting", "Cooking heat loss", "Metabolic slowdown"],
                correct: "Calories burned digesting",
                explanation: "TEF = energy used to digest, absorb, process nutrients. Protein has highest TEF (20-30%).",
                xp_reward: 10
            },
            {
                question: "Fiber is classified as?",
                options: ["Protein", "Fat", "Carbohydrate", "Vitamin"],
                correct: "Carbohydrate",
                explanation: "Fiber is a complex carbohydrate that can't be digested.",
                xp_reward: 10
            }
        ]
    },
    {
        id: 2,
        name: "Indian Food Mastery",
        difficulty: "Beginner",
        xpRequired: 160,
        questions: [
            {
                question: "Highest protein per 100 cal?",
                options: ["Paneer", "Dal", "Chicken breast", "Eggs"],
                correct: "Chicken breast",
                explanation: "Chicken: 18.8g/100cal. Dal: 6.7g. Paneer: 6.8g. Eggs: 8.3g.",
                xp_reward: 15
            },
            {
                question: "GI of roti vs white rice?",
                options: ["Roti much lower (45)", "About same (70-75)", "Roti higher (85)", "No GI"],
                correct: "About same (70-75)",
                explanation: "Both similar GI (70-75). Adding protein/fat lowers overall GI.",
                xp_reward: 15
            },
            {
                question: "Calories in 1 plain roti?",
                options: ["40-50", "70-90", "120-140", "180-200"],
                correct: "70-90",
                explanation: "One roti = 70-90 cal, 3g protein, 15g carbs.",
                xp_reward: 15
            },
            {
                question: "Is ghee healthier than vegetable oil?",
                options: ["Much healthier", "Slightly healthier", "Same", "Oil better"],
                correct: "Slightly healthier",
                explanation: "Ghee has higher smoke point, CLA, butyrate. Still 100% fat. Moderation key.",
                xp_reward: 15
            },
            {
                question: "Which spice burns fat?",
                options: ["Turmeric", "Red chili", "Cumin", "All myths"],
                correct: "Red chili",
                explanation: "Capsaicin in red chili increases metabolism 5-8% temporarily.",
                xp_reward: 15
            },
            {
                question: "Best protein source for vegetarians?",
                options: ["Rice", "Dal + Rice combo", "Potatoes", "Bread"],
                correct: "Dal + Rice combo",
                explanation: "Dal + Rice = complete protein with all essential amino acids.",
                xp_reward: 15
            },
            {
                question: "How many calories in 1 paratha?",
                options: ["100-150", "200-250", "300-350", "400-450"],
                correct: "200-250",
                explanation: "One paratha = 200-250 cal due to ghee/oil used.",
                xp_reward: 15
            },
            {
                question: "Which dal has highest protein?",
                options: ["Moong dal", "Masoor dal", "Urad dal", "Chana dal"],
                correct: "Urad dal",
                explanation: "Urad dal: 25g protein/100g. Chana: 22g. Moong: 24g. Masoor: 26g (varies by source).",
                xp_reward: 15
            },
            {
                question: "Is brown rice healthier than white?",
                options: ["Much healthier", "Slightly healthier", "Same calories", "White rice better"],
                correct: "Slightly healthier",
                explanation: "Brown rice has more fiber, vitamins, minerals. Similar calories. Lower GI.",
                xp_reward: 15
            },
            {
                question: "Turmeric's main benefit?",
                options: ["Fat burning", "Anti-inflammatory", "Muscle building", "Energy boost"],
                correct: "Anti-inflammatory",
                explanation: "Curcumin in turmeric is powerful anti-inflammatory compound.",
                xp_reward: 15
            },
            {
                question: "How many types of rice commonly eaten in India?",
                options: ["5-10", "50-100", "100-200", "200-300"],
                correct: "100-200",
                explanation: "India has 100+ rice varieties, each with unique nutrition profile.",
                xp_reward: 15
            },
            {
                question: "Best time to eat curd/yogurt?",
                options: ["Morning only", "With meals", "Before bed", "Anytime"],
                correct: "Anytime",
                explanation: "Probiotics in curd beneficial anytime. Ayurveda says avoid at night (debated).",
                xp_reward: 15
            },
            {
                question: "Calories in 100g paneer?",
                options: ["150-180", "200-230", "265-280", "320-350"],
                correct: "265-280",
                explanation: "Paneer: ~265 cal, 18g protein, 20g fat per 100g.",
                xp_reward: 15
            },
            {
                question: "Is jaggery (gur) healthier than sugar?",
                options: ["Much healthier", "Slightly healthier", "Same", "Sugar better"],
                correct: "Slightly healthier",
                explanation: "Jaggery has trace minerals, iron. But similar calories and GI to sugar.",
                xp_reward: 15
            },
            {
                question: "Which oil is best for Indian cooking?",
                options: ["Coconut oil", "Mustard oil", "Refined oil", "All equal"],
                correct: "Mustard oil",
                explanation: "Mustard oil: high smoke point, omega-3, traditional choice. Moderation key.",
                xp_reward: 15
            },
            {
                question: "Calories in 1 idli?",
                options: ["25-35", "39-45", "60-70", "90-100"],
                correct: "39-45",
                explanation: "One idli = ~39 cal, 2g protein. Very low calorie breakfast option.",
                xp_reward: 15
            }
        ]
    },
    {
        id: 3,
        name: "Protein & Muscle",
        difficulty: "Intermediate",
        xpRequired: 400,
        questions: [
            {
                question: "Protein per kg for muscle building?",
                options: ["0.8g/kg", "1.2-1.6g/kg", "2.0-2.4g/kg", "3.0+g/kg"],
                correct: "2.0-2.4g/kg",
                explanation: "2.0-2.4g/kg optimal, especially during deficit.",
                xp_reward: 20
            },
            {
                question: "Weekly sets per muscle for growth?",
                options: ["1-3 sets", "4-6 sets", "10-20 sets", "30+ sets"],
                correct: "10-20 sets",
                explanation: "10-20 sets/week maximizes hypertrophy. Recovery matters.",
                xp_reward: 20
            },
            {
                question: "How long is 'anabolic window'?",
                options: ["15-30 min", "1-2 hrs", "4-6 hrs", "Doesn't matter"],
                correct: "Doesn't matter",
                explanation: "Window is 24+ hours. Total daily protein matters most.",
                xp_reward: 20
            },
            {
                question: "Optimal rest days per week?",
                options: ["0 days", "1-2 days", "3-4 days", "5+ days"],
                correct: "1-2 days",
                explanation: "1-2 rest days minimum for recovery. Muscles grow during rest.",
                xp_reward: 20
            },
            {
                question: "Can beginners build muscle + lose fat?",
                options: ["Impossible", "Steroid users only", "Yes, beginners can", "Women only"],
                correct: "Yes, beginners can",
                explanation: "Beginners can recomp. Needs high protein + progressive overload.",
                xp_reward: 20
            },
            {
                question: "How much muscle gain per month (natural)?",
                options: ["5-10 lbs", "2-4 lbs", "0.5-1 lb", "0.1-0.5 lb"],
                correct: "2-4 lbs",
                explanation: "Beginners: 1-2 lbs/month. Advanced: 0.25-0.5 lbs/month realistic.",
                xp_reward: 20
            },
            {
                question: "Best rep range for hypertrophy?",
                options: ["1-5 reps", "6-12 reps", "15-20 reps", "All ranges work"],
                correct: "All ranges work",
                explanation: "All rep ranges build muscle with sufficient volume. 6-12 is efficient.",
                xp_reward: 20
            },
            {
                question: "Does protein timing matter?",
                options: ["Very important", "Moderately important", "Slightly important", "Not important"],
                correct: "Slightly important",
                explanation: "Timing has small benefit. Total daily protein is 80% of equation.",
                xp_reward: 20
            },
            {
                question: "How long to see muscle gains?",
                options: ["1-2 weeks", "3-4 weeks", "8-12 weeks", "6+ months"],
                correct: "8-12 weeks",
                explanation: "Noticeable gains in 8-12 weeks with proper training and nutrition.",
                xp_reward: 20
            },
            {
                question: "Can women build as much muscle as men?",
                options: ["Yes, equal", "No, much less", "No, slightly less", "Yes, if trained harder"],
                correct: "No, slightly less",
                explanation: "Women build muscle ~50% slower due to lower testosterone. Still significant gains possible.",
                xp_reward: 20
            },
            {
                question: "Does creatine work?",
                options: ["Yes, very effective", "Placebo effect", "Only for some people", "No effect"],
                correct: "Yes, very effective",
                explanation: "Creatine monohydrate: most researched supplement. 5-15% strength gains.",
                xp_reward: 20
            },
            {
                question: "BCAA supplements necessary?",
                options: ["Essential", "Helpful if diet poor", "Waste of money", "Only for athletes"],
                correct: "Waste of money",
                explanation: "BCAAs inferior to complete protein. Save money, eat real food.",
                xp_reward: 20
            },
            {
                question: "Protein before or after workout?",
                options: ["Before is critical", "After is critical", "Both equally good", "Doesn't matter"],
                correct: "Both equally good",
                explanation: "Both work. Having protein before means it's available during/after training.",
                xp_reward: 20
            },
            {
                question: "Can older adults (50+) build muscle?",
                options: ["No, too late", "Yes, but very slowly", "Yes, similar to younger", "Only with steroids"],
                correct: "Yes, but very slowly",
                explanation: "Muscle building possible at any age. Slower but significant with proper training.",
                xp_reward: 20
            },
            {
                question: "Muscle memory is real?",
                options: ["Myth", "Yes, regain 2-3x faster", "Yes, regain 10% faster", "Only for some people"],
                correct: "Yes, regain 2-3x faster",
                explanation: "Myonuclei retained. Previous muscle regrows 2-3x faster.",
                xp_reward: 20
            },
            {
                question: "Testosterone boosters work?",
                options: ["Very effective", "Slight effect", "Placebo", "Harmful"],
                correct: "Placebo",
                explanation: "Most OTC test boosters don't work. Real TRT requires prescription.",
                xp_reward: 20
            }
        ]
    },
    {
        id: 4,
        name: "Fat Loss Science",
        difficulty: "Intermediate",
        xpRequired: 720,
        questions: [
            {
                question: "Safest weekly weight loss?",
                options: ["2-3 kg", "1-1.5 kg", "0.5-1 kg", "0.25 kg"],
                correct: "0.5-1 kg",
                explanation: "0.5-1 kg/week preserves muscle. 500-700 cal deficit daily.",
                xp_reward: 20
            },
            {
                question: "Can you spot reduce fat?",
                options: ["Yes, targeted exercises", "Yes, slightly", "No, systemic only", "Yes, special diets"],
                correct: "No, systemic only",
                explanation: "Spot reduction is myth. Fat loss is systemic.",
                xp_reward: 20
            },
            {
                question: "Fasted cardio vs fed cardio?",
                options: ["50% more fat", "20% more", "Slightly more", "No difference"],
                correct: "No difference",
                explanation: "Same 24-hr fat oxidation. Total daily deficit matters.",
                xp_reward: 20
            },
            {
                question: "Metabolism slow during 500cal deficit?",
                options: ["20-30%", "10-15%", "5-10%", "No change"],
                correct: "5-10%",
                explanation: "5-10% adaptation. 'Starvation mode' myth exaggerated.",
                xp_reward: 20
            },
            {
                question: "Do cheat meals reset metabolism?",
                options: ["Yes, significantly", "Slight temp boost", "No real effect", "Slows it"],
                correct: "Slight temp boost",
                explanation: "Small <24h boost via leptin. Psychological benefits real.",
                xp_reward: 20
            },
            {
                question: "How many calories in 1 lb of fat?",
                options: ["2500", "3500", "4500", "5500"],
                correct: "3500",
                explanation: "1 lb fat = ~3500 calories. Deficit of 500/day = 1 lb/week loss.",
                xp_reward: 20
            },
            {
                question: "Cardio before or after weights?",
                options: ["Always before", "Always after", "Doesn't matter", "Separate days better"],
                correct: "Always after",
                explanation: "Weights first preserves strength. Cardio after won't interfere with lifting performance.",
                xp_reward: 20
            },
            {
                question: "HIIT vs steady-state cardio for fat loss?",
                options: ["HIIT much better", "Steady-state better", "Equal if calories same", "HIIT only option"],
                correct: "Equal if calories same",
                explanation: "Equal fat loss if total calories burned are same. HIIT saves time.",
                xp_reward: 20
            },
            {
                question: "Carbs make you fat?",
                options: ["Yes, always", "Yes, at night", "No, calorie surplus does", "Only refined carbs"],
                correct: "No, calorie surplus does",
                explanation: "Total calories matter, not carbs specifically. Carb timing irrelevant for fat loss.",
                xp_reward: 20
            },
            {
                question: "How much cardio per week for fat loss?",
                options: ["None needed", "30-60 min", "150 min minimum", "300+ min"],
                correct: "150 min minimum",
                explanation: "150 min moderate or 75 min vigorous per week recommended. More isn't always better.",
                xp_reward: 20
            },
            {
                question: "Can you lose fat without cardio?",
                options: ["Impossible", "Very difficult", "Yes, with diet alone", "Only with HIIT"],
                correct: "Yes, with diet alone",
                explanation: "Diet creates deficit. Cardio helps but isn't mandatory. Diet > Exercise for fat loss.",
                xp_reward: 20
            },
            {
                question: "Fat burner supplements work?",
                options: ["Very effective", "Slight effect (5%)", "Placebo", "Dangerous"],
                correct: "Slight effect (5%)",
                explanation: "Most have minor effect (3-5%). Diet and exercise 100x more important.",
                xp_reward: 20
            },
            {
                question: "Belly fat last to go?",
                options: ["Yes, genetics", "No, uniform loss", "First to go", "Depends on diet"],
                correct: "Yes, genetics",
                explanation: "Genetics determine fat loss pattern. Belly often last for men, hips for women.",
                xp_reward: 20
            },
            {
                question: "Can you be overweight but healthy?",
                options: ["No, never", "Yes, if metabolically healthy", "Only temporarily", "Yes, if fit"],
                correct: "Yes, if metabolically healthy",
                explanation: "'Metabolically healthy obesity' exists but risk increases with time.",
                xp_reward: 20
            },
            {
                question: "Weight loss plateaus are real?",
                options: ["Myth", "Yes, metabolic adaptation", "Only for some people", "Mental only"],
                correct: "Yes, metabolic adaptation",
                explanation: "Body adapts: NEAT decreases, hunger increases, metabolism slows slightly.",
                xp_reward: 20
            },
            {
                question: "How to break a plateau?",
                options: ["Eat even less", "Take diet break", "More cardio", "Change workout"],
                correct: "Take diet break",
                explanation: "2-week maintenance break can reset hormones (leptin, thyroid) and psychology.",
                xp_reward: 20
            }
        ]
    },
    {
        id: 5,
        name: "Advanced Macro Management",
        difficulty: "Intermediate",
        xpRequired: 720,
        questions: [
            {
                question: "What's carb cycling?",
                options: ["Alternating carb intake by day", "Only carbs pre-workout", "No carbs ever", "Carbs every 3 hours"],
                correct: "Alternating carb intake by day",
                explanation: "High carb on training days, lower on rest days to optimize performance and recovery.",
                xp_reward: 25
            },
            {
                question: "Best protein distribution?",
                options: ["All at once", "20-40g every 3-4 hours", "Only post-workout", "Doesn't matter"],
                correct: "20-40g every 3-4 hours",
                explanation: "Evenly distributed protein optimizes muscle protein synthesis throughout the day.",
                xp_reward: 25
            },
            {
                question: "Refeed days help with?",
                options: ["Cheat meals", "Leptin and metabolism", "Just mental break", "Building muscle"],
                correct: "Leptin and metabolism",
                explanation: "Strategic high-carb days can temporarily boost leptin and metabolic rate during dieting.",
                xp_reward: 25
            },
            {
                question: "Protein timing matters most for?",
                options: ["Everyone", "Advanced athletes", "Beginners", "Not at all"],
                correct: "Advanced athletes",
                explanation: "Total daily protein matters most; timing provides marginal 5-10% benefit for athletes.",
                xp_reward: 25
            },
            {
                question: "Keto adaptation takes how long?",
                options: ["2-3 days", "1 week", "2-4 weeks", "6 months"],
                correct: "2-4 weeks",
                explanation: "Full fat adaptation (increased fat oxidation, mental clarity) takes 2-4 weeks.",
                xp_reward: 25
            },
            {
                question: "Insulin sensitivity is best when?",
                options: ["Morning", "Post-workout", "Evening", "Before bed"],
                correct: "Post-workout",
                explanation: "Muscles are most insulin-sensitive after exercise, making it ideal for carb intake.",
                xp_reward: 25
            },
            {
                question: "IIFYM (If It Fits Your Macros) means?",
                options: ["Eat anything", "Hit macros, food choice flexible", "Only junk food", "Ignore micros"],
                correct: "Hit macros, food choice flexible",
                explanation: "Focus on hitting protein/carb/fat targets; food sources matter less for body composition.",
                xp_reward: 25
            },
            {
                question: "Reverse dieting is?",
                options: ["Gaining fat back", "Slowly increasing calories", "Eating backwards", "Fasting"],
                correct: "Slowly increasing calories",
                explanation: "Gradually add 50-100 calories weekly to restore metabolism after dieting.",
                xp_reward: 25
            },
            {
                question: "Nutrient partitioning means?",
                options: ["Meal timing", "Where nutrients go (muscle vs fat)", "Eating separately", "Portion control"],
                correct: "Where nutrients go (muscle vs fat)",
                explanation: "How your body allocates nutrients between muscle tissue and fat storage.",
                xp_reward: 25
            },
            {
                question: "Best carb sources post-workout?",
                options: ["Complex only", "Simple + complex mix", "Fats", "Protein"],
                correct: "Simple + complex mix",
                explanation: "Fast-digesting carbs (dextrose, white rice) with some complex carbs replenish glycogen quickly.",
                xp_reward: 25
            },
            {
                question: "Leucine threshold per meal?",
                options: ["1-2g", "2.5-3g", "5g", "10g"],
                correct: "2.5-3g",
                explanation: "2.5-3g leucine maximally stimulates muscle protein synthesis per meal.",
                xp_reward: 25
            },
            {
                question: "Protein ceiling per meal?",
                options: ["20g", "30-40g optimally used", "60g", "No limit"],
                correct: "30-40g optimally used",
                explanation: "While more can be used, 30-40g optimizes muscle protein synthesis per meal.",
                xp_reward: 25
            },
            {
                question: "Anabolic window is actually?",
                options: ["30 min post-workout", "Doesn't exist", "24-48 hours", "Before workout"],
                correct: "24-48 hours",
                explanation: "Muscle growth window is 24-48 hours post-workout, not just 30 minutes.",
                xp_reward: 25
            },
            {
                question: "Maingaining is?",
                options: ["Bulking", "Recomp at maintenance", "Cutting", "Carb cycling"],
                correct: "Recomp at maintenance",
                explanation: "Building muscle while staying lean by eating at maintenance with high protein.",
                xp_reward: 25
            },
            {
                question: "TEF (Thermic Effect of Food) highest for?",
                options: ["Fats", "Carbs", "Protein", "Alcohol"],
                correct: "Protein",
                explanation: "Protein has 20-30% TEF (digesting 100 cal burns 20-30), carbs 5-10%, fats 0-3%.",
                xp_reward: 25
            },
            {
                question: "Mini-cuts are?",
                options: ["Small snacks", "2-4 week aggressive deficits", "Fasting", "Cheat days"],
                correct: "2-4 week aggressive deficits",
                explanation: "Short, aggressive 4-6 week cuts to quickly shed fat while preserving muscle.",
                xp_reward: 25
            }
        ]
    },
    {
        id: 6,
        name: "Meal Timing & Frequency",
        difficulty: "Intermediate",
        xpRequired: 1120,
        questions: [
            {
                question: "Intermittent fasting (16:8) means?",
                options: ["8 hours eating, 16 fasting", "16 meals, 8 snacks", "Fast 8 days", "16 hour workouts"],
                correct: "8 hours eating, 16 fasting",
                explanation: "Eat within 8-hour window, fast for 16 hours (e.g., eat 12pm-8pm).",
                xp_reward: 25
            },
            {
                question: "Does IF boost metabolism?",
                options: ["Yes significantly", "No, just calorie control", "Only for women", "Only with exercise"],
                correct: "No, just calorie control",
                explanation: "IF works through calorie restriction, not metabolic magic. Same calories = same results.",
                xp_reward: 25
            },
            {
                question: "Best pre-workout meal timing?",
                options: ["Right before", "2-3 hours before", "Doesn't matter", "6 hours before"],
                correct: "2-3 hours before",
                explanation: "2-3 hours allows digestion while providing energy. Closer = lighter meal needed.",
                xp_reward: 25
            },
            {
                question: "Eating before bed causes fat gain?",
                options: ["Always true", "Myth - total calories matter", "Only carbs", "Only if over TDEE"],
                correct: "Only if over TDEE",
                explanation: "Meal timing doesn't matter; only total daily calories determine fat gain/loss.",
                xp_reward: 25
            },
            {
                question: "Breakfast is essential?",
                options: ["Yes, boosts metabolism", "No, preference-based", "Only for athletes", "Only for kids"],
                correct: "No, preference-based",
                explanation: "Breakfast doesn't boost metabolism. Eat when hungry and it fits your schedule.",
                xp_reward: 25
            },
            {
                question: "Post-workout meal must be immediate?",
                options: ["Within 30 minutes", "Within 2-3 hours is fine", "Within 5 minutes", "Doesn't matter at all"],
                correct: "Within 2-3 hours is fine",
                explanation: "Anabolic window is 24-48 hours. Post-workout meal can be within 2-3 hours.",
                xp_reward: 25
            },
            {
                question: "Eating 6 small meals boosts metabolism?",
                options: ["Yes, keeps it active", "Myth - same as 3 meals", "Only if protein-rich", "Only for bodybuilders"],
                correct: "Myth - same as 3 meals",
                explanation: "Meal frequency doesn't affect metabolism. 6 meals vs 3 meals = same TEF if calories match.",
                xp_reward: 25
            },
            {
                question: "OMAD (One Meal A Day) is?",
                options: ["Unhealthy always", "Works if hitting calories/protein", "Best for everyone", "Only for fasting experts"],
                correct: "Works if hitting calories/protein",
                explanation: "OMAD works if you can hit protein needs (harder with one meal) and fits lifestyle.",
                xp_reward: 25
            },
            {
                question: "Circadian rhythm affects?",
                options: ["Nothing", "Insulin sensitivity & digestion", "Only sleep", "Only mood"],
                correct: "Insulin sensitivity & digestion",
                explanation: "Insulin sensitivity peaks in morning, decreases evening. Carbs may be better utilized earlier.",
                xp_reward: 25
            },
            {
                question: "Pre-workout fasted training burns more fat?",
                options: ["Yes, always", "No, 24-hour balance matters", "Only for cardio", "Only for weights"],
                correct: "No, 24-hour balance matters",
                explanation: "Fat oxidation may increase during fasted training, but total daily fat loss is unchanged.",
                xp_reward: 25
            },
            {
                question: "Carb backloading is?",
                options: ["No carbs", "Carbs mainly in evening", "Carbs before bed only", "Carb cycling"],
                correct: "Carbs mainly in evening",
                explanation: "Eating most carbs post-workout/evening when insulin sensitivity may be higher.",
                xp_reward: 25
            },
            {
                question: "Grazing (constant snacking) vs meals?",
                options: ["Better for metabolism", "Worse - insulin always elevated", "Same if calories match", "Better for digestion"],
                correct: "Same if calories match",
                explanation: "Metabolism is the same, but constant eating may impair insulin sensitivity over time.",
                xp_reward: 25
            },
            {
                question: "Time-restricted eating (TRE) benefits?",
                options: ["Only calorie control", "May improve insulin sensitivity", "Magic fat loss", "None"],
                correct: "May improve insulin sensitivity",
                explanation: "TRE may provide benefits beyond calories: improved insulin, autophagy, circadian rhythm.",
                xp_reward: 25
            },
            {
                question: "Best meal frequency for muscle gain?",
                options: ["6 meals", "3-5 meals with protein each", "OMAD", "Doesn't matter"],
                correct: "3-5 meals with protein each",
                explanation: "3-5 meals with 20-40g protein each optimizes muscle protein synthesis throughout day.",
                xp_reward: 25
            },
            {
                question: "Eating late shifts circadian clock?",
                options: ["No effect", "Yes, may disrupt sleep/metabolism", "Only if high-carb", "Only if high-fat"],
                correct: "Yes, may disrupt sleep/metabolism",
                explanation: "Late eating can shift circadian rhythm, potentially impairing sleep and metabolic health.",
                xp_reward: 25
            },
            {
                question: "Warrior Diet (20:4) is sustainable?",
                options: ["For everyone", "Difficult for most, hard to hit protein", "Best approach", "Only for warriors"],
                correct: "Difficult for most, hard to hit protein",
                explanation: "20-hour fasts make hitting daily protein needs challenging and difficult to sustain long-term.",
                xp_reward: 25
            }
        ]
    }
];

async function seedLearn() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database...');

        console.log('Truncating learn_lessons table...');
        await client.query('TRUNCATE learn_lessons CASCADE');

        console.log('Seeding lessons...');

        for (const unit of LEARNING_LEVELS) {
            console.log(`Seeding unit: ${unit.name}`);

            const shuffledQuestions = unit.questions; // In real app, might want to shuffle

            // Insert questions as individual lessons
            for (let i = 0; i < shuffledQuestions.length; i++) {
                const q = shuffledQuestions[i];

                // Format options and correct answer for the schema
                // The schema expects a 'questions' JSONB array, but it seems originally designed for multiple questions per lesson? 
                // Or one lesson = one question?
                // Looking at routes/learn.js: 
                // router.get('/lessons/:id'...) returns result.rows[0].questions (array)
                // router.post('/attempt'...) iterates through questions array.
                // So a lesson can have multiple questions.

                // Strategy: Create 1 Lesson per 5 questions to group them logically?
                // OR distinct lessons for each topic?
                // The Eato data is just a flat list of questions per level.
                // Let's group them into chunks of 4-5 questions per "Lesson" node on the path.

            }

            // Group questions into chunks of 4
            const chunkSize = 4;
            for (let i = 0; i < shuffledQuestions.length; i += chunkSize) {
                const chunk = shuffledQuestions.slice(i, i + chunkSize);
                const lessonIndex = Math.floor(i / chunkSize) + 1;

                const lessonQuestions = chunk.map((q, idx) => ({
                    question: q.question,
                    options: q.options,
                    correct: q.correct
                }));

                await client.query(
                    `INSERT INTO learn_lessons 
           (title, unit, unit_title, order_index, description, content, questions, xp_reward)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        // Title
                        `${unit.name} - Part ${lessonIndex}`,
                        // Unit number
                        unit.id,
                        // Unit title
                        unit.name,
                        // Order index
                        lessonIndex,
                        // Description
                        `Master the basics of ${unit.name} (Part ${lessonIndex})`,
                        // Content
                        `# ${unit.name} - Part ${lessonIndex}\n\n## Introduction\nWelcome to part ${lessonIndex} of ${unit.name}. In this lesson, we will cover the key concepts needed to master this topic.\n\n## Key Concepts\n* Point 1: Understanding the basics.\n* Point 2: Applying knowledge to your diet.\n* Point 3: Consistency is key.\n\n## Summary\nReview the questions below to test your knowledge!`,
                        // Questions JSON
                        JSON.stringify(lessonQuestions),
                        // XP Reward
                        50
                    ]
                );
            }
        }

        console.log('✅ Seeding complete!');

    } catch (err) {
        console.error('❌ Seeding error:', err.message);
    } finally {
        await client.end();
        process.exit(0);
    }
}

seedLearn();
