-- Phase 16 migration: create custom inventories
-- Replaces the hardcoded category list with user-defined inventories.
-- Run this in the Supabase SQL editor before deploying the app changes.
--
-- Notes:
--   * The existing parts_inventory.category column is intentionally LEFT INTACT
--     as an archive of the pre-migration data. The app stops reading/writing
--     it after this migration; nothing is destroyed.
--   * inventory_id is nullable so existing rows remain valid post-migration
--     (NULL = "Uncategorized" in the UI).

CREATE TABLE IF NOT EXISTS inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to inventories"
  ON inventories FOR ALL
  USING (true)
  WITH CHECK (true);

ALTER TABLE parts_inventory
  ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES inventories(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS parts_inventory_inventory_id_idx
  ON parts_inventory (inventory_id);
