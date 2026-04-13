-- Phase 2 migration: add telematics_issue flag to equipment table
-- Run this in the Supabase SQL editor before using the Phase 2 equipment features.
-- This lets Chase flag any unit whose VisionLink reading can't be trusted
-- (hours should be maintained manually).

ALTER TABLE equipment
ADD COLUMN IF NOT EXISTS telematics_issue BOOLEAN NOT NULL DEFAULT false;

-- Optional: pre-flag the 5 known problem units mentioned in the handoff doc
-- Uncomment to apply:
-- UPDATE equipment SET telematics_issue = true WHERE serial IN (
--   'SWL00170',   -- 938K — VisionLink stale since 5/28/24
--   'ASN00170',   -- CP 433E — hour meter changed
--   'CRD02423',   -- 938G — VisionLink reading low
--   'HEN05206',   -- 236B — stale since 10/11/22
--   'AT89A00137'  -- GC60K Fork — no VisionLink hours
-- );
