-- Phase 15 migration: time-series equipment hours history.
--
-- Interim solution while VisionLink API access is pending. Stores daily SMU
-- readings imported from a manually-pulled VisionLink utilization report so
-- we can answer "what were unit 225's hours on 2026-03-15?" — needed to
-- back-fill closed_machine_hours on a work order from its invoice date.
--
-- Columns:
--   equipment_id   FK to equipment(id) (TEXT — matches existing schema)
--   recorded_date  the date the reading is for (DATE, no time component)
--   hours          SMU value as of that date (NUMERIC 10,1)
--   source         'utilization_report' | 'visionlink_api' | 'manual'
--                  — when VisionLink API access lands, the importer for that
--                  feed writes rows with source='visionlink_api' and the
--                  lookup helper transparently uses whichever is fresher.
--   created_at, created_by   audit
--
-- Uniqueness: (equipment_id, recorded_date) — one reading per unit per day.
-- Re-importing the same day overwrites via ON CONFLICT in the loader.

CREATE TABLE IF NOT EXISTS equipment_hours_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id TEXT NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  recorded_date DATE NOT NULL,
  hours NUMERIC(10, 1) NOT NULL,
  source TEXT NOT NULL DEFAULT 'utilization_report'
    CHECK (source IN ('utilization_report', 'visionlink_api', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT
);

ALTER TABLE equipment_hours_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to equipment_hours_history"
  ON equipment_hours_history;
CREATE POLICY "Allow all access to equipment_hours_history"
  ON equipment_hours_history FOR ALL
  USING (true)
  WITH CHECK (true);

-- One row per (equipment, date). Re-imports update via the upsert path.
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_hours_history_unit_date
  ON equipment_hours_history(equipment_id, recorded_date);

-- Lookup helper queries: most recent reading on-or-before a given date for
-- a given unit. The composite index supports the descending range scan.
CREATE INDEX IF NOT EXISTS idx_equipment_hours_history_lookup
  ON equipment_hours_history(equipment_id, recorded_date DESC);
