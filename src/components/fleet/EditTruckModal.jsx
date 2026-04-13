import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'

export default function EditTruckModal({ truck, isOpen, onClose, onSave }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (truck) {
      setForm({
        odometer: truck.odometer ?? '',
        last_svc_mi: truck.last_svc_mi ?? '',
        notes: truck.notes ?? '',
      })
      setError(null)
    }
  }, [truck])

  if (!truck) return null

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const changes = {
      odometer: form.odometer === '' ? null : Number(form.odometer),
      last_svc_mi: form.last_svc_mi === '' ? null : Number(form.last_svc_mi),
      notes: form.notes ?? '',
    }
    const result = await onSave(truck.id, changes, truck)
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Save failed')
      return
    }
    onClose?.()
  }

  const milesSinceSvc =
    form.odometer && form.last_svc_mi
      ? Number(form.odometer) - Number(form.last_svc_mi)
      : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${truck.name || truck.unit}`}
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
        <Field label="Odometer (mi)">
          <input
            type="number"
            value={form.odometer ?? ''}
            onChange={(e) => update('odometer', e.target.value)}
            className="w-full input-dark"
          />
        </Field>
        <Field label="Last Service (mi)">
          <input
            type="number"
            value={form.last_svc_mi ?? ''}
            onChange={(e) => update('last_svc_mi', e.target.value)}
            className="w-full input-dark"
          />
        </Field>
        {milesSinceSvc != null && (
          <div className="col-span-2 text-xs text-muted">
            Miles since last service:{' '}
            <span className={milesSinceSvc > 7500 ? 'text-svc-red' : 'text-text-dim'}>
              {milesSinceSvc.toLocaleString()} mi
            </span>
          </div>
        )}
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
