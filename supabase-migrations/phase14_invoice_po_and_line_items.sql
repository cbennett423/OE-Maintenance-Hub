-- Phase 14 migration: capture the agent-extracted PO and line items on each invoice.
--
-- po_raw  — the vendor's freeform PO/customer-reference field, kept verbatim.
--           Source of truth for the equipment_aliases learning loop. The
--           upload flow runs po-matcher against this value to suggest an
--           equipment_id; on user confirmation we write a row to
--           equipment_aliases linking po_raw -> equipment_id (vendor-scoped).
--
-- line_items — array of { description, qty, unit_price, line_total,
--              part_number?, explanation? } extracted by the invoice-intake
--              agent. Used by InvoiceDetailModal to render parts + AI
--              explanations. Stored as JSONB so we can query/index later.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS po_raw TEXT,
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_invoices_po_raw ON invoices(po_raw);
