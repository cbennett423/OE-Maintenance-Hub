-- Phase 13 migration: extend work_orders for the accountability loop.
--
-- Adds the columns the OE Work Orders feature needs to:
--   - tie a work order to its source vendor invoice (work_order_id on invoices)
--   - track the MP Web sequential number a mechanic enters at closeout
--   - assign a real mechanic via FK (alongside the legacy text column)
--   - capture machine hours at closeout (auto from VisionLink or fallback)
--   - record who closed it and when
--
-- The legacy `assigned_mechanic` TEXT column is preserved for back-compat;
-- the new `assigned_mechanic_id` UUID column is the going-forward source of
-- truth. The UI writes both during a transitional period.
--
-- Existing status values ('open', 'in_progress', 'completed') remain valid.
-- New values are additive: 'pending_assignment', 'assigned', 'in_mp_web',
-- 'awaiting_hours', 'closed'. A CHECK constraint enforces the union.

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS mpw_wo_number BIGINT,
  ADD COLUMN IF NOT EXISTS assigned_mechanic_id UUID REFERENCES mechanics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS closed_machine_hours NUMERIC(10, 1),
  ADD COLUMN IF NOT EXISTS closed_machine_hours_source TEXT
    CHECK (closed_machine_hours_source IN ('visionlink_auto', 'visionlink_screenshot', 'manual', 'unknown')),
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'invoice', 'inbound_email'));

-- Status check constraint: union of legacy + new states. Drop-then-add so
-- this migration is idempotent if run partially before.
ALTER TABLE work_orders
  DROP CONSTRAINT IF EXISTS work_orders_status_check;

ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_status_check
  CHECK (status IN (
    'open', 'in_progress', 'completed',
    'pending_assignment', 'assigned', 'in_mp_web', 'awaiting_hours', 'closed'
  ));

CREATE INDEX IF NOT EXISTS idx_work_orders_mpw_wo_number ON work_orders(mpw_wo_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_mechanic_id ON work_orders(assigned_mechanic_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_closed_at ON work_orders(closed_at);

-- Link an invoice to the work order it produced. Nullable: an invoice may
-- arrive before its WO is created, and a manual WO may have no invoice.
-- ON DELETE SET NULL keeps invoice rows even if a WO is deleted.
-- TEXT type matches the existing work_orders.id column (client-generated
-- UUID strings stored as text rather than the native UUID type).
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS work_order_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_work_order_id ON invoices(work_order_id);
