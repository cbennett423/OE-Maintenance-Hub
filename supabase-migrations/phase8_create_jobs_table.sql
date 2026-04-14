-- Phase 8 migration: create jobs table for site/address management
-- Lets Chase maintain the active job list with an address and job number.
-- equipment.site still references jobs by name (string) so no equipment
-- data needs to change.

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  job_number TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS with allow-all (matches other tables)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to jobs"
  ON jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Pre-populate with the existing active sites so nothing is missing
-- the first time Chase opens the Jobs section.
INSERT INTO jobs (name, active, sort_order)
VALUES
  ('DIA PREFLIGHT', true, 0),
  ('HUF8 OVERLOT/APS HORIZON', true, 1),
  ('COLUMBINE SQUARE', true, 2),
  ('4 MILE', true, 3),
  ('CCSD LAREDO', true, 4),
  ('BRONCOS TRAINING FACILITY', true, 5),
  ('CU CHAP', true, 6),
  ('CU RESIDENCE HALLS', true, 7),
  ('FT LUPTON STORAGE YARD', true, 8),
  ('OE SHOP', true, 9),
  ('FOX PARK', true, 10)
ON CONFLICT (name) DO NOTHING;
