-- Phase 5 migration: create parts_inventory table
-- Run this in the Supabase SQL editor before using the Phase 5 inventory features.

CREATE TABLE IF NOT EXISTS parts_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Shop Supplies',
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_min INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10,2),
  vendor TEXT,
  location TEXT,
  compatible_equipment TEXT,
  last_ordered DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS with allow-all policy (matching existing tables)
ALTER TABLE parts_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to parts_inventory"
  ON parts_inventory FOR ALL
  USING (true)
  WITH CHECK (true);
