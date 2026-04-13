import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import EditRentalModal from '../components/rentals/EditRentalModal'
import { useRentals } from '../hooks/useRentals'

export default function Rentals() {
  const { rentals, loading, error, updateRental } = useRentals()
  const [search, setSearch] = useState('')
  const [showReturned, setShowReturned] = useState(false)
  const [editingRental, setEditingRental] = useState(null)

  const active = useMemo(
    () => rentals.filter((r) => !r.date_returned),
    [rentals]
  )
  const returned = useMemo(
    () => rentals.filter((r) => !!r.date_returned),
    [rentals]
  )

  const displayList = showReturned ? returned : active

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return displayList
    return displayList.filter((r) => {
      const hay = [r.equipment, r.vendor, r.job, r.agreement_num, r.serial, r.authorized_by, r.notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [displayList, search])

  return (
    <div>
      <PageHeader title="Rentals">
        <span className="text-sm text-muted">
          {loading ? '…' : `${active.length} active`}
        </span>
      </PageHeader>

      {/* Tabs + search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 border-b border-border">
          <TabBtn active={!showReturned} onClick={() => setShowReturned(false)}>
            Active ({active.length})
          </TabBtn>
          <TabBtn active={showReturned} onClick={() => setShowReturned(true)}>
            Returned ({returned.length})
          </TabBtn>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search equipment, vendor, job…"
            className="w-full pl-9 pr-3 py-2 bg-black-card border border-border rounded text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-cat-yellow"
          />
        </div>
      </div>

      {loading && <p className="text-muted">Loading rentals…</p>}
      {error && (
        <div className="text-svc-red bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          Failed to load rentals: {error.message}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-black-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted">
            {showReturned ? 'No returned rentals.' : 'No active rentals.'}
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
                  <Th>Vendor</Th>
                  <Th>Agreement #</Th>
                  <Th>Job</Th>
                  <Th>Date Out</Th>
                  <Th>{showReturned ? 'Returned' : 'Billed Thru'}</Th>
                  <Th>Duration</Th>
                  <Th>Auth</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => setEditingRental(r)}
                    className={`border-b border-border cursor-pointer hover:bg-cat-yellow/5 transition-colors ${
                      i % 2 === 1 ? 'bg-black/30' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-text-dim font-medium">{r.equipment}</td>
                    <td className="px-4 py-2.5 text-text-dim text-xs">{r.vendor || '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.agreement_num || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-text-dim">{r.job || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">{r.date_out || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted whitespace-nowrap">
                      {showReturned ? r.date_returned || '—' : r.billed_thru || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-dim">{r.duration || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted">{r.authorized_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EditRentalModal
        rental={editingRental}
        isOpen={!!editingRental}
        onClose={() => setEditingRental(null)}
        onSave={updateRental}
      />
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-display font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
        active
          ? 'text-cat-yellow border-b-cat-yellow'
          : 'text-muted border-b-transparent hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

function Th({ children }) {
  return (
    <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs">
      {children}
    </th>
  )
}
