import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import { CATEGORIES } from '../../hooks/useInventory'

const VENDORS = ['CAT', 'Napa', 'Grainger', 'OReilly', 'Local Supplier']

/**
 * Shared modal for adding and editing parts.
 * When `part` is null, operates in "Add" mode.
 */
export default function PartModal({ part, isOpen, onClose, onSave }) {
  const isNew = !part
  const [form, setForm] = useState(() => getDefaults(part))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function getDefaults(p) {
    return {
      part_number: p?.part_number ?? '',
      description: p?.description ?? '',
      category: p?.category ?? 'Shop Supplies',
      quantity_on_hand: p?.quantity_on_hand ?? 0,
      quantity_min: p?.quantity_min ?? 0,
      unit_cost: p?.unit_cost ?? '',
      vendor: p?.vendor ?? '',
      location: p?.location ?? '',
      compatible_equipment: p?.compatible_equipment ?? '',
      last_ordered: p?.last_ordered ?? '',
      notes: p?.notes ?? '',
    }
  }

  useEffect(() => {
    setForm(getDefaults(part))
    setError(null)
  }, [part])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.description.trim()) {
      setError('Description is required.')
      return
    }
    setSaving(true)
    setError(null)

    const data = {
      ...form,
      quantity_on_hand: Number(form.quantity_on_hand) || 0,
      quantity_min: Number(form.quantity_min) || 0,
      unit_cost: form.unit_cost === '' ? null : Number(form.unit_cost),
      last_ordered: form.last_ordered || null,
    }

    const result = isNew
      ? await onSave(data)
      : await onSave(part.id, data, part)

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
      title={isNew ? 'Add Part' : `Edit: ${part?.description}`}
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
            {saving ? 'Saving…' : isNew ? 'Add Part' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Description" span={2}>
          <input
            type="text"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="e.g. CAT Oil Filter 1R-0751"
            className="w-full input-dark"
          />
        </Field>
        <Field label="Part Number">
          <input
            type="text"
            value={form.part_number}
            onChange={(e) => update('part_number', e.target.value)}
            placeholder="e.g. 1R-0751"
            className="w-full input-dark font-mono"
          />
        </Field>
        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value)}
            className="w-full input-dark"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Qty On Hand">
          <input
            type="number"
            value={form.quantity_on_hand}
            onChange={(e) => update('quantity_on_hand', e.target.value)}
            min={0}
            className="w-full input-dark"
          />
        </Field>
        <Field label="Min Qty (low stock alert)">
          <input
            type="number"
            value={form.quantity_min}
            onChange={(e) => update('quantity_min', e.target.value)}
            min={0}
            className="w-full input-dark"
          />
        </Field>
        <Field label="Unit Cost ($)">
          <input
            type="number"
            value={form.unit_cost}
            onChange={(e) => update('unit_cost', e.target.value)}
            step="0.01"
            placeholder="0.00"
            className="w-full input-dark"
          />
        </Field>
        <Field label="Vendor">
          <select
            value={form.vendor}
            onChange={(e) => update('vendor', e.target.value)}
            className="w-full input-dark"
          >
            <option value="">—</option>
            {VENDORS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Storage Location">
          <input
            type="text"
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="e.g. Shop Shelf A3"
            className="w-full input-dark"
          />
        </Field>
        <Field label="Last Ordered">
          <input
            type="date"
            value={form.last_ordered}
            onChange={(e) => update('last_ordered', e.target.value)}
            className="w-full input-dark"
          />
        </Field>
        <Field label="Compatible Equipment" span={2}>
          <input
            type="text"
            value={form.compatible_equipment}
            onChange={(e) => update('compatible_equipment', e.target.value)}
            placeholder="e.g. 336F, 950M, all CAT excavators"
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
