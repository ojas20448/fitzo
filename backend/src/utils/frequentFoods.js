// Keep nutrition and portion from ONE actual entry. Mixing averages with a
// previous serving label can silently over- or under-count a repeat meal.
const FREQUENT_FOODS_SQL = `
    WITH ranked AS (
        SELECT id, food_name, calories, protein, carbs, fat, serving_size,
               meal_type, is_estimate, created_at,
               COUNT(*) OVER (PARTITION BY food_name) AS usage_count,
               ROW_NUMBER() OVER (
                   PARTITION BY food_name ORDER BY created_at DESC, id DESC
               ) AS position
        FROM calorie_logs
        WHERE user_id = $1 AND food_name IS NOT NULL AND TRIM(food_name) <> ''
    )
    SELECT id AS entry_id, food_name AS name, calories, protein, carbs, fat,
           serving_size, meal_type, is_estimate, created_at AS last_logged_at,
           usage_count
    FROM ranked WHERE position = 1
    ORDER BY usage_count DESC, created_at DESC, id DESC
    LIMIT $2`;

module.exports = { FREQUENT_FOODS_SQL };
