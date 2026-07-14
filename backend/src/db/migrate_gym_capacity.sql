-- Add capacity to gyms for occupancy-based crowd levels
-- Crowd light = active members in last 60 min vs capacity:
--   < 40% green (low) | 40–74% yellow (medium) | >= 75% red (high)

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 50;

-- Guard against nonsense values
ALTER TABLE gyms DROP CONSTRAINT IF EXISTS gyms_capacity_positive;
ALTER TABLE gyms ADD CONSTRAINT gyms_capacity_positive CHECK (capacity > 0);

COMMENT ON COLUMN gyms.capacity IS 'Max comfortable concurrent members — drives the green/yellow/red crowd indicator';
