import { useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, AlertTriangle, Wrench, ClipboardList, FileText } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import ServiceBadge from '../components/equipment/ServiceBadge'
import EditUnitModal from '../components/equipment/EditUnitModal'
import CreateWOModal from '../components/workorders/CreateWOModal'
import WOStatusBadge from '../components/workorders/WOStatusBadge'
import PriorityBadge from '../components/workorders/PriorityBadge'
import WODetailModal from '../components/workorders/WODetailModal'
import { useEquipment } from '../hooks/useEquipment'
import { useWorkOrders } from '../hooks/useWorkOrders'
import { useUnitAuditLog } from '../hooks/useAuditLog'
import { forecastIntervals } from '../lib/serviceLogic'

export default function UnitProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { equipment, loading, updateUnit } = useEquipment()
  const [editOpen, setEditOpen] = useState(false)
  const [createWOOpen, setCreateWOOpen] = useState(false)
  const [selectedWO, setSelectedWO] = useState(null)

  const unit = useMemo(
    () => equipment.find((u) => u.id === id),
    [equipment, id]
  )

  const sites = useMemo(() => {
    const set = new Set()
    equipment.forEach((u) => u.site && set.add(u.site))
    return Array.from(set).sort()
  }, [equipment])

  const { workOrders, createWO, updateWO } = useWorkOrders({
    equipmentId: id,
  })

  const activeWOs = useMemo(
    () => workOrders.filter((wo) => wo.status !== 'completed'),
    [workOrders]
  )
  const completedWOs = useMemo(
    () => workOrders.filter((wo) => wo.status === 'completed'),
    [workOrders]
  )

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
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {unit.photo_url && (
              <img
                src={unit.photo_url}
                alt={unit.label}
                className="w-32 h-32 object-cover rounded border border-border shrink-0"
              />
            )}
            <div className="min-w-0">
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
            onClick={() => setCreateWOOpen(true)}
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

      {/* Specs + Product Link side-by-side */}
      {(unit.make || unit.model || unit.year || unit.bucket_size ||
        unit.product_link_radio || unit.product_link_radio_software || unit.product_link_ecm || unit.product_link_ecm_software) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {(unit.make || unit.model || unit.year || unit.bucket_size) && (
            <div>
              <SectionHeader title="Specs" />
              <div className="bg-black-card border border-border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  <SpecRow label="Make" value={unit.make} />
                  <SpecRow label="Model" value={unit.model} />
                  <SpecRow label="Year" value={unit.year} />
                  <SpecRow label="Bucket Size" value={unit.bucket_size} />
                </div>
              </div>
            </div>
          )}
          {(unit.product_link_radio || unit.product_link_radio_software || unit.product_link_ecm || unit.product_link_ecm_software) && (
            <div>
              <SectionHeader title="Product Link" />
              <div className="bg-black-card border border-border rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  <SpecRow label="Radio" value={unit.product_link_radio} mono />
                  <SpecRow label="Radio Software" value={unit.product_link_radio_software} mono />
                  <SpecRow label="ECM" value={unit.product_link_ecm} mono />
                  <SpecRow label="ECM Software" value={unit.product_link_ecm_software} mono />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents */}
      {Array.isArray(unit.documents) && unit.documents.length > 0 && (
        <>
          <SectionHeader title="Documents" />
          <div className="bg-black-card border border-border rounded-lg overflow-hidden mb-6">
            {unit.documents.map((doc, i) => (
              <a
                key={i}
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-cat-yellow/5 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={14} className="text-muted shrink-0" />
                  <span className="text-sm text-text-dim truncate">{doc.name}</span>
                </div>
                {doc.size && (
                  <span className="text-[11px] text-muted shrink-0 ml-3">
                    {Math.round(doc.size / 1024)} KB
                  </span>
                )}
              </a>
            ))}
          </div>
        </>
      )}

      {/* Wear Parts */}
      {Array.isArray(unit.wear_parts) && unit.wear_parts.length > 0 && (
        <>
          <SectionHeader title="Wear Parts" />
          <div className="bg-black-card border border-border rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border bg-black-soft">
                  <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">Part</th>
                  <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">Part #</th>
                  <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">Last Replaced</th>
                  <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {unit.wear_parts.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 text-text-dim text-sm font-medium">{p.name || '—'}</td>
                    <td className="px-4 py-2 text-xs text-muted font-mono">{p.part_number || '—'}</td>
                    <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">
                      {p.last_replaced ? formatShortDate(p.last_replaced) : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-text-dim">{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Custom Fields */}
      {Array.isArray(unit.custom_fields) && unit.custom_fields.length > 0 && (
        <>
          <SectionHeader title="Custom Fields" />
          <div className="bg-black-card border border-border rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {unit.custom_fields.map((cf, i) => (
                <SpecRow key={i} label={cf.label || '—'} value={cf.value} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Work Orders */}
      <SectionHeader title="Work Orders" />
      {activeWOs.length === 0 && completedWOs.length === 0 && (
        <div className="bg-black-card border border-border rounded-lg p-4 mb-6">
          <p className="text-muted text-sm italic">No work orders for this unit.</p>
        </div>
      )}
      {activeWOs.length > 0 && (
        <div className="bg-black-card border border-border rounded-lg overflow-hidden mb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border bg-black-soft">
                <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">Description</th>
                <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">Priority</th>
                <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">Status</th>
                <th className="px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-[11px]">Mechanic</th>
              </tr>
            </thead>
            <tbody>
              {activeWOs.map((wo) => (
                <tr
                  key={wo.id}
                  onClick={() => setSelectedWO(wo)}
                  className="border-b border-border last:border-b-0 cursor-pointer hover:bg-cat-yellow/5 transition-colors"
                >
                  <td className="px-4 py-2 text-text-dim max-w-xs truncate">{wo.description}</td>
                  <td className="px-4 py-2"><PriorityBadge priority={wo.priority} /></td>
                  <td className="px-4 py-2"><WOStatusBadge status={wo.status} /></td>
                  <td className="px-4 py-2 text-muted text-xs">{wo.assigned_mechanic || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {completedWOs.length > 0 && (
        <details className="mb-6">
          <summary className="text-xs text-muted cursor-pointer hover:text-text transition-colors mb-2">
            {completedWOs.length} completed work order{completedWOs.length !== 1 ? 's' : ''}
          </summary>
          <div className="bg-black-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {completedWOs.map((wo) => (
                  <tr
                    key={wo.id}
                    onClick={() => setSelectedWO(wo)}
                    className="border-b border-border last:border-b-0 cursor-pointer hover:bg-cat-yellow/5 transition-colors"
                  >
                    <td className="px-4 py-2 text-muted max-w-xs truncate">{wo.description}</td>
                    <td className="px-4 py-2"><WOStatusBadge status="completed" /></td>
                    <td className="px-4 py-2 text-muted text-xs">{wo.date_completed || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {(activeWOs.length > 0 || completedWOs.length > 0) && <div className="mb-6" />}

      {/* Next service interval — shows the highest interval that applies */}
      <SectionHeader title="Next Service" />
      {(() => {
        // Find the next 250-hour mark and determine which interval it falls on
        // e.g. at 7997 hrs → next mark is 8000 → that's a 2000HR service (not just 250)
        const nextMark = intervals[0] // 250HR interval has the nearest nextAt
        // Check which is the highest interval that shares that same nextAt
        const highest = [...intervals].reverse().find((i) => i.nextAt === nextMark.nextAt) || nextMark
        const closing = highest.hoursRemaining <= 75
        return (
          <div className={`bg-black-card border rounded-lg p-5 mb-6 ${closing ? 'border-svc-green/50' : 'border-border'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-sm uppercase tracking-wider text-muted">
                  Next Service Due
                </p>
                <p className="font-display text-3xl font-bold text-cat-yellow mt-1">
                  {highest.label}
                </p>
                <p className="text-sm text-text-dim mt-1">
                  at <span className="font-mono">{highest.nextAt.toLocaleString()}</span> hours
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted font-display">
                  Hours Remaining
                </p>
                <p className={`font-display text-4xl font-bold mt-1 ${closing ? 'text-svc-red' : 'text-text'}`}>
                  {highest.hoursRemaining.toLocaleString()}
                </p>
              </div>
            </div>
            {/* Show all intervals as a compact reference row below */}
            <div className="mt-4 pt-3 border-t border-border flex gap-4">
              {intervals.map((i) => (
                <div key={i.interval} className="text-xs text-muted">
                  <span className="font-display uppercase tracking-wider">{i.label}</span>{' '}
                  <span className="font-mono text-text-dim">@ {i.nextAt.toLocaleString()}</span>{' '}
                  <span className="text-muted">({i.hoursRemaining} hrs)</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

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
      <CreateWOModal
        isOpen={createWOOpen}
        onClose={() => setCreateWOOpen(false)}
        onSave={createWO}
        equipment={equipment}
        preselectedUnit={unit}
      />
      <WODetailModal
        workOrder={selectedWO}
        isOpen={!!selectedWO}
        onClose={() => setSelectedWO(null)}
        onUpdate={updateWO}
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

function SpecRow({ label, value, mono }) {
  return (
    <div>
      <p className="text-[11px] font-display uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className={`text-sm text-text-dim mt-0.5 ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </p>
    </div>
  )
}

function formatShortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
