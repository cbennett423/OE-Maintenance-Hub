import { useMemo, useState } from 'react'
import PageHeader from '../components/layout/PageHeader'
import EditTruckModal from '../components/fleet/EditTruckModal'
import { useTrucks } from '../hooks/useTrucks'

const TABS = [
  { value: 'F250', label: 'F250 Foreman Trucks' },
  { value: 'F550/F600', label: 'F550 / F600 Service' },
]

export default function Fleet() {
  const { trucks, loading, error, updateTruck } = useTrucks()
  const [tab, setTab] = useState('F250')
  const [editingTruck, setEditingTruck] = useState(null)

  const filtered = useMemo(
    () => trucks.filter((t) => t.type === tab),
    [trucks, tab]
  )

  return (
    <div>
      <PageHeader title="Fleet">
        <span className="text-sm text-muted">
          {loading ? '…' : `${trucks.length} vehicles`}
        </span>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-display font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              tab === t.value
                ? 'text-cat-yellow border-b-cat-yellow'
                : 'text-muted border-b-transparent hover:text-text'
            }`}
          >
            {t.label}
            <span className="ml-2 text-xs text-muted">
              ({trucks.filter((tr) => tr.type === t.value).length})
            </span>
          </button>
        ))}
      </div>

      {loading && <p className="text-muted">Loading fleet…</p>}
      {error && (
        <div className="text-svc-red bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          Failed to load fleet: {error.message}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-black-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b-2 border-b-cat-yellow bg-black-soft">
                  <Th>Unit</Th>
                  <Th>Assigned To</Th>
                  <Th className="text-right">Odometer</Th>
                  <Th className="text-right">Last Service</Th>
                  <Th className="text-right">Miles Since Svc</Th>
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const milesSince =
                    t.odometer != null && t.last_svc_mi != null
                      ? t.odometer - t.last_svc_mi
                      : null
                  const assignee = extractAssignee(t.name)
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setEditingTruck(t)}
                      className={`border-b border-border cursor-pointer hover:bg-cat-yellow/5 transition-colors ${
                        i % 2 === 1 ? 'bg-black/30' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-medium text-text-dim">{t.unit}</td>
                      <td className="px-4 py-2.5 text-text-dim">{assignee}</td>
                      <td className="px-4 py-2.5 font-mono text-text-dim text-right">
                        {t.odometer != null ? Number(t.odometer).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted text-right">
                        {t.last_svc_mi != null ? Number(t.last_svc_mi).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-right">
                        {milesSince != null ? (
                          <span className={milesSince > 7500 ? 'text-svc-red' : 'text-text-dim'}>
                            {milesSince.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted text-xs max-w-xs truncate">
                        {t.notes || ''}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted">
                      No vehicles in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EditTruckModal
        truck={editingTruck}
        isOpen={!!editingTruck}
        onClose={() => setEditingTruck(null)}
        onSave={updateTruck}
      />
    </div>
  )
}

function extractAssignee(name) {
  if (!name) return '—'
  const parts = name.split('—')
  return parts.length > 1 ? parts[1].trim() : name
}

function Th({ children, className = '' }) {
  return (
    <th className={`px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs ${className}`}>
      {children}
    </th>
  )
}
