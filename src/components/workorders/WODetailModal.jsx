import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import WOStatusBadge from './WOStatusBadge'
import PriorityBadge from './PriorityBadge'

const PRIORITIES = ['low', 'medium', 'high', 'critical']
const MECHANICS = ['Tim', 'Mechanic 2', 'Mechanic 3']

export default function WODetailModal({ workOrder, isOpen, onClose, onUpdate }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (workOrder) {
      setForm({
        description: workOrder.description || '',
        priority: workOrder.priority || 'medium',
        assigned_mechanic: workOrder.assigned_mechanic || '',
        parts_needed: workOrder.parts_needed || '',
        cost: workOrder.cost ?? '',
        notes: workOrder.notes || '',
      })
      setError(null)
    }
  }, [workOrder])

  if (!workOrder) return null

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const changes = {
      description: form.description,
      priority: form.priority,
      assigned_mechanic: form.assigned_mechanic || null,
      parts_needed: form.parts_needed || null,
      cost: form.cost === '' || form.cost == null ? null : Number(form.cost),
      notes: form.notes || null,
    }
    const result = await onUpdate(workOrder.id, changes, workOrder)
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Save failed')
      return
    }
    onClose?.()
  }

  async function handleStatusChange(newStatus) {
    setSaving(true)
    setError(null)
    const result = await onUpdate(workOrder.id, { status: newStatus }, workOrder)
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Status change failed')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`WO: ${workOrder.equipment_label}`}
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
      {/* Status bar + transitions */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <WOStatusBadge status={workOrder.status} />
          <PriorityBadge priority={workOrder.priority} />
        </div>
        <div className="flex gap-2">
          {workOrder.status === 'open' && (
            <StatusButton
              label="Start Work"
              onClick={() => handleStatusChange('in_progress')}
              disabled={saving}
              className="bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30"
            />
          )}
          {workOrder.status === 'in_progress' && (
            <StatusButton
              label="Complete"
              onClick={() => handleStatusChange('completed')}
              disabled={saving}
              className="bg-svc-green/20 text-svc-green border-svc-green/50 hover:bg-svc-green/30"
            />
          )}
          {workOrder.status === 'completed' && (
            <StatusButton
              label="Reopen"
              onClick={() => handleStatusChange('open')}
              disabled={saving}
              className="bg-cat-yellow/20 text-cat-yellow border-cat-yellow/50 hover:bg-cat-yellow/30"
            />
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
        <MetaItem label="Opened" value={workOrder.date_opened || '—'} />
        <MetaItem label="Completed" value={workOrder.date_completed || '—'} />
        <MetaItem label="Equipment ID" value={workOrder.equipment_id} mono />
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Description" span={2}>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
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
            className="w-full input-dark"
          />
        </Field>

        <Field label="Cost ($)">
          <input
            type="number"
            value={form.cost}
            onChange={(e) => update('cost', e.target.value)}
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

function StatusButton({ label, onClick, disabled, className }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1 text-[11px] font-display font-semibold uppercase tracking-wider border rounded transition-colors disabled:opacity-50 ${className}`}
    >
      {label}
    </button>
  )
}

function MetaItem({ label, value, mono }) {
  return (
    <div>
      <p className="text-muted font-display uppercase tracking-wider">{label}</p>
      <p className={`text-text-dim mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
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
