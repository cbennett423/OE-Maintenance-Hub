-- Phase 10 migration: add custom_fields to equipment
-- Lets Chase add arbitrary label/value pairs per unit.

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
