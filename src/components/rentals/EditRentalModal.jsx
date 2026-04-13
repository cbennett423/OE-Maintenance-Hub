import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'

export default function EditRentalModal({ rental, isOpen, onClose, onSave }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (rental) {
      setForm({
        equipment: rental.equipment ?? '',
        vendor: rental.vendor ?? '',
        agreement_num: rental.agreement_num ?? '',
        id_num: rental.id_num ?? '',
        serial: rental.serial ?? '',
        job: rental.job ?? '',
        date_out: rental.date_out ?? '',
        date_returned: rental.date_returned ?? '',
        billed_thru: rental.billed_thru ?? '',
        authorized_by: rental.authorized_by ?? '',
        duration: rental.duration ?? '',
        notes: rental.notes ?? '',
      })
      setError(null)
    }
  }, [rental])

  if (!rental) return null

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await onSave(rental.id, form, rental)
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
      title={`Edit Rental: ${rental.equipment}`}
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
        <Field label="Equipment" span={2}>
          <input type="text" value={form.equipment} onChange={(e) => update('equipment', e.target.value)} className="w-full input-dark" />
        </Field>
        <Field label="Vendor">
          <input type="text" value={form.vendor} onChange={(e) => update('vendor', e.target.value)} className="w-full input-dark" />
        </Field>
        <Field label="Agreement #">
          <input type="text" value={form.agreement_num} onChange={(e) => update('agreement_num', e.target.value)} className="w-full input-dark font-mono" />
        </Field>
        <Field label="ID / Unit #">
          <input type="text" value={form.id_num} onChange={(e) => update('id_num', e.target.value)} className="w-full input-dark font-mono" />
        </Field>
        <Field label="Serial">
          <input type="text" value={form.serial} onChange={(e) => update('serial', e.target.value)} className="w-full input-dark font-mono" />
        </Field>
        <Field label="Job #">
          <input type="text" value={form.job} onChange={(e) => update('job', e.target.value)} className="w-full input-dark" />
        </Field>
        <Field label="Date Out">
          <input type="text" value={form.date_out} onChange={(e) => update('date_out', e.target.value)} className="w-full input-dark" />
        </Field>
        <Field label="Date Returned">
          <input type="text" value={form.date_returned} onChange={(e) => update('date_returned', e.target.value)} placeholder="—" className="w-full input-dark" />
        </Field>
        <Field label="Billed Thru">
          <input type="text" value={form.billed_thru} onChange={(e) => update('billed_thru', e.target.value)} className="w-full input-dark" />
        </Field>
        <Field label="Authorized By">
          <input type="text" value={form.authorized_by} onChange={(e) => update('authorized_by', e.target.value)} className="w-full input-dark" />
        </Field>
        <Field label="Duration">
          <input type="text" value={form.duration} onChange={(e) => update('duration', e.target.value)} className="w-full input-dark" />
        </Field>
        <div />
        <Field label="Notes" span={2}>
          <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={4} className="w-full input-dark resize-none" />
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
