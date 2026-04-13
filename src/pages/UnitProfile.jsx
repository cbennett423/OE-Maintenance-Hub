import { useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, AlertTriangle, Wrench, ClipboardList } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import ServiceBadge from '../components/equipment/ServiceBadge'
import EditUnitModal from '../components/equipment/EditUnitModal'
import { useEquipment } from '../hooks/useEquipment'
import { useUnitAuditLog } from '../hooks/useAuditLog'
import { forecastIntervals } from '../lib/serviceLogic'

export default function UnitProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { equipment, loading, updateUnit } = useEquipment()
  const [editOpen, setEditOpen] = useState(false)

  const unit = useMemo(
    () => equipment.find((u) => u.id === id),
    [equipment, id]
  )

  const sites = useMemo(() => {
    const set = new Set()
    equipment.forEach((u) => u.site && set.add(u.site))
    return Array.from(set).sort()
  }, [equipment])

  const { entries: auditEntries, loading: auditLoading } = useUnitAuditLog(
    unit?.label
  )

  if (loading) {
    return <p className="text-muted">Loading unit…</p>
  }

  if (!unit) {
    return (
      <div>
        <PageHeader title="Unit Not Found" />
        <p className="text-muted mb-4">No unit found with id {id}.</p>
        <Link to="/equipment" className="text-cat-yellow hover:underline">
          ← Back to Equipment
        </Link>
      </div>
    )
  }

  const intervals = forecastIntervals(unit.hours)

  return (
    <div>
      {/* Breadcrumb + Back link */}
      <Link
        to="/equipment"
        className="inline-flex items-center gap-1.5 text-muted hover:text-cat-yellow text-sm mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Equipment
      </Link>

      {/* Hero card */}
      <div className="bg-black-card border border-border border-t-4 border-t-cat-yellow rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-text">
              {unit.label}
            </h1>
            <p className="font-mono text-sm text-muted mt-1">
              {unit.serial || '—'}
            </p>
            <p className="text-xs uppercase tracking-wider text-muted mt-2">
              {unit.site || 'UNASSIGNED'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted font-display">
              Current Hours
            </p>
            <div className="flex items-center gap-2 justify-end">
              {unit.telematics_issue && (
                <AlertTriangle
                  size={18}
                  className="text-cat-yellow"
                  aria-label="Telematics issue"
                />
              )}
              <p className="font-display text-5xl font-bold text-cat-yellow leading-none">
                {Number(unit.hours || 0).toLocaleString()}
              </p>
            </div>
            <div className="mt-3 flex justify-end">
              <ServiceBadge unit={unit} />
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors"
          >
            <Pencil size={13} /> Edit Unit
          </button>
          <button
            onClick={() => alert('Work orders coming in Phase 3')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
          >
            <Wrench size={13} /> New Work Order
          </button>
          <button
            onClick={() => alert('Service logging coming in a later phase')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
          >
            <ClipboardList size={13} /> Log Service
          </button>
        </div>
      </div>

      {/* Service intervals panel */}
      <SectionHeader title="Service Intervals" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {intervals.map((i) => {
          const closing = i.hoursRemaining <= 75
          return (
            <div
              key={i.interval}
              className={`bg-black-card border rounded-lg p-4 ${closing ? 'border-svc-green/50' : 'border-border'}`}
            >
              <p className="font-display text-xs uppercase tracking-wider text-muted">
                {i.label}
              </p>
              <p className="font-display text-2xl font-bold text-text mt-1">
                {i.nextAt.toLocaleString()}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {i.hoursRemaining.toLocaleString()} hrs remaining
              </p>
            </div>
          )
        })}
      </div>

      {/* Notes */}
      <SectionHeader title="Notes" />
      <div className="bg-black-card border border-border rounded-lg p-4 mb-6 min-h-[60px]">
        {unit.notes ? (
          <p className="text-text-dim whitespace-pre-wrap text-sm">{unit.notes}</p>
        ) : (
          <p className="text-muted text-sm italic">No notes</p>
        )}
      </div>

      {/* Change history */}
      <SectionHeader title="Change History" />
      <div className="bg-black-card border border-border rounded-lg overflow-hidden mb-6">
        {auditLoading && <p className="p-4 text-muted text-sm">Loading history…</p>}
        {!auditLoading && auditEntries.length === 0 && (
          <p className="p-4 text-muted text-sm italic">No changes recorded yet.</p>
        )}
        {!auditLoading && auditEntries.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border bg-black-soft">
                <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">When</th>
                <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">Field</th>
                <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">From</th>
                <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">To</th>
                <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">By</th>
              </tr>
            </thead>
            <tbody>
              {auditEntries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">
                    {formatWhen(e.created_at)}
                  </td>
                  <td className="px-4 py-2 text-xs text-text-dim font-mono">{e.field}</td>
                  <td className="px-4 py-2 text-xs text-muted">{e.old_value ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-text-dim">{e.new_value ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-muted">{e.changed_by || e.source || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <EditUnitModal
        unit={editOpen ? unit : null}
        sites={sites}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={updateUnit}
      />
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-5 bg-cat-yellow rounded-sm" />
      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
        {title}
      </h3>
    </div>
  )
}

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
