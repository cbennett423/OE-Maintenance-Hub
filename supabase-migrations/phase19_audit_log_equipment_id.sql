-- Phase 19: link audit_log entries to equipment by id instead of label.
--
-- The unit_label column on audit_log was a denormalized snapshot of the
-- equipment label at the time the entry was written. Renaming a unit
-- broke the audit history on the unit profile page (which queried by
-- label). This migration adds equipment_id so the link survives renames.
--
-- equipment.id is TEXT in the base schema (predates this repo's
-- migrations) — equipment_aliases uses TEXT too, so we match that. No
-- foreign key on purpose: audit_log is append-only and should retain
-- entries even if a piece of equipment is later deleted.

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS equipment_id TEXT;

-- Backfill: any existing entry whose unit_label still matches a current
-- equipment row gets linked. Entries for since-renamed or since-deleted
-- units stay unlinked (equipment_id NULL) — the unit_label column is
-- still there for human reference / global search.
UPDATE audit_log a
SET equipment_id = e.id
FROM equipment e
WHERE a.equipment_id IS NULL
  AND a.unit_label = e.label;

CREATE INDEX IF NOT EXISTS idx_audit_log_equipment_id
  ON audit_log(equipment_id);
