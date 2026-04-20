import { useEffect, useState } from 'react'
import { CheckCircle2, Upload, Trash2, FileText, Plus, X, Image as ImageIcon } from 'lucide-react'
import Modal from '../ui/Modal'
import { computeServiceStatus } from '../../lib/serviceLogic'
import { supabase } from '../../lib/supabase'

const BUCKET = 'equipment-files'

const EDITABLE_FIELDS = [
  'hours',
  'site',
  'notes',
  'svc_override',
  'svc_done_at_hours',
  'kit_ordered',
  'kit_ordered_date',
  'svc_overdue',
  'telematics_issue',
  // Profile extensions
  'photo_url',
  'documents',
  'make',
  'model',
  'year',
  'bucket_size',
  'custom_fields',
  'product_link_radio',
  'product_link_radio_software',
  'product_link_ecm',
  'product_link_ecm_software',
  'wear_parts',
]

function pickEditable(unit) {
  if (!unit) return {}
  const out = {}
  for (const f of EDITABLE_FIELDS) {
    if (f === 'documents' || f === 'wear_parts' || f === 'custom_fields') {
      out[f] = Array.isArray(unit[f]) ? unit[f] : []
    } else {
      out[f] = unit[f] ?? (typeof unit[f] === 'boolean' ? false : '')
    }
  }
  return out
}

export default function EditUnitModal({ unit, sites, isOpen, onClose, onSave }) {
  const [form, setForm] = useState(() => pickEditable(unit))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setForm(pickEditable(unit))
    setError(null)
  }, [unit])

  if (!unit) return null

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function markServiceComplete() {
    const status = computeServiceStatus(unit)
    const label = status.intervalLabel || status.primary || ''
    const intervalMatch = label.match(/^(\d+HR)/i)
    const doneText = intervalMatch ? `${intervalMatch[1].toUpperCase()} Done` : 'Service Done'
    const currentHours =
      form.hours === '' || form.hours == null ? unit.hours : Number(form.hours)
    setForm((f) => ({
      ...f,
      svc_override: doneText,
      svc_done_at_hours: currentHours ?? null,
      kit_ordered: false,
      kit_ordered_date: '',
      svc_overdue: false,
    }))
  }

  function clearServiceComplete() {
    setForm((f) => ({
      ...f,
      svc_override: '',
      svc_done_at_hours: null,
    }))
  }

  const isDoneOverride =
    form.svc_override && /^\d+HR\s+Done\b/i.test(String(form.svc_override).trim())

  async function handleSave() {
    setSaving(true)
    setError(null)
    const changes = {
      hours: form.hours === '' || form.hours == null ? null : Number(form.hours),
      site: form.site || null,
      notes: form.notes ?? '',
      svc_override: form.svc_override === '' ? null : form.svc_override,
      svc_done_at_hours:
        form.svc_done_at_hours === '' || form.svc_done_at_hours == null
          ? null
          : Number(form.svc_done_at_hours),
      kit_ordered: !!form.kit_ordered,
      kit_ordered_date: form.kit_ordered_date || null,
      svc_overdue: !!form.svc_overdue,
      telematics_issue: !!form.telematics_issue,
      // Profile extensions
      photo_url: form.photo_url || null,
      documents: Array.isArray(form.documents) ? form.documents : [],
      make: form.make || null,
      model: form.model || null,
      year: form.year === '' || form.year == null ? null : Number(form.year),
      bucket_size: form.bucket_size || null,
      custom_fields: Array.isArray(form.custom_fields) ? form.custom_fields : [],
      product_link_radio: form.product_link_radio || null,
      product_link_radio_software: form.product_link_radio_software || null,
      product_link_ecm: form.product_link_ecm || null,
      product_link_ecm_software: form.product_link_ecm_software || null,
      wear_parts: Array.isArray(form.wear_parts) ? form.wear_parts : [],
    }
    const result = await onSave(unit.id, changes, unit)
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Save failed')
      return
    }
    onClose?.()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${unit.label}`}
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-display uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* ── Core section ─────────────────────────────── */}
        <Section title="Core">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Hours">
              <input
                type="number"
                value={form.hours ?? ''}
                onChange={(e) => update('hours', e.target.value)}
                className="w-full input-dark"
              />
            </Field>

            <Field label="Site">
              <select
                value={form.site || ''}
                onChange={(e) => update('site', e.target.value)}
                className="w-full input-dark"
              >
                <option value="">—</option>
                {sites?.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* ── Service section ─────────────────────────── */}
        <Section title="Service">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Service Override" hint="Manual label (e.g. CHECK SERVICE)">
              <input
                type="text"
                value={form.svc_override ?? ''}
                onChange={(e) => update('svc_override', e.target.value)}
                className="w-full input-dark"
              />
            </Field>

            <Field label="Kit Ordered Date">
              <input
                type="date"
                value={form.kit_ordered_date ?? ''}
                onChange={(e) => update('kit_ordered_date', e.target.value)}
                className="w-full input-dark"
              />
            </Field>

            <Field label="Service Completion" span={2}>
              <div className="flex flex-wrap items-center gap-3">
                <CheckboxField
                  label="Service completed (clear all tags)"
                  checked={isDoneOverride}
                  onChange={(v) => (v ? markServiceComplete() : clearServiceComplete())}
                />
                {isDoneOverride && (
                  <span className="inline-flex items-center gap-1 text-xs text-svc-green">
                    <CheckCircle2 size={13} />
                    {form.svc_override}
                  </span>
                )}
              </div>
            </Field>

            <Field label="Flags" span={2}>
              <div className="flex flex-wrap gap-5 pt-1">
                <CheckboxField
                  label="Kit ordered"
                  checked={!!form.kit_ordered}
                  onChange={(v) => update('kit_ordered', v)}
                />
                <CheckboxField
                  label="Force service overdue"
                  checked={!!form.svc_overdue}
                  onChange={(v) => update('svc_overdue', v)}
                />
                <CheckboxField
                  label="Telematics issue (manual hours)"
                  checked={!!form.telematics_issue}
                  onChange={(v) => update('telematics_issue', v)}
                />
              </div>
            </Field>
          </div>
        </Section>

        {/* ── Photo section ─────────────────────────── */}
        <Section title="Photo">
          <PhotoUploader
            unitId={unit.id}
            photoUrl={form.photo_url}
            onChange={(url) => update('photo_url', url)}
          />
        </Section>

        {/* ── Specs section ─────────────────────────── */}
        <Section title="Specs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Make">
              <input
                type="text"
                value={form.make ?? ''}
                onChange={(e) => update('make', e.target.value)}
                placeholder="e.g. CAT"
                className="w-full input-dark"
              />
            </Field>
            <Field label="Model">
              <input
                type="text"
                value={form.model ?? ''}
                onChange={(e) => update('model', e.target.value)}
                placeholder="e.g. 336F"
                className="w-full input-dark"
              />
            </Field>
            <Field label="Year">
              <input
                type="number"
                value={form.year ?? ''}
                onChange={(e) => update('year', e.target.value)}
                placeholder="e.g. 2019"
                className="w-full input-dark"
              />
            </Field>
            <Field label="Bucket Size">
              <input
                type="text"
                value={form.bucket_size ?? ''}
                onChange={(e) => update('bucket_size', e.target.value)}
                placeholder="e.g. 2.0 cu yd"
                className="w-full input-dark"
              />
            </Field>
          </div>
        </Section>

        {/* ── Product Link section ─────────────────── */}
        <Section title="Product Link (Telematics)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Radio">
              <input
                type="text"
                value={form.product_link_radio ?? ''}
                onChange={(e) => update('product_link_radio', e.target.value)}
                placeholder="e.g. PL542v2"
                className="w-full input-dark"
              />
            </Field>
            <Field label="Radio Software">
              <input
                type="text"
                value={form.product_link_radio_software ?? ''}
                onChange={(e) => update('product_link_radio_software', e.target.value)}
                placeholder="e.g. v4.12.3"
                className="w-full input-dark"
              />
            </Field>
            <Field label="ECM">
              <input
                type="text"
                value={form.product_link_ecm ?? ''}
                onChange={(e) => update('product_link_ecm', e.target.value)}
                placeholder="e.g. A4:M1"
                className="w-full input-dark"
              />
            </Field>
            <Field label="ECM Software">
              <input
                type="text"
                value={form.product_link_ecm_software ?? ''}
                onChange={(e) => update('product_link_ecm_software', e.target.value)}
                placeholder="e.g. 394-1054-05"
                className="w-full input-dark"
              />
            </Field>
          </div>
        </Section>

        {/* ── Documents section ─────────────────────── */}
        <Section title="Documents">
          <DocumentsUploader
            unitId={unit.id}
            documents={form.documents || []}
            onChange={(docs) => update('documents', docs)}
          />
        </Section>

        {/* ── Wear Parts section ────────────────────── */}
        <Section title="Wear Parts">
          <WearPartsEditor
            wearParts={form.wear_parts || []}
            onChange={(parts) => update('wear_parts', parts)}
          />
        </Section>

        {/* ── Custom Fields section ─────────────────── */}
        <Section title="Custom Fields">
          <CustomFieldsEditor
            customFields={form.custom_fields || []}
            onChange={(fields) => update('custom_fields', fields)}
          />
        </Section>

        {/* ── Notes section ─────────────────────────── */}
        <Section title="Notes">
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
            className="w-full input-dark resize-none"
          />
        </Section>
      </div>

      {error && (
        <div className="mt-4 text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          {error}
        </div>
      )}
    </Modal>
  )
}

// ── Sub-components ──────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-border">
        <div className="w-1 h-4 bg-cat-yellow rounded-sm" />
        <h4 className="font-display text-xs font-bold uppercase tracking-widest text-cat-yellow">
          {title}
        </h4>
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children, span = 1 }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted/70 mt-1">{hint}</p>}
    </div>
  )
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-dim">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-cat-yellow"
      />
      {label}
    </label>
  )
}

function PhotoUploader({ unitId, photoUrl, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    setError(null)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `photos/${unitId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true })
    if (upErr) {
      setError(upErr.message)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    onChange(data.publicUrl)
    setUploading(false)
  }

  async function handleClear() {
    // We don't bother deleting the file from storage here — just clear
    // the reference. Orphan cleanup can be a separate admin job later.
    onChange('')
  }

  return (
    <div className="flex gap-4 items-start">
      <div className="w-40 h-40 bg-black-soft border border-border rounded flex items-center justify-center overflow-hidden shrink-0">
        {photoUrl ? (
          <img src={photoUrl} alt="Unit" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={32} className="text-muted" />
        )}
      </div>
      <div className="flex-1 space-y-2">
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors cursor-pointer">
          <Upload size={12} /> {uploading ? 'Uploading…' : photoUrl ? 'Replace Photo' : 'Upload Photo'}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleUpload(e.target.files[0])}
            className="hidden"
          />
        </label>
        {photoUrl && (
          <button
            onClick={handleClear}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-svc-red/50 text-svc-red hover:bg-svc-red/10 rounded transition-colors"
          >
            <Trash2 size={12} /> Clear
          </button>
        )}
        {error && (
          <p className="text-svc-red text-xs">{error}</p>
        )}
        <p className="text-[11px] text-muted/70">
          JPG/PNG. Stored in Supabase. Click Save Changes after uploading.
        </p>
      </div>
    </div>
  )
}

function DocumentsUploader({ unitId, documents, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    setError(null)
    const safeName = file.name.replace(/[^\w.\-]/g, '_')
    const path = `documents/${unitId}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false })
    if (upErr) {
      setError(upErr.message)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const newDoc = {
      name: file.name,
      url: data.publicUrl,
      path,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    }
    onChange([...(documents || []), newDoc])
    setUploading(false)
  }

  function handleRemove(idx) {
    const doc = documents[idx]
    // Attempt storage delete; ignore errors (file may already be gone)
    if (doc?.path) {
      supabase.storage.from(BUCKET).remove([doc.path]).catch(() => {})
    }
    const next = documents.filter((_, i) => i !== idx)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 bg-black-soft border border-border rounded"
            >
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-text-dim hover:text-cat-yellow transition-colors min-w-0 truncate"
              >
                <FileText size={14} className="text-muted shrink-0" />
                <span className="truncate">{doc.name}</span>
                {doc.size && (
                  <span className="text-[11px] text-muted shrink-0">
                    ({Math.round(doc.size / 1024)} KB)
                  </span>
                )}
              </a>
              <button
                onClick={() => handleRemove(i)}
                type="button"
                className="text-muted hover:text-svc-red transition-colors p-1 shrink-0"
                title="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors cursor-pointer">
        <Upload size={12} /> {uploading ? 'Uploading…' : 'Add Document'}
        <input
          type="file"
          onChange={(e) => handleUpload(e.target.files[0])}
          className="hidden"
        />
      </label>
      {error && <p className="text-svc-red text-xs">{error}</p>}
      <p className="text-[11px] text-muted/70">
        PDF, image, or any file. Stored in Supabase.
      </p>
    </div>
  )
}

function WearPartsEditor({ wearParts, onChange }) {
  function addPart() {
    onChange([
      ...(wearParts || []),
      { name: '', part_number: '', last_replaced: '', notes: '' },
    ])
  }
  function updatePart(i, field, value) {
    const next = wearParts.map((p, idx) => (idx === i ? { ...p, [field]: value } : p))
    onChange(next)
  }
  function removePart(i) {
    onChange(wearParts.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {wearParts.length === 0 && (
        <p className="text-muted text-xs italic">No wear parts tracked.</p>
      )}
      {wearParts.map((part, i) => (
        <div
          key={i}
          className="grid grid-cols-12 gap-2 items-start bg-black-soft border border-border rounded p-2"
        >
          <input
            type="text"
            value={part.name}
            onChange={(e) => updatePart(i, 'name', e.target.value)}
            placeholder="Part name (e.g. cutting edge)"
            className="col-span-4 input-dark text-xs"
          />
          <input
            type="text"
            value={part.part_number}
            onChange={(e) => updatePart(i, 'part_number', e.target.value)}
            placeholder="Part #"
            className="col-span-3 input-dark font-mono text-xs"
          />
          <input
            type="date"
            value={part.last_replaced || ''}
            onChange={(e) => updatePart(i, 'last_replaced', e.target.value)}
            className="col-span-2 input-dark text-xs"
          />
          <input
            type="text"
            value={part.notes}
            onChange={(e) => updatePart(i, 'notes', e.target.value)}
            placeholder="Notes"
            className="col-span-2 input-dark text-xs"
          />
          <button
            onClick={() => removePart(i)}
            type="button"
            className="col-span-1 flex items-center justify-center text-muted hover:text-svc-red transition-colors py-1"
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={addPart}
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
      >
        <Plus size={12} /> Add Wear Part
      </button>
    </div>
  )
}

function CustomFieldsEditor({ customFields, onChange }) {
  function addField() {
    onChange([...(customFields || []), { label: '', value: '' }])
  }
  function updateField(i, field, value) {
    const next = customFields.map((f, idx) => (idx === i ? { ...f, [field]: value } : f))
    onChange(next)
  }
  function removeField(i) {
    onChange(customFields.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      {customFields.length === 0 && (
        <p className="text-muted text-xs italic">No custom fields.</p>
      )}
      {customFields.map((cf, i) => (
        <div
          key={i}
          className="grid grid-cols-12 gap-2 items-start bg-black-soft border border-border rounded p-2"
        >
          <input
            type="text"
            value={cf.label}
            onChange={(e) => updateField(i, 'label', e.target.value)}
            placeholder="Field label (e.g. Tire size)"
            className="col-span-5 input-dark text-xs"
          />
          <input
            type="text"
            value={cf.value}
            onChange={(e) => updateField(i, 'value', e.target.value)}
            placeholder="Value"
            className="col-span-6 input-dark text-xs"
          />
          <button
            onClick={() => removeField(i)}
            type="button"
            className="col-span-1 flex items-center justify-center text-muted hover:text-svc-red transition-colors py-1"
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={addField}
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
      >
        <Plus size={12} /> Add Custom Field
      </button>
    </div>
  )
}
