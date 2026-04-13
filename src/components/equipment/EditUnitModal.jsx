import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'

const EDITABLE_FIELDS = [
  'hours',
  'site',
  'notes',
  'svc_override',
  'kit_ordered',
  'kit_ordered_date',
  'svc_overdue',
  'telematics_issue',
]

function pickEditable(unit) {
  if (!unit) return {}
  const out = {}
  for (const f of EDITABLE_FIELDS) {
    out[f] = unit[f] ?? (typeof unit[f] === 'boolean' ? false : '')
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

  async function handleSave() {
    setSaving(true)
    setError(null)
    // Build changes payload with proper types
    const changes = {
      hours: form.hours === '' || form.hours == null ? null : Number(form.hours),
      site: form.site || null,
      notes: form.notes ?? '',
      svc_override: form.svc_override === '' ? null : form.svc_override,
      kit_ordered: !!form.kit_ordered,
      kit_ordered_date: form.kit_ordered_date || null,
      svc_overdue: !!form.svc_overdue,
      telematics_issue: !!form.telematics_issue,
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
      <div className="grid grid-cols-2 gap-4">
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

        <Field label="Service Override" hint="Manual label (e.g. CHECK SERVICE)">
          <input
            type="text"
            value={form.svc_override ?? ''}
            onChange={(e) => update('svc_override', e.target.value)}
            placeholder=""
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

        <Field label="Notes" span={2}>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
            className="w-full input-dark resize-none"
          />
        </Field>
      </div>

      {error && (
        <div className="mt-4 text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          {error}
        </div>
      )}
    </Modal>
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
