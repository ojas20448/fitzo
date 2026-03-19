-- Migration: Make gym_id nullable in attendances table
-- This allows auto-attendance creation from workout/calorie logging
-- without requiring a QR scan (which provides gym_id)

ALTER TABLE attendances ALTER COLUMN gym_id DROP NOT NULL;
