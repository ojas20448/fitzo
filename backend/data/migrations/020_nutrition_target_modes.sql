-- Preserve the distinction between suggested and explicitly edited targets.
-- NULL denotes a legacy record, whose origin cannot be known with certainty.
ALTER TABLE nutrition_profiles
    ADD COLUMN IF NOT EXISTS calorie_target_mode TEXT CHECK (calorie_target_mode IN ('automatic', 'custom')),
    ADD COLUMN IF NOT EXISTS macro_target_mode TEXT CHECK (macro_target_mode IN ('automatic', 'custom')),
    ADD COLUMN IF NOT EXISTS target_formula_version INTEGER;
-- No existing targets are changed by this schema migration.
-- Preview the separate repair script before applying any data changes.
ALTER TABLE nutrition_profiles ALTER COLUMN activity_level SET DEFAULT 'sedentary';
