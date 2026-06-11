-- Phase 20 migration: equipment hours recorded on an invoice.
--
-- Lets a user capture the unit's SMU/operating hours at the time of the
-- invoice directly on the invoice record. Distinct from the time-series
-- equipment_hours_history (phase 15): that table is the imported reading
-- history used for lookups, whereas this column is the value the user
-- attributes to this specific invoice (often hand-keyed from the work
-- order or the VisionLink "Look up" result shown in the detail modal).
--
--   equipment_hours  SMU value at the time of the invoice (NUMERIC 10,1)

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS equipment_hours NUMERIC(10, 1);
