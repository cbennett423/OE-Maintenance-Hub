-- Phase 11 migration: create invoices table for the Open Invoices tab.
-- Stores CAT (and other vendor) invoice PDFs and the metadata needed
-- to track which invoices are "open paperwork" tied to work in progress.
-- PDFs live in the existing equipment-files storage bucket under
-- the invoices/{id}/... path prefix.
--
-- Source of truth for work orders remains Maintenance Pro Web (MPW).
-- The mpw_wo_number column references MPW's integer sequential_id.
-- The mpw_* sync columns are scaffolded now so a future Phase 2 can
-- push invoice data into MPW via POST /receipts without a new migration.

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT,
  invoice_date DATE,
  vendor TEXT DEFAULT 'Caterpillar',
  total_amount NUMERIC(10, 2),
  pdf_url TEXT,
  pdf_path TEXT,
  mpw_wo_number BIGINT,
  equipment_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  description TEXT,
  notes TEXT,
  date_closed DATE,
  mpw_receipt_api_key TEXT,
  mpw_synced_at TIMESTAMPTZ,
  mpw_sync_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to invoices"
  ON invoices FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_mpw_wo_number ON invoices(mpw_wo_number);
CREATE INDEX IF NOT EXISTS idx_invoices_equipment_id ON invoices(equipment_id);
