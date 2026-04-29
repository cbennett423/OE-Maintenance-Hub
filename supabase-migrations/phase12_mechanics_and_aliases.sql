-- Phase 12 migration: mechanics master table and equipment_aliases learning table.
--
-- Replaces the hardcoded MECHANICS list in src/components/workorders/CreateWOModal.jsx
-- with a real table that work_orders can FK against. Also creates the
-- equipment_aliases table so the new po-matcher Edge Function can learn from
-- every confirmed PO -> equipment match (e.g. when a vendor types "CAT-225D"
-- on the PO line, the next time that exact string shows up it's an instant
-- 1.0-confidence hit instead of another LLM call).
--
-- Both tables follow the existing RLS pattern (allow-all) used in
-- phase11_create_invoices.sql until a per-role policy is rolled out.

CREATE TABLE IF NOT EXISTS mechanics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  mp_web_username TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mechanics ENABLE ROW LEVEL SECURITY;

-- Idempotent: CREATE POLICY has no IF NOT EXISTS clause in standard Postgres,
-- so drop-then-create lets this migration be safely re-run.
DROP POLICY IF EXISTS "Allow all access to mechanics" ON mechanics;
CREATE POLICY "Allow all access to mechanics"
  ON mechanics FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mechanics_active ON mechanics(active);

-- Seed the existing placeholder list so any historical work_orders rows
-- whose `assigned_mechanic` text matches one of these names can be linked
-- by name in a follow-up data backfill if desired.
INSERT INTO mechanics (name, active, sort_order)
VALUES
  ('Tim', true, 10),
  ('Mechanic 2', true, 20),
  ('Mechanic 3', true, 30)
ON CONFLICT (name) DO NOTHING;

-- equipment_aliases: every confirmed match between a vendor's freeform PO
-- string and a piece of equipment. Populated by the UI when a user confirms
-- a fuzzy match suggested by the po-matcher agent, and queryable by the
-- po-matcher on subsequent invoices to short-circuit the LLM call.
CREATE TABLE IF NOT EXISTS equipment_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  po_raw TEXT NOT NULL,
  po_normalized TEXT NOT NULL,
  vendor TEXT,
  source TEXT NOT NULL DEFAULT 'confirmed_match'
    CHECK (source IN ('confirmed_match', 'manual', 'seeded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

ALTER TABLE equipment_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to equipment_aliases" ON equipment_aliases;
CREATE POLICY "Allow all access to equipment_aliases"
  ON equipment_aliases FOR ALL
  USING (true)
  WITH CHECK (true);

-- Lookup paths:
--   1. Exact raw PO match (vendor-specific): used to short-circuit a known
--      vendor quirk like "CAT-225D" -> equipment 225.
--   2. Normalized PO match (vendor-agnostic): digits-only / common-prefix-
--      stripped form. Catches "Unit 225" and "225" alike.
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_aliases_raw_vendor
  ON equipment_aliases(po_raw, COALESCE(vendor, ''));
CREATE INDEX IF NOT EXISTS idx_equipment_aliases_normalized
  ON equipment_aliases(po_normalized);
CREATE INDEX IF NOT EXISTS idx_equipment_aliases_equipment
  ON equipment_aliases(equipment_id);
