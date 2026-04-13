import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import WOStatusBadge from '../components/workorders/WOStatusBadge'
import PriorityBadge from '../components/workorders/PriorityBadge'
import CreateWOModal from '../components/workorders/CreateWOModal'
import WODetailModal from '../components/workorders/WODetailModal'
import { useWorkOrders } from '../hooks/useWorkOrders'
import { useEquipment } from '../hooks/useEquipment'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
]

export default function WorkOrders() {
  const { workOrders, loading, error, createWO, updateWO } = useWorkOrders()
  const { equipment } = useEquipment()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [mechanicFilter, setMechanicFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedWO, setSelectedWO] = useState(null)

  const mechanics = useMemo(() => {
    const set = new Set()
    workOrders.forEach((wo) => wo.assigned_mechanic && set.add(wo.assigned_mechanic))
    return Array.from(set).sort()
  }, [workOrders])

  const counts = useMemo(() => {
    const c = { open: 0, in_progress: 0, completed: 0 }
    workOrders.forEach((wo) => {
      if (c[wo.status] !== undefined) c[wo.status]++
    })
    return c
  }, [workOrders])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return workOrders.filter((wo) => {
      if (statusFilter !== 'all' && wo.status !== statusFilter) return false
      if (mechanicFilter !== 'all' && wo.assigned_mechanic !== mechanicFilter) return false
      if (q) {
        const haystack = [wo.equipment_label, wo.description, wo.assigned_mechanic, wo.notes, wo.parts_needed]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [workOrders, search, statusFilter, mechanicFilter])

  return (
    <div>
      <PageHeader title="Work Orders">
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors"
        >
          <Plus size={14} /> New Work Order
        </button>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard label="Open" value={counts.open} color="border-t-cat-yellow" />
        <StatCard label="In Progress" value={counts.in_progress} color="border-t-blue-500" />
        <StatCard label="Completed" value={counts.completed} color="border-t-svc-green" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search equipment, description, parts…"
            className="w-full pl-9 pr-3 py-2 bg-black-card border border-border rounded text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-cat-yellow"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-dark min-w-[150px]"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {mechanics.length > 0 && (
          <select
            value={mechanicFilter}
            onChange={(e) => setMechanicFilter(e.target.value)}
            className="input-dark min-w-[150px]"
          >
            <option value="all">All Mechanics</option>
            {mechanics.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {loading && <p className="text-muted">Loading work orders…</p>}
      {error && (
        <div className="text-svc-red bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          Failed to load work orders: {error.message}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-black-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted">
            {workOrders.length === 0
              ? 'No work orders yet. Click "New Work Order" to create one.'
              : 'No work orders match your filters.'}
          </p>
        </div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-black-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b-2 border-b-cat-yellow bg-black-soft">
                  <Th>Equipment</Th>
                  <Th>Description</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Mechanic</Th>
                  <Th>Opened</Th>
                  <Th className="text-right">Cost</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((wo, i) => (
                  <tr
                    key={wo.id}
                    onClick={() => setSelectedWO(wo)}
                    className={`border-b border-border cursor-pointer hover:bg-cat-yellow/5 transition-colors ${
                      i % 2 === 1 ? 'bg-black/30' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-text-dim font-medium">{wo.equipment_label}</td>
                    <td className="px-4 py-2.5 text-text-dim max-w-xs truncate">{wo.description}</td>
                    <td className="px-4 py-2.5"><PriorityBadge priority={wo.priority} /></td>
                    <td className="px-4 py-2.5"><WOStatusBadge status={wo.status} /></td>
                    <td className="px-4 py-2.5 text-muted text-xs">{wo.assigned_mechanic || '—'}</td>
                    <td className="px-4 py-2.5 text-muted text-xs whitespace-nowrap">{wo.date_opened || '—'}</td>
                    <td className="px-4 py-2.5 text-text-dim font-mono text-right text-xs">
                      {wo.cost != null ? `$${Number(wo.cost).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CreateWOModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={createWO}
        equipment={equipment}
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

function StatCard({ label, value, color }) {
  return (
    <div className={`bg-black-card border border-border rounded-lg p-4 border-t-3 ${color}`}>
      <p className="font-display text-3xl font-bold text-text">{value}</p>
      <p className="text-sm text-muted mt-1">{label}</p>
    </div>
  )
}

function Th({ children, className = '' }) {
  return (
    <th className={`px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs ${className}`}>
      {children}
    </th>
  )
}
