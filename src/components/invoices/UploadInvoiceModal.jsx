import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, X, Sparkles, Check, Scissors } from 'lucide-react'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { agentExtractInvoices } from '../../lib/invoiceIntakeAgent'
import {
  matchPo,
  fetchAliasesForVendor,
  PO_MATCH_AUTO_THRESHOLD,
} from '../../lib/poMatcher'
import { extractPagesAsBlob, pageRangeCoversWholePdf } from '../../lib/splitPdf'

const BUCKET = 'equipment-files'

// Single-invoice form shape. po_raw + line_items are populated by the
// invoice-intake agent and persisted to the invoices row on save.
// pdf_url / pdf_path are optionally overridden when the agent reports
// a sub-range (i.e. the PDF was bigger than just this invoice).
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
    po_raw: null,
    line_items: [],
    page_range: null, // [start, end], 1-indexed
    pdf_url: null, // split-pdf URL when present, else fall back to shared pdf
    pdf_path: null,
    match: null, // { equipment_id, confidence, source, reasoning }
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
    po_raw: seed.poRaw || null,
    line_items: seed.lineItems || [],
    page_range: seed.pageRange || null,
    pdf_url: null,
    pdf_path: null,
    match: null,
  }
}

export default function UploadInvoiceModal({
  isOpen,
  onClose,
  onCreate,
  equipment = [],
}) {
  const [invoiceId, setInvoiceId] = useState(() => crypto.randomUUID())
  const [pdf, setPdf] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [matching, setMatching] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [vendor, setVendor] = useState('Caterpillar')

  const [form, setForm] = useState(emptyForm())
  const [rows, setRows] = useState([])

  // Refs that don't need to drive re-renders. sourceFileRef holds the
  // user-picked File while we run the agent + splitter; uploadedPathsRef
  // tracks every storage object we've created in this session so we can
  // clean them all up on cancel/replace.
  const sourceFileRef = useRef(null)
  const uploadedPathsRef = useRef([])

  useEffect(() => {
    if (isOpen) {
      setInvoiceId(crypto.randomUUID())
      setPdf(null)
      setForm(emptyForm())
      setRows([])
      setVendor('Caterpillar')
      setError(null)
      sourceFileRef.current = null
      uploadedPathsRef.current = []
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
    setError(null)
    sourceFileRef.current = file
    const safeName = file.name.replace(/[^\w.\-]/g, '_')
    const path = `invoices/${invoiceId}/${Date.now()}_${safeName}`

    // Upload original and run agent concurrently — they're independent.
    const uploadTask = (async () => {
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false })
      if (upErr) throw upErr
      uploadedPathsRef.current.push(path)
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      setPdf({ name: file.name, url: data.publicUrl, path, size: file.size })
    })().finally(() => setUploading(false))

    // Always run the AI agent — Wagner is the dominant case and the agent
    // is the only path that captures po_raw + line_items + explanations.
    const parseTask = (async () => {
      try {
        const parsed = await agentExtractInvoices(file)
        if (parsed.length > 0) {
          // applyParsedInvoices fills the form/rows + kicks off po-matcher.
          // splitAndUploadInvoices runs in parallel; each invoice gets its
          // own single-page PDF so mechanics can attach the right one to
          // its work order in MP Web without flipping through a batched PDF.
          applyParsedInvoices(parsed)
          splitAndUploadInvoices(file, parsed, safeName)
        }
      } catch (err) {
        console.warn('[invoice-intake] extraction failed', err)
        // Silent — user can still type manually.
      }
    })().finally(() => setParsing(false))

    try {
      await uploadTask
    } catch (err) {
      setError(err.message || 'Upload failed')
    }
    parseTask
  }

  // Splits the source PDF into per-invoice PDFs based on each agent
  // record's page_range. Each split is uploaded to storage and its URL is
  // written back to the corresponding row (or form, in single mode). On
  // failure the row falls back to the original PDF on save.
  async function splitAndUploadInvoices(file, parsed, safeName) {
    if (!file || !parsed || parsed.length === 0) return
    // Single invoice that already covers the whole PDF → nothing to split.
    if (parsed.length === 1 && parsed[0]?.pageRange) {
      try {
        const whole = await pageRangeCoversWholePdf(file, parsed[0].pageRange)
        if (whole) return
      } catch {
        // Fall through and attempt a split; worst case we end up with a
        // duplicate of the original.
      }
    }

    setSplitting(true)
    try {
      for (let i = 0; i < parsed.length; i++) {
        const p = parsed[i]
        if (!p.pageRange) continue
        const [start, end] = p.pageRange
        let blob
        try {
          blob = await extractPagesAsBlob(file, start, end)
        } catch (err) {
          console.warn(`[splitPdf] extract failed for invoice ${i + 1}`, err)
          continue
        }
        const path = `invoices/${invoiceId}/p${start}-${end}_${i}_${Date.now()}_${safeName}`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { upsert: false, contentType: 'application/pdf' })
        if (upErr) {
          console.warn(`[splitPdf] upload failed for ${path}`, upErr)
          continue
        }
        uploadedPathsRef.current.push(path)
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        if (parsed.length >= 2) {
          setRows((rs) =>
            rs.map((r, idx) =>
              idx === i ? { ...r, pdf_url: data.publicUrl, pdf_path: path } : r
            )
          )
        } else {
          setForm((f) => ({ ...f, pdf_url: data.publicUrl, pdf_path: path }))
        }
      }
    } finally {
      setSplitting(false)
    }
  }

  // Apply parsed invoices to form/rows, then run po-matcher to suggest
  // equipment for each.
  async function applyParsedInvoices(parsed) {
    if (parsed.length >= 2) {
      const newRows = parsed.map((p) => emptyRow(p))
      setRows(newRows)
      if (parsed[0]?.vendor) setVendor(parsed[0].vendor)
      runMatchersForRows(newRows, parsed[0]?.vendor)
    } else if (parsed.length === 1) {
      const p = parsed[0]
      setForm((f) => ({
        ...f,
        invoice_number: p.invoiceNumber || f.invoice_number,
        invoice_date: p.invoiceDate || f.invoice_date,
        vendor: p.vendor || f.vendor,
        total_amount:
          p.totalAmount != null ? String(p.totalAmount) : f.total_amount,
        po_raw: p.poRaw || null,
        line_items: p.lineItems || [],
        page_range: p.pageRange || null,
      }))
      runMatcherForSingle(p.poRaw, p.vendor)
    }
  }

  async function runMatcherForSingle(po_raw, vendorHint) {
    if (!po_raw) return
    setMatching(true)
    try {
      const aliases = await fetchAliasesForVendor(vendorHint)
      const result = await matchPo({
        po_raw,
        vendor: vendorHint,
        equipment,
        aliases,
      })
      if (!result || !result.equipment_id) {
        setForm((f) => ({ ...f, match: result || null }))
        return
      }
      setForm((f) => ({
        ...f,
        match: result,
        // Auto-fill equipment when confidence is high enough.
        equipment_id:
          result.confidence >= PO_MATCH_AUTO_THRESHOLD && !f.equipment_id
            ? result.equipment_id
            : f.equipment_id,
      }))
    } finally {
      setMatching(false)
    }
  }

  async function runMatchersForRows(seedRows, vendorHint) {
    setMatching(true)
    try {
      const aliases = await fetchAliasesForVendor(vendorHint)
      // Run sequentially to keep order deterministic and to avoid spamming
      // the Edge Function. Each match is fast (<1s for tier 1/2, ~3s for LLM).
      for (let i = 0; i < seedRows.length; i++) {
        const seed = seedRows[i]
        if (!seed.po_raw) continue
        const result = await matchPo({
          po_raw: seed.po_raw,
          vendor: vendorHint,
          equipment,
          aliases,
        })
        setRows((rs) =>
          rs.map((r, idx) => {
            if (idx !== i) return r
            const autofill =
              result?.equipment_id &&
              result.confidence >= PO_MATCH_AUTO_THRESHOLD &&
              !r.equipment_id
            return {
              ...r,
              match: result || null,
              equipment_id: autofill ? result.equipment_id : r.equipment_id,
            }
          })
        )
      }
    } finally {
      setMatching(false)
    }
  }

  // User accepts the suggested match below the auto-threshold.
  function acceptSuggestion() {
    setForm((f) =>
      f.match?.equipment_id
        ? { ...f, equipment_id: f.match.equipment_id }
        : f
    )
  }

  function acceptRowSuggestion(i) {
    setRows((rs) =>
      rs.map((r, idx) =>
        idx === i && r.match?.equipment_id
          ? { ...r, equipment_id: r.match.equipment_id }
          : r
      )
    )
  }

  // Remove every storage object we wrote in this session — original +
  // any per-invoice splits — not just the original.
  async function cleanupAllUploads() {
    const paths = uploadedPathsRef.current
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths).catch(() => {})
    }
    uploadedPathsRef.current = []
    sourceFileRef.current = null
  }

  async function handleRemovePdf() {
    await cleanupAllUploads()
    setPdf(null)
    setRows([])
    setForm(emptyForm())
  }

  async function handleCancel() {
    await cleanupAllUploads()
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
      // Prefer the agent-split single-invoice PDF; fall back to original.
      pdf_url: form.pdf_url || pdf.url,
      pdf_path: form.pdf_path || pdf.path,
      po_raw: form.po_raw || null,
      line_items: form.line_items || [],
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
      const result = await onCreate({
        invoice_number: row.invoice_number.trim() || null,
        invoice_date: row.invoice_date || null,
        vendor: vendor.trim() || 'Caterpillar',
        total_amount: row.total_amount === '' ? null : Number(row.total_amount),
        mpw_wo_number: row.mpw_wo_number === '' ? null : Number(row.mpw_wo_number),
        equipment_id: row.equipment_id || null,
        description: row.description.trim() || null,
        notes: row.notes.trim() || null,
        // Prefer the per-invoice split PDF; fall back to the original
        // batched PDF if splitting failed for this row.
        pdf_url: row.pdf_url || pdf.url,
        pdf_path: row.pdf_path || pdf.path,
        po_raw: row.po_raw || null,
        line_items: row.line_items || [],
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

  const saveDisabled = saving || uploading || parsing || splitting || !pdf
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
            <p className="text-[11px] text-muted mt-1 flex items-center gap-1">
              <Sparkles size={11} className="text-cat-yellow animate-pulse" />
              Reading invoice with AI…
            </p>
          )}
          {!parsing && splitting && (
            <p className="text-[11px] text-muted mt-1 flex items-center gap-1">
              <Scissors size={11} className="text-cat-yellow animate-pulse" />
              Splitting PDF into per-invoice files…
            </p>
          )}
          {!parsing && !splitting && matching && (
            <p className="text-[11px] text-muted mt-1 flex items-center gap-1">
              <Sparkles size={11} className="text-cat-yellow animate-pulse" />
              Matching PO to equipment…
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
            onAcceptSuggestion={acceptRowSuggestion}
          />
        ) : (
          <SingleInvoiceForm
            form={form}
            onChange={updateForm}
            equipment={equipment}
            onAcceptSuggestion={acceptSuggestion}
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

function SingleInvoiceForm({ form, onChange, equipment, onAcceptSuggestion }) {
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
        <MatchHint
          match={form.match}
          poRaw={form.po_raw}
          equipment={equipment}
          equipmentId={form.equipment_id}
          onAccept={onAcceptSuggestion}
        />
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

function MultiInvoiceTable({
  rows,
  vendor,
  setVendor,
  equipment,
  onRowChange,
  onAcceptSuggestion,
}) {
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
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) => onRowChange(i, 'selected', e.target.checked)}
                      className="accent-cat-yellow"
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
                    <input
                      type="text"
                      value={row.invoice_number}
                      onChange={(e) => onRowChange(i, 'invoice_number', e.target.value)}
                      className="w-full input-dark font-mono text-xs py-1"
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
                    <input
                      type="text"
                      value={row.description}
                      onChange={(e) => onRowChange(i, 'description', e.target.value)}
                      placeholder="Short label"
                      className="w-full input-dark text-xs py-1"
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
                    <input
                      type="date"
                      value={row.invoice_date}
                      onChange={(e) => onRowChange(i, 'invoice_date', e.target.value)}
                      className="w-full input-dark text-xs py-1"
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
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
                    <MatchHint
                      match={row.match}
                      poRaw={row.po_raw}
                      equipment={equipment}
                      equipmentId={row.equipment_id}
                      onAccept={() => onAcceptSuggestion(i)}
                      compact
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
                    <input
                      type="number"
                      value={row.mpw_wo_number}
                      onChange={(e) => onRowChange(i, 'mpw_wo_number', e.target.value)}
                      className="w-full input-dark font-mono text-xs py-1"
                    />
                  </td>
                  <td className="px-2 py-1 align-top">
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

// Renders the po-matcher result inline near the equipment dropdown:
//   - High confidence + dropdown filled → "Auto-matched: PO 'X' → label (95%)"
//   - Low/medium confidence + dropdown empty → "Suggested: label (60%) [Use this]"
//   - No match → nothing
function MatchHint({ match, poRaw, equipment, equipmentId, onAccept, compact }) {
  if (!match || !match.equipment_id) return null
  const unit = equipment.find((u) => u.id === match.equipment_id)
  if (!unit) return null
  const pct = Math.round((match.confidence ?? 0) * 100)
  const isFilled = equipmentId === match.equipment_id
  const cls = compact ? 'text-[10px] mt-1' : 'text-[11px] mt-1.5'

  if (isFilled) {
    return (
      <p className={`${cls} text-svc-green flex items-center gap-1`}>
        <Check size={10} />
        {match.source === 'alias'
          ? `Matched alias`
          : match.source === 'normalized'
            ? `Auto-matched`
            : `AI-matched`}
        : "{poRaw}" → {unit.label} ({pct}%)
      </p>
    )
  }

  return (
    <div className={`${cls} text-cat-yellow flex items-center gap-2`}>
      <span>
        Suggested: {unit.label} ({pct}%)
      </span>
      <button
        type="button"
        onClick={onAccept}
        className="px-1.5 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider border border-cat-yellow/50 text-cat-yellow rounded hover:bg-cat-yellow/10 transition-colors"
      >
        Use
      </button>
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
