import { useEffect, useState } from 'react'
import { FileText, Trash2, CheckCircle2, RotateCcw, Clock, Info } from 'lucide-react'
import Modal from '../ui/Modal'
import InvoiceStatusBadge from './InvoiceStatusBadge'
import { getHoursForEquipmentOnDate } from '../../lib/equipmentHours'
import { standardizePo } from '../../lib/poFormat'

export default function InvoiceDetailModal({
  invoice,
  isOpen,
  onClose,
  onUpdate,
  onCloseInvoice,
  onReopenInvoice,
  onDelete,
  equipment = [],
}) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)
  // Hours-on-invoice-date lookup result. null = not yet looked up;
  // { hours, recorded_date, source } = found; { not_found: true } = no data.
  const [hoursLookup, setHoursLookup] = useState(null)
  const [hoursLooking, setHoursLooking] = useState(false)

  useEffect(() => {
    if (invoice) {
      setForm({
        invoice_number: invoice.invoice_number || '',
        invoice_date: invoice.invoice_date || '',
        vendor: invoice.vendor || '',
        total_amount: invoice.total_amount ?? '',
        equipment_id: invoice.equipment_id || '',
        description: invoice.description || '',
        notes: invoice.notes || '',
      })
      setError(null)
      setConfirmDelete(false)
      setHoursLookup(null)
    }
  }, [invoice])

  // Look up the unit's recorded SMU hours on the invoice date when both
  // the equipment and the invoice date are present.
  async function lookupHours() {
    if (!form.equipment_id || !form.invoice_date) return
    setHoursLooking(true)
    try {
      const result = await getHoursForEquipmentOnDate(
        form.equipment_id,
        form.invoice_date
      )
      setHoursLookup(result || { not_found: true })
    } finally {
      setHoursLooking(false)
    }
  }

  if (!invoice) return null

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const changes = {
      invoice_number: form.invoice_number.trim() || null,
      invoice_date: form.invoice_date || null,
      vendor: form.vendor.trim() || null,
      total_amount: form.total_amount === '' || form.total_amount == null ? null : Number(form.total_amount),
      equipment_id: form.equipment_id || null,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
    }
    const result = await onUpdate(invoice.id, changes, invoice)
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Save failed')
      return
    }
    onClose?.()
  }

  async function handleClose() {
    setSaving(true)
    setError(null)
    const result = await onCloseInvoice(invoice.id, invoice)
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Close failed')
    }
  }

  async function handleReopen() {
    setSaving(true)
    setError(null)
    const result = await onReopenInvoice(invoice.id, invoice)
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Reopen failed')
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    setError(null)
    const result = await onDelete(invoice.id, invoice)
    setDeleting(false)
    if (result?.error) {
      setError(result.error.message || 'Delete failed')
      return
    }
    onClose?.()
  }

  const title = invoice.invoice_number
    ? `Invoice: ${invoice.invoice_number}`
    : `Invoice: ${invoice.vendor || '—'}`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={saving || deleting}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider rounded transition-colors disabled:opacity-50 ${
                  confirmDelete
                    ? 'bg-svc-red text-white hover:bg-svc-red/80'
                    : 'border border-svc-red/50 text-svc-red hover:bg-svc-red/10'
                }`}
              >
                <Trash2 size={12} />
                {deleting ? 'Deleting…' : confirmDelete ? 'Click again to confirm' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving || deleting}
              className="px-4 py-1.5 text-sm font-display uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="px-4 py-1.5 text-sm font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      }
    >
      {/* Status bar + close/reopen */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
        <InvoiceStatusBadge status={invoice.status} />
        <div className="flex gap-2">
          {invoice.status === 'open' ? (
            <button
              onClick={handleClose}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-display font-semibold uppercase tracking-wider border rounded transition-colors disabled:opacity-50 bg-svc-green/20 text-svc-green border-svc-green/50 hover:bg-svc-green/30"
            >
              <CheckCircle2 size={12} /> Mark Closed
            </button>
          ) : (
            <button
              onClick={handleReopen}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-display font-semibold uppercase tracking-wider border rounded transition-colors disabled:opacity-50 bg-cat-yellow/20 text-cat-yellow border-cat-yellow/50 hover:bg-cat-yellow/30"
            >
              <RotateCcw size={12} /> Reopen
            </button>
          )}
        </div>
      </div>

      {/* PDF link + meta */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
        <div className="col-span-2">
          <p className="text-muted font-display uppercase tracking-wider mb-1">PDF</p>
          {invoice.pdf_url ? (
            <a
              href={invoice.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-text-dim hover:text-cat-yellow transition-colors"
            >
              <FileText size={13} />
              Open PDF in new tab
            </a>
          ) : (
            <p className="text-muted">—</p>
          )}
        </div>
        <MetaItem label="Closed" value={invoice.date_closed || '—'} />
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Invoice #">
          <input
            type="text"
            value={form.invoice_number}
            onChange={(e) => update('invoice_number', e.target.value)}
            className="w-full input-dark font-mono"
          />
        </Field>

        <Field label="Invoice Date">
          <input
            type="date"
            value={form.invoice_date}
            onChange={(e) => update('invoice_date', e.target.value)}
            className="w-full input-dark"
          />
        </Field>

        <Field label="Vendor">
          <input
            type="text"
            value={form.vendor}
            onChange={(e) => update('vendor', e.target.value)}
            className="w-full input-dark"
          />
        </Field>

        <Field label="Total ($)">
          <input
            type="number"
            step="0.01"
            value={form.total_amount}
            onChange={(e) => update('total_amount', e.target.value)}
            className="w-full input-dark"
          />
        </Field>

        <Field label="PO">
          <input
            type="text"
            value={standardizePo(invoice.po_raw) || ''}
            readOnly
            placeholder="—"
            className="w-full input-dark font-mono opacity-70 cursor-not-allowed"
            title={
              invoice.po_raw && invoice.po_raw !== standardizePo(invoice.po_raw)
                ? `As printed on invoice: ${invoice.po_raw}`
                : 'Extracted from invoice (read-only)'
            }
          />
        </Field>

        <Field label="Equipment">
          <select
            value={form.equipment_id}
            onChange={(e) => update('equipment_id', e.target.value)}
            className="w-full input-dark"
          >
            <option value="">— (optional)</option>
            {equipment.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description" span={2}>
          <input
            type="text"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Short label, e.g. 305 A-service kit"
            className="w-full input-dark"
          />
        </Field>

        <Field label="Notes" span={2}>
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
            className="w-full input-dark resize-none"
          />
        </Field>
      </div>

      {/* Hours-on-date lookup — interim feature while VisionLink API
          access is pending. Pulls from the equipment_hours_history
          ingested via the utilization-report importer. */}
      {form.equipment_id && form.invoice_date && (
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-muted" />
              <p className="text-[11px] font-display uppercase tracking-wider text-muted">
                Machine hours on {form.invoice_date}
              </p>
            </div>
            <button
              type="button"
              onClick={lookupHours}
              disabled={hoursLooking}
              className="px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors disabled:opacity-50"
            >
              {hoursLooking ? 'Looking…' : 'Look up'}
            </button>
          </div>
          {hoursLookup && !hoursLookup.not_found && (
            <p className="text-sm text-text-dim">
              <span className="font-mono text-text">{hoursLookup.hours}</span>{' '}
              hrs <span className="text-muted">(recorded {hoursLookup.recorded_date}, source: {hoursLookup.source})</span>
            </p>
          )}
          {hoursLookup?.not_found && (
            <p className="text-xs text-muted">
              No reading on file for this unit on or before {form.invoice_date}. Import a utilization report on the Reports page.
            </p>
          )}
        </div>
      )}

      {/* AI-extracted line items + explanations. */}
      {Array.isArray(invoice.line_items) && invoice.line_items.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-[11px] font-display uppercase tracking-wider text-muted mb-2">
            Line items <span className="text-muted/60">— extracted by AI</span>
          </p>
          <div className="space-y-2">
            {invoice.line_items.map((item, i) => (
              <LineItemRow key={i} item={item} />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          {error}
        </div>
      )}
    </Modal>
  )
}

function MetaItem({ label, value, mono }) {
  return (
    <div>
      <p className="text-muted font-display uppercase tracking-wider">{label}</p>
      <p className={`text-text-dim mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

// Single row in the AI-extracted line items list. Shows part number +
// description on the top line, with the AI-generated explanation below
// when present.
function LineItemRow({ item }) {
  const qty = item.qty != null ? `×${item.qty}` : null
  const total = item.line_total != null ? `$${Number(item.line_total).toFixed(2)}` : null
  return (
    <div className="bg-black-soft border border-border rounded px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {item.part_number && (
              <span className="font-mono text-xs text-cat-yellow">
                {item.part_number}
              </span>
            )}
            <span className="text-sm text-text-dim">
              {item.description || '—'}
            </span>
            {qty && <span className="text-[11px] text-muted">{qty}</span>}
          </div>
          {item.explanation && (
            <p className="text-[11px] text-muted mt-1 flex items-start gap-1">
              <Info size={10} className="mt-0.5 shrink-0" />
              <span>{item.explanation}</span>
            </p>
          )}
        </div>
        {total && (
          <span className="text-sm text-text-dim font-mono shrink-0">
            {total}
          </span>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, span = 1 }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}
