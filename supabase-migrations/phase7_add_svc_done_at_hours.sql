-- Phase 7 migration: add svc_done_at_hours to equipment table
-- Stores the hours at the time a service was marked complete.
-- Used by computeServiceStatus to auto-expire "XXXHR Done" tags once
-- the unit's hours cross the corresponding interval mark.

ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS svc_done_at_hours INTEGER;
