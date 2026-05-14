-- Phase 17: track fire extinguisher install status on equipment.
-- Three-state field: not_required (default — covers skid steers, trucks,
-- and anything else that doesn't get a fire extinguisher), pending
-- (required, not yet installed), installed (mounted).
--
-- Default of not_required means no backfill is needed: existing rows all
-- start as N/A, and the user flips individual units to 'pending' as the
-- standardization rollout proceeds.

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS fire_extinguisher_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (fire_extinguisher_status IN ('not_required', 'pending', 'installed'));
