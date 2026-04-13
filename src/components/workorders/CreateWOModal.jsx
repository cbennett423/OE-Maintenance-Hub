import { useState } from 'react'
import Modal from '../ui/Modal'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const MECHANICS = ['Tim', 'Mechanic 2', 'Mechanic 3']

export default function CreateWOModal({
  isOpen,
  onClose,
  onSave,
  equipment = [],
  preselectedUnit = null,
}) {
  const [form, setForm] = useState(() => getDefaults(preselectedUnit))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function getDefaults(unit) {
    return {
      equipment_id: unit?.id || '',
      equipment_label: unit?.label || '',
      description: '',
      priority: 'medium',
      assigned_mechanic: '',
      parts_needed: '',
      cost: '',
      notes: '',
    }
  }

  // Reset when modal opens with a new preselected unit
  function handleOpen() {
    setForm(getDefaults(preselectedUnit))
    setError(null)
  }

  function update(field, value) {
    setForm((f) => {
      if (field === 'equipment_id') {
        const unit = equipment.find((u) => u.id === value)
        return { ...f, equipment_id: value, equipment_label: unit?.label || '' }
      }
      return { ...f, [field]: value }
    })
  }

  async function handleSave() {
    if (!form.equipment_id) {
      setError('Please select a piece of equipment.')
      return
    }
    if (!form.description.trim()) {
      setError('Please enter a description.')
      return
    }

    setSaving(true)
    setError(null)
    const result = await onSave({
      ...form,
      cost: form.cost === '' ? null : Number(form.cost),
    })
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Failed to create work order')
      return
    }
    onClose?.()
    setForm(getDefaults(null))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Work Order"
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
            {saving ? 'Creating…' : 'Create Work Order'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Equipment" span={2}>
          {preselectedUnit ? (
            <p className="text-text-dim text-sm py-1">{preselectedUnit.label}</p>
          ) : (
            <select
              value={form.equipment_id}
              onChange={(e) => update('equipment_id', e.target.value)}
              className="w-full input-dark"
            >
              <option value="">Select equipment…</option>
              {equipment.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Description" span={2}>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder="Describe the work needed…"
            className="w-full input-dark resize-none"
          />
        </Field>

        <Field label="Priority">
          <select
            value={form.priority}
            onChange={(e) => update('priority', e.target.value)}
            className="w-full input-dark"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assigned Mechanic">
          <select
            value={form.assigned_mechanic}
            onChange={(e) => update('assigned_mechanic', e.target.value)}
            className="w-full input-dark"
          >
            <option value="">Unassigned</option>
            {MECHANICS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Parts Needed">
          <input
            type="text"
            value={form.parts_needed}
            onChange={(e) => update('parts_needed', e.target.value)}
            placeholder="e.g. oil filter, belts"
            className="w-full input-dark"
          />
        </Field>

        <Field label="Estimated Cost ($)">
          <input
            type="number"
            value={form.cost}
            onChange={(e) => update('cost', e.target.value)}
            placeholder="0.00"
            className="w-full input-dark"
          />
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
