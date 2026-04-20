import { useEffect, useState } from 'react'
import { Save, Check, Plus, Pencil, Trash2, X } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useJobs } from '../hooks/useJobs'

const MECHANIC_LIST = ['Tim', 'Mechanic 2', 'Mechanic 3']

export default function Settings() {
  const { user } = useAuth()

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="grid gap-6 max-w-4xl">
        {/* Current user */}
        <SettingsCard title="Current User">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="Email" value={user?.email || '—'} />
            <InfoRow label="User ID" value={user?.id?.slice(0, 8) + '…' || '—'} mono />
            <InfoRow label="Role" value="Admin" />
            <InfoRow label="Domain" value="@oeconstruct.com" />
          </div>
        </SettingsCard>

        {/* Service interval configuration */}
        <ServiceSettings />

        {/* Jobs management */}
        <JobsSettings />

        {/* Mechanics */}
        <SettingsCard title="Mechanics">
          <p className="text-xs text-muted mb-3">
            Mechanics available for work order assignment.
          </p>
          <div className="space-y-1">
            {MECHANIC_LIST.map((m) => (
              <div key={m} className="px-3 py-1.5 rounded bg-black-soft text-sm text-text-dim">
                {m}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2">
            Mechanic names will be configurable in a future update.
          </p>
        </SettingsCard>

        {/* App info */}
        <SettingsCard title="App Info">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="Version" value="Phase 7 — Audit Log & Admin" />
            <InfoRow label="Stack" value="React + Vite + Supabase" />
            <InfoRow label="Database" value="Supabase (US East)" />
            <InfoRow label="Hosting" value="Vercel (planned)" />
          </div>
        </SettingsCard>
      </div>
    </div>
  )
}

function ServiceSettings() {
  const [threshold, setThreshold] = useState(75)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'warning_threshold')
        .single()
      if (data?.value) setThreshold(Number(data.value))
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key: 'warning_threshold',
        value: String(threshold),
        updated_at: new Date().toISOString(),
      })
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <SettingsCard title="Service Intervals">
      <p className="text-xs text-muted mb-4">
        CAT PM intervals: 250HR / 500HR / 1000HR / 2000HR. Units are flagged as "due soon" when they are within the warning threshold of the next interval.
      </p>
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Warning Threshold (hours)
          </label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            min={10}
            max={200}
            className="w-32 input-dark"
            disabled={loading}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
        >
          {saved ? (
            <><Check size={13} /> Saved</>
          ) : (
            <><Save size={13} /> Save</>
          )}
        </button>
      </div>
      <p className="text-[11px] text-muted mt-2">
        Default: 75 hours. Changing this affects which units show "due soon" badges on the Equipment page and Dashboard.
      </p>
    </SettingsCard>
  )
}

function SettingsCard({ title, children }) {
  return (
    <div className="bg-black-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-black-soft">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-cat-yellow rounded-sm" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
            {title}
          </h3>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs font-display uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-sm text-text-dim mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

function JobsSettings() {
  const { jobs, loading, error, createJob, updateJob, deleteJob } = useJobs()
  const [editing, setEditing] = useState(null) // job object being edited, or "new"
  const active = jobs.filter((j) => j.active)
  const inactive = jobs.filter((j) => !j.active)

  return (
    <>
      <SettingsCard title="Jobs / Sites">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted">
            Manage active and inactive jobs. Addresses entered here appear next to the site name on the weekly fleet report PDF.
          </p>
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors shrink-0 ml-4"
          >
            <Plus size={12} /> New Job
          </button>
        </div>

        {loading && <p className="text-muted text-sm">Loading jobs…</p>}
        {error && (
          <div className="text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
            Failed to load jobs: {error.message}
          </div>
        )}

        {!loading && !error && (
          <>
            {active.length > 0 && (
              <div className="overflow-x-auto border border-border rounded">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border bg-black-soft">
                      <Th>Job / Site</Th>
                      <Th>Address</Th>
                      <Th>Job #</Th>
                      <Th className="w-20 text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((j, i) => (
                      <tr
                        key={j.id}
                        className={`border-b border-border last:border-b-0 ${
                          i % 2 === 1 ? 'bg-black/30' : ''
                        }`}
                      >
                        <td className="px-3 py-2 text-text-dim font-medium uppercase tracking-wide text-xs">
                          {j.name}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted">{j.address || '—'}</td>
                        <td className="px-3 py-2 text-xs font-mono text-muted">
                          {j.job_number || '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setEditing(j)}
                            className="inline-flex items-center text-muted hover:text-cat-yellow transition-colors p-1"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inactive.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs text-muted cursor-pointer hover:text-text">
                  {inactive.length} inactive job{inactive.length !== 1 ? 's' : ''}
                </summary>
                <div className="mt-2 border border-border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {inactive.map((j) => (
                        <tr
                          key={j.id}
                          onClick={() => setEditing(j)}
                          className="border-b border-border last:border-b-0 cursor-pointer hover:bg-cat-yellow/5"
                        >
                          <td className="px-3 py-2 text-xs text-muted uppercase tracking-wide">
                            {j.name}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted">{j.address || '—'}</td>
                          <td className="px-3 py-2 text-xs font-mono text-muted">
                            {j.job_number || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            {jobs.length === 0 && (
              <p className="text-muted text-sm italic">
                No jobs yet. Click "New Job" to add one.
              </p>
            )}
          </>
        )}
      </SettingsCard>

      <JobModal
        job={editing === 'new' ? null : editing}
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        onCreate={createJob}
        onUpdate={updateJob}
        onDelete={deleteJob}
      />
    </>
  )
}

function JobModal({ job, isOpen, onClose, onCreate, onUpdate, onDelete }) {
  const isNew = !job
  const [form, setForm] = useState({ name: '', address: '', job_number: '', active: true })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (job) {
      setForm({
        name: job.name || '',
        address: job.address || '',
        job_number: job.job_number || '',
        active: job.active !== false,
      })
    } else {
      setForm({ name: '', address: '', job_number: '', active: true })
    }
    setError(null)
    setConfirmDelete(false)
  }, [job, isOpen])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim().toUpperCase(),
      address: form.address.trim() || null,
      job_number: form.job_number.trim() || null,
      active: !!form.active,
    }
    const result = isNew
      ? await onCreate(payload)
      : await onUpdate(job.id, payload, job)
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
    setSaving(true)
    const result = await onDelete(job.id, job)
    setSaving(false)
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
      title={isNew ? 'New Job' : `Edit ${job?.name || ''}`}
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {!isNew && onDelete && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider rounded transition-colors disabled:opacity-50 ${
                  confirmDelete
                    ? 'bg-svc-red text-white hover:bg-svc-red/80'
                    : 'border border-svc-red/50 text-svc-red hover:bg-svc-red/10'
                }`}
              >
                <Trash2 size={12} />
                {confirmDelete ? 'Click again to confirm' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
              {saving ? 'Saving…' : isNew ? 'Create Job' : 'Save Changes'}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. DIA PREFLIGHT"
            className="w-full input-dark"
          />
          <p className="text-[11px] text-muted/70 mt-1">
            Saved in uppercase. Must match the site value on equipment rows to link them.
          </p>
        </div>
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Address
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            placeholder="e.g. 24500 E 78th Ave, Denver, CO"
            className="w-full input-dark"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
              Job Number
            </label>
            <input
              type="text"
              value={form.job_number}
              onChange={(e) => update('job_number', e.target.value)}
              placeholder="e.g. 431"
              className="w-full input-dark font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
              Status
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-dim mt-2">
              <input
                type="checkbox"
                checked={!!form.active}
                onChange={(e) => update('active', e.target.checked)}
                className="w-4 h-4 accent-cat-yellow"
              />
              Active
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          {error}
        </div>
      )}
    </Modal>
  )
}

function Th({ children, className = '' }) {
  return (
    <th
      className={`px-3 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px] ${className}`}
    >
      {children}
    </th>
  )
}
