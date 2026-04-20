import { useEffect, useState } from 'react'
import { Upload, FileText, X } from 'lucide-react'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'

const BUCKET = 'equipment-files'

function emptyForm() {
  return {
    invoice_number: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    vendor: 'Caterpillar',
    total_amount: '',
    mpw_wo_number: '',
    equipment_id: '',
    notes: '',
  }
}

export default function UploadInvoiceModal({
  isOpen,
  onClose,
  onCreate,
  equipment = [],
}) {
  const [form, setForm] = useState(emptyForm())
  const [invoiceId, setInvoiceId] = useState(() => crypto.randomUUID())
  const [pdf, setPdf] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm())
      setInvoiceId(crypto.randomUUID())
      setPdf(null)
      setError(null)
    }
  }, [isOpen])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    setError(null)
    const safeName = file.name.replace(/[^\w.\-]/g, '_')
    const path = `invoices/${invoiceId}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false })
    if (upErr) {
      setError(upErr.message)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    setPdf({
      name: file.name,
      url: data.publicUrl,
      path,
      size: file.size,
    })
    setUploading(false)
  }

  async function handleRemovePdf() {
    if (pdf?.path) {
      await supabase.storage.from(BUCKET).remove([pdf.path]).catch(() => {})
    }
    setPdf(null)
  }

  async function handleSave() {
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

  async function handleCancel() {
    if (pdf?.path) {
      await supabase.storage.from(BUCKET).remove([pdf.path]).catch(() => {})
    }
    onClose?.()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Upload Invoice"
      size="lg"
      footer={
        <>
          <button
            onClick={handleCancel}
            disabled={saving || uploading}
            className="px-4 py-1.5 text-sm font-display uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading || !pdf}
            className="px-4 py-1.5 text-sm font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Invoice'}
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
          <p className="text-[11px] text-muted/70 mt-1">
            PDF stored in Supabase under invoices/{invoiceId}/
          </p>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Invoice #">
            <input
              type="text"
              value={form.invoice_number}
              onChange={(e) => update('invoice_number', e.target.value)}
              placeholder="e.g. PIJ00001234"
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
              placeholder="0.00"
              className="w-full input-dark"
            />
          </Field>

          <Field label="MPW WO #">
            <input
              type="number"
              value={form.mpw_wo_number}
              onChange={(e) => update('mpw_wo_number', e.target.value)}
              placeholder="e.g. 1234567996"
              className="w-full input-dark font-mono"
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

          <Field label="Notes" span={2}>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className="w-full input-dark resize-none"
            />
          </Field>
        </div>

        {error && (
          <div className="text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
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
