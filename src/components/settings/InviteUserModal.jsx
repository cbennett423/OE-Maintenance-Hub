import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'

export default function InviteUserModal({ isOpen, onClose, onInvite }) {
  const [form, setForm] = useState({ email: '', full_name: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setForm({ email: '', full_name: '', role: 'member' })
      setError(null)
      setSuccess(false)
    }
  }, [isOpen])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit() {
    const email = form.email.trim().toLowerCase()
    if (!email) {
      setError('Email is required.')
      return
    }
    if (!email.endsWith('@oeconstruct.com')) {
      setError('Email must be @oeconstruct.com.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await onInvite({
      email,
      role: form.role,
      full_name: form.full_name.trim() || null,
    })
    setSaving(false)
    if (result?.error) {
      setError(result.error.message || 'Invite failed')
      return
    }
    setSuccess(true)
    setTimeout(() => onClose?.(), 1200)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite User"
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
            onClick={handleSubmit}
            disabled={saving || success}
            className="px-4 py-1.5 text-sm font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
          >
            {saving ? 'Sending…' : success ? 'Invited' : 'Send Invite'}
          </button>
        </>
      }
    >
      <p className="text-xs text-muted mb-4">
        The user will receive a Supabase invite email and can set their
        password on first login. Must be an <span className="font-mono">@oeconstruct.com</span> address.
      </p>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="name@oeconstruct.com"
            className="w-full input-dark"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Full name (optional)
          </label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => update('full_name', e.target.value)}
            placeholder="e.g. Tim Mechanic"
            className="w-full input-dark"
          />
        </div>
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Role
          </label>
          <select
            value={form.role}
            onChange={(e) => update('role', e.target.value)}
            className="w-full input-dark"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <p className="text-[11px] text-muted/70 mt-1">
            Members can use everything except Settings, Audit Log, and creating/deleting invoices.
          </p>
        </div>
      </div>
      {error && (
        <div className="mt-4 text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 text-svc-green text-sm bg-svc-green/10 border border-svc-green/30 rounded px-3 py-2">
          Invite sent.
        </div>
      )}
    </Modal>
  )
}
