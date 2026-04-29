import { useEffect, useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { parseInvoicePdf, preloadInvoicePdfParser } from '../../lib/parseInvoicePdf'
import { agentExtractInvoices } from '../../lib/invoiceIntakeAgent'

const BUCKET = 'equipment-files'

function emptyForm() {
  return {
    invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    vendor: 'Caterpillar',
    total_amount: '',
    mpw_wo_number: '',
    equipment_id: '',
    description: '',
    notes: '',
  }
}

function emptyRow(seed = {}) {
  return {
    selected: true,
    invoice_number: seed.invoiceNumber || '',
    invoice_date: seed.invoiceDate || '',
    mpw_wo_number: '',
    equipment_id: '',
    total_amount: seed.totalAmount != null ? String(seed.totalAmount) : '',
    description: '',
    notes: '',
    // po_raw is captured from the agent so the next step (po-matcher
    // confirmation UI) can suggest an equipment match. Not user-editable
    // in this modal — it's the vendor's PO field, kept verbatim.
    po_raw: seed.poRaw || null,
  }
}

export default function UploadInvoiceModal({
  isOpen,
  onClose,
  onCreate,
  equipment = [],
}) {
  // Shared state
  const [invoiceId, setInvoiceId] = useState(() => crypto.randomUUID())
  const [pdf, setPdf] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseSource, setParseSource] = useState(null) // 'regex' | 'agent' | null
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [vendor, setVendor] = useState('Caterpillar')

  // Single-invoice mode state
  const [form, setForm] = useState(emptyForm())

  // Multi-invoice mode state (rows > 1 means multi-mode UI)
  const [rows, setRows] = useState([])

  useEffect(() => {
    if (isOpen) {
      setInvoiceId(crypto.randomUUID())
      setPdf(null)
      setForm(emptyForm())
      setRows([])
      setVendor('Caterpillar')
      setError(null)
      setParseSource(null)
      // Warm pdfjs (~1MB) while the user is still picking a file
      preloadInvoicePdfParser()
    }
  }, [isOpen])

  const isMultiMode = rows.length > 1

  function updateForm(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function updateRow(i, field, value) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    setParsing(true)
    setParseSource(null)
    setError(null)
    const safeName = file.name.replace(/[^\w.\-]/g, '_')
    const path = `invoices/${invoiceId}/${Date.now()}_${safeName}`

    // Upload and parse concurrently — they're independent, so no reason
    // to make the user wait for the network round-trip before extracting
    // fields (or vice-versa).
    const uploadTask = (async () => {
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      setPdf({ name: file.name, url: data.publicUrl, path, size: file.size })
    })().finally(() => setUploading(false))

    // Parse path:
    //   1. Wagner-only regex (free, instant). If it returns 1+ invoices, use it.
    //   2. invoice-intake Edge Function (Claude Opus 4.7 + vision) as fallback
    //      for any other vendor or non-regex-matching layout.
    //   3. Silent fallback to manual entry if both fail.
    const parseTask = (async () => {
      let parsed = []
      try {
        parsed = await parseInvoicePdf(file)
      } catch {
        parsed = []
      }
      if (parsed.length > 0) {
        applyParsedInvoices(parsed)
        setParseSource('regex')
        return
      }
      // Regex didn't recognize it — try the agent.
      try {
        const agentParsed = await agentExtractInvoices(file)
        if (agentParsed.length > 0) {
          applyParsedInvoices(agentParsed)
          setParseSource('agent')
        }
      } catch (err) {
        console.warn('[invoice-intake] agent fallback failed', err)
        // Silent — user can still type manually.
      }
    })().finally(() => setParsing(false))

    try {
      await uploadTask
    } catch (err) {
      setError(err.message || 'Upload failed')
    }
    // Don't block on parseTask — it updates state on its own when done.
    parseTask
  }

  // Map a parsed invoice list (from either parser) onto form / rows.
  // Both sources expose the camelCase shape: { invoiceNumber, invoiceDate,
  // vendor?, totalAmount?, poRaw? }. The agent provides the extra fields;
  // the regex parser leaves them undefined.
  function applyParsedInvoices(parsed) {
    if (parsed.length >= 2) {
      setRows(parsed.map((p) => emptyRow(p)))
      // Bubble up vendor from the first invoice if the agent identified one
      // (multi-row UI applies one vendor to all rows).
      if (parsed[0]?.vendor) setVendor(parsed[0].vendor)
    } else if (parsed.length === 1) {
      const p = parsed[0]
      setForm((f) => ({
        ...f,
        invoice_number: p.invoiceNumber || f.invoice_number,
        invoice_date: p.invoiceDate || f.invoice_date,
        vendor: p.vendor || f.vendor,
        total_amount:
          p.totalAmount != null ? String(p.totalAmount) : f.total_amount,
      }))
    }
  }

  async function handleRemovePdf() {
    if (pdf?.path) {
      await supabase.storage.from(BUCKET).remove([pdf.path]).catch(() => {})
    }
    setPdf(null)
    setRows([])
    setForm(emptyForm())
  }

  async function handleCancel() {
    if (pdf?.path) {
      await supabase.storage.from(BUCKET).remove([pdf.path]).catch(() => {})
    }
    onClose?.()
  }

  async function handleSaveSingle() {
    if (!pdf) {
      setError('Please upload the invoice PDF first.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await onCreate({
      id: invoiceId,
      invoice_number: form.invoice_number.trim() || null,
      invoice_date: form.invoice_date || null,
      vendor: form.vendor.trim() || 'Caterpillar',
      total_amount: form.total_amount === '' ? null : Number(form.total_amount),
      mpw_wo_number: form.mpw_wo_number === '' ? null : Number(form.mpw_wo_number),
      equipment_id: form.equipment_id || null,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
      pdf_url: pdf.url,
      pdf_path: pdf.path,
    })
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Save failed')
      return
    }
    onClose?.()
  }

  async function handleSaveMulti() {
    if (!pdf) {
      setError('Please upload the invoice PDF first.')
      return
    }
    const selected = rows.filter((r) => r.selected)
    if (selected.length === 0) {
      setError('Select at least one invoice to save.')
      return
    }
    setSaving(true)
    setError(null)
    for (const row of selected) {
      // All records share the same pdf_url/pdf_path. Each gets its own id
      // generated inside createInvoice (we omit id here so the hook creates one).
      const result = await onCreate({
        invoice_number: row.invoice_number.trim() || null,
        invoice_date: row.invoice_date || null,
        vendor: vendor.trim() || 'Caterpillar',
        total_amount: row.total_amount === '' ? null : Number(row.total_amount),
        mpw_wo_number: row.mpw_wo_number === '' ? null : Number(row.mpw_wo_number),
        equipment_id: row.equipment_id || null,
        description: row.description.trim() || null,
        notes: row.notes.trim() || null,
        pdf_url: pdf.url,
        pdf_path: pdf.path,
      })
      if (result?.error) {
        setSaving(false)
        setError(`Saved ${rows.indexOf(row)} of ${selected.length}: ${result.error.message || 'error'}`)
        return
      }
    }
    setSaving(false)
    onClose?.()
  }

  const saveDisabled = saving || uploading || parsing || !pdf
  const saveHandler = isMultiMode ? handleSaveMulti : handleSaveSingle
  const saveLabel = saving
    ? 'Saving…'
    : isMultiMode
      ? `Save ${rows.filter((r) => r.selected).length} Invoices`
      : 'Save Invoice'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={isMultiMode ? `Upload Invoice — ${rows.length} Detected` : 'Upload Invoice'}
      size="lg"
      footer={
        <>
          <button
            onClick={handleCancel}
            disabled={saving || uploading || parsing}
            className="px-4 py-1.5 text-sm font-display uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveHandler}
            disabled={saveDisabled}
            className="px-4 py-1.5 text-sm font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
          >
            {saveLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* PDF uploader */}
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Invoice PDF
          </label>
          {pdf ? (
            <div className="flex items-center justify-between px-3 py-2 bg-black-soft border border-border rounded">
              <a
                href={pdf.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-text-dim hover:text-cat-yellow transition-colors min-w-0 truncate"
              >
                <FileText size={14} className="text-muted shrink-0" />
                <span className="truncate">{pdf.name}</span>
                {pdf.size && (
                  <span className="text-[11px] text-muted shrink-0">
                    ({Math.round(pdf.size / 1024)} KB)
                  </span>
                )}
              </a>
              <button
                type="button"
                onClick={handleRemovePdf}
                className="text-muted hover:text-svc-red transition-colors p-1 shrink-0"
                title="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors cursor-pointer">
              <Upload size={12} /> {uploading ? 'Uploading…' : 'Choose PDF'}
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => handleUpload(e.target.files[0])}
                className="hidden"
              />
            </label>
          )}
          {parsing && (
            <p className="text-[11px] text-muted mt-1">Reading invoice data from PDF…</p>
          )}
          {!parsing && parseSource === 'agent' && (
            <p className="text-[11px] text-muted mt-1">
              Extracted with AI assist (vendor not auto-recognized).
            </p>
          )}
        </div>

        {/* Mode branch */}
        {isMultiMode ? (
          <MultiInvoiceTable
            rows={rows}
            vendor={vendor}
            setVendor={setVendor}
            equipment={equipment}
            onRowChange={updateRow}
          />
        ) : (
          <SingleInvoiceForm
            form={form}
            onChange={updateForm}
            equipment={equipment}
          />
        )}

        {error && (
          <div className="text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}

function SingleInvoiceForm({ form, onChange, equipment }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Invoice #">
        <input
          type="text"
          value={form.invoice_number}
          onChange={(e) => onChange('invoice_number', e.target.value)}
          placeholder="e.g. AHC072415"
          className="w-full input-dark font-mono"
        />
      </Field>

      <Field label="Invoice Date">
        <input
          type="date"
          value={form.invoice_date}
          onChange={(e) => onChange('invoice_date', e.target.value)}
          className="w-full input-dark"
        />
      </Field>

      <Field label="Vendor">
        <input
          type="text"
          value={form.vendor}
          onChange={(e) => onChange('vendor', e.target.value)}
          className="w-full input-dark"
        />
      </Field>

      <Field label="Total ($)">
        <input
          type="number"
          step="0.01"
          value={form.total_amount}
          onChange={(e) => onChange('total_amount', e.target.value)}
          placeholder="0.00"
          className="w-full input-dark"
        />
      </Field>

      <Field label="MPW WO #">
        <input
          type="number"
          value={form.mpw_wo_number}
          onChange={(e) => onChange('mpw_wo_number', e.target.value)}
          placeholder="e.g. 1234567996"
          className="w-full input-dark font-mono"
        />
      </Field>

      <Field label="Equipment">
        <select
          value={form.equipment_id}
          onChange={(e) => onChange('equipment_id', e.target.value)}
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
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Short label, e.g. 305 A-service kit"
          className="w-full input-dark"
        />
      </Field>

      <Field label="Notes" span={2}>
        <textarea
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          rows={2}
          className="w-full input-dark resize-none"
        />
      </Field>
    </div>
  )
}

function MultiInvoiceTable({ rows, vendor, setVendor, equipment, onRowChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Vendor (applies to all)">
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            className="w-full input-dark"
          />
        </Field>
        <div className="flex items-end">
          <p className="text-xs text-muted">
            {rows.length} invoices detected. Uncheck any you don't want to import.
          </p>
        </div>
      </div>

      <div className="bg-black-soft border border-border rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-black-soft/50">
                <Th className="w-8"> </Th>
                <Th>Invoice #</Th>
                <Th>Description</Th>
                <Th>Date</Th>
                <Th>Equipment</Th>
                <Th>MPW WO #</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) => onRowChange(i, 'selected', e.target.checked)}
                      className="accent-cat-yellow"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.invoice_number}
                      onChange={(e) => onRowChange(i, 'invoice_number', e.target.value)}
                      className="w-full input-dark font-mono text-xs py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => onRowChange(i, 'description', e.target.value)}
                      placeholder="Short label"
                      className="w-full input-dark text-xs py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="date"
                      value={row.invoice_date}
                      onChange={(e) => onRowChange(i, 'invoice_date', e.target.value)}
                      className="w-full input-dark text-xs py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <select
                      value={row.equipment_id}
                      onChange={(e) => onRowChange(i, 'equipment_id', e.target.value)}
                      className="w-full input-dark text-xs py-1"
                    >
                      <option value="">—</option>
                      {equipment.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      value={row.mpw_wo_number}
                      onChange={(e) => onRowChange(i, 'mpw_wo_number', e.target.value)}
                      className="w-full input-dark font-mono text-xs py-1"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={row.total_amount}
                      onChange={(e) => onRowChange(i, 'total_amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full input-dark text-xs py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

function Th({ children, className = '' }) {
  return (
    <th
      className={`px-3 py-2 text-left font-display font-semibold uppercase tracking-wider text-muted text-[10px] ${className}`}
    >
      {children}
    </th>
  )
}
