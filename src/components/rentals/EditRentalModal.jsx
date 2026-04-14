import { useEffect, useState } from 'react'
import { Trash2, PackageCheck } from 'lucide-react'
import Modal from '../ui/Modal'

const EMPTY_FORM = {
  equipment: '',
  vendor: '',
  agreement_num: '',
  id_num: '',
  serial: '',
  job: '',
  date_out: '',
  date_returned: '',
  billed_thru: '',
  authorized_by: '',
  duration: '',
  notes: '',
}

/**
 * Shared modal for adding, editing, and deleting rentals.
 * When `rental` is null (but isOpen is true), operates in "New" mode.
 */
export default function EditRentalModal({
  rental,
  isOpen,
  onClose,
  onSave,
  onCreate,
  onDelete,
}) {
  const isNew = !rental
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
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
    } else {
      setForm(EMPTY_FORM)
    }
    setError(null)
    setConfirmDelete(false)
  }, [rental, isOpen])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  /**
   * One-click "Mark Returned" — auto-fills today's date into date_returned.
   * Chase can still edit the date in the field before saving if the
   * rental was actually returned on a different day.
   */
  function markReturned() {
    const t = new Date()
    const today = `${t.getMonth() + 1}/${t.getDate()}/${t.getFullYear()}`
    setForm((f) => ({ ...f, date_returned: today }))
  }

  const canMarkReturned = !isNew && !form.date_returned

  async function handleSave() {
    if (!form.equipment.trim()) {
      setError('Equipment is required.')
      return
    }
    setSaving(true)
    setError(null)
    const result = isNew
      ? await onCreate(form)
      : await onSave(rental.id, form, rental)
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Save failed')
      return
    }
    onClose?.()
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    setError(null)
    const result = await onDelete(rental.id, rental)
    setDeleting(false)
    if (result?.error) {
      setError(result.error.message || 'Delete failed')
      return
    }
    onClose?.()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isNew ? 'New Rental' : `Edit Rental: ${rental?.equipment || ''}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {!isNew && onDelete && (
              <button
                onClick={handleDelete}
                disabled={saving || deleting}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider rounded transition-colors disabled:opacity-50 ${
                  confirmDelete
                    ? 'bg-svc-red text-white hover:bg-svc-red/80'
                    : 'border border-svc-red/50 text-svc-red hover:bg-svc-red/10'
                }`}
              >
                <Trash2 size={12} />
                {deleting ? 'Deleting…' : confirmDelete ? 'Click again to confirm' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {canMarkReturned && (
              <button
                onClick={markReturned}
                disabled={saving || deleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-svc-green/50 text-svc-green hover:bg-svc-green/10 rounded transition-colors disabled:opacity-50"
                title="Fill today's date into Date Returned (still need to click Save Changes)"
              >
                <PackageCheck size={13} /> Mark Returned
              </button>
            )}
            <button
              onClick={onClose}
              disabled={saving || deleting}
              className="px-4 py-1.5 text-sm font-display uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="px-4 py-1.5 text-sm font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : isNew ? 'Create Rental' : 'Save Changes'}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Equipment" span={2}>
          <input type="text" value={form.equipment} onChange={(e) => update('equipment', e.target.value)} placeholder="e.g. 305 Mini Ex + Bucket" className="w-full input-dark" />
        </Field>
        <Field label="Vendor">
          <input type="text" value={form.vendor} onChange={(e) => update('vendor', e.target.value)} placeholder="e.g. Wagner Rents" className="w-full input-dark" />
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
          <input type="text" value={form.date_out} onChange={(e) => update('date_out', e.target.value)} placeholder="M/D/YYYY" className="w-full input-dark" />
        </Field>
        <Field label="Date Returned">
          <input type="text" value={form.date_returned} onChange={(e) => update('date_returned', e.target.value)} placeholder="— (blank if active)" className="w-full input-dark" />
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
