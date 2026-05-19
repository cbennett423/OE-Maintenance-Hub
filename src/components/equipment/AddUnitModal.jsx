import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'

const EMPTY = { label: '', serial: '', site: '', hours: '', notes: '' }

export default function AddUnitModal({ sites, isOpen, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY)
      setError(null)
    }
  }, [isOpen])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    const label = form.label.trim()
    if (!label) {
      setError('Label is required.')
      return
    }
    setSaving(true)
    setError(null)
    const newUnit = {
      label,
      serial: form.serial.trim() || null,
      site: form.site || null,
      hours: form.hours === '' ? null : Number(form.hours),
      notes: form.notes.trim() || '',
    }
    const result = await onSave(newUnit)
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Failed to add equipment.')
      return
    }
    onClose?.()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Equipment"
      size="md"
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
            {saving ? 'Adding…' : 'Add Equipment'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Label" required>
          <input
            type="text"
            value={form.label}
            onChange={(e) => update('label', e.target.value)}
            placeholder="e.g. EX-05 or CAT 336F"
            autoFocus
            className="w-full input-dark"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Serial">
            <input
              type="text"
              value={form.serial}
              onChange={(e) => update('serial', e.target.value)}
              className="w-full input-dark font-mono"
            />
          </Field>

          <Field label="Hours">
            <input
              type="number"
              value={form.hours}
              onChange={(e) => update('hours', e.target.value)}
              className="w-full input-dark"
            />
          </Field>

          <Field label="Site" span={2}>
            <select
              value={form.site}
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

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
            className="w-full input-dark resize-none"
          />
        </Field>

        <p className="text-[11px] text-muted/70">
          After adding, click the row to fill in make/model, photo, specs, and service details.
        </p>
      </div>

      {error && (
        <div className="mt-4 text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          {error}
        </div>
      )}
    </Modal>
  )
}

function Field({ label, required, children, span = 1 }) {
  return (
    <div className={span === 2 ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
        {label}
        {required && <span className="text-cat-yellow ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}
