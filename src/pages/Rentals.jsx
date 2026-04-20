import { useMemo, useState } from 'react'
import { Search, Plus, Download, FileText } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import EditRentalModal from '../components/rentals/EditRentalModal'
import Modal from '../components/ui/Modal'
import { useRentals } from '../hooks/useRentals'
import { generateRentalReport } from '../lib/generateRentalReport'

export default function Rentals() {
  const { rentals, loading, error, updateRental, createRental, deleteRental } = useRentals()
  const [search, setSearch] = useState('')
  const [showReturned, setShowReturned] = useState(false)
  const [editingRental, setEditingRental] = useState(null)
  const [addingRental, setAddingRental] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const active = useMemo(() => rentals.filter((r) => !r.date_returned), [rentals])
  const returned = useMemo(() => rentals.filter((r) => !!r.date_returned), [rentals])
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
        <div className="flex gap-2">
          <button
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
          >
            <FileText size={13} /> Rental Report
          </button>
          <button
            onClick={() => setAddingRental(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors"
          >
            <Plus size={13} /> New Rental
          </button>
        </div>
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
            {showReturned ? 'No returned rentals.' : 'No active rentals. Click "New Rental" to add one.'}
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

      {/* Edit existing */}
      <EditRentalModal
        rental={editingRental}
        isOpen={!!editingRental}
        onClose={() => setEditingRental(null)}
        onSave={updateRental}
        onDelete={deleteRental}
      />

      {/* Create new */}
      <EditRentalModal
        rental={null}
        isOpen={addingRental}
        onClose={() => setAddingRental(false)}
        onCreate={createRental}
      />

      {/* Report generator */}
      <RentalReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        rentals={rentals}
      />
    </div>
  )
}

function RentalReportModal({ isOpen, onClose, rentals }) {
  // Default to last 90 days
  const today = new Date()
  const ninetyAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
  const [startDate, setStartDate] = useState(toISO(ninetyAgo))
  const [endDate, setEndDate] = useState(toISO(today))
  const [generating, setGenerating] = useState(false)

  function toISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function handleGenerate() {
    setGenerating(true)
    try {
      const start = new Date(startDate + 'T00:00:00')
      const end = new Date(endDate + 'T23:59:59')
      generateRentalReport(rentals, start, end)
      setTimeout(() => {
        setGenerating(false)
        onClose()
      }, 300)
    } catch (err) {
      setGenerating(false)
      alert('Failed to generate report: ' + err.message)
    }
  }

  function setPreset(days) {
    const end = new Date()
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
    setStartDate(toISO(start))
    setEndDate(toISO(end))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Rental History Report"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={generating}
            className="px-4 py-1.5 text-sm font-display uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !startDate || !endDate}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
          >
            <Download size={13} />
            {generating ? 'Generating…' : 'Generate PDF'}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted mb-4">
        Pick a date range. Includes every rental that overlapped the range — whether active or returned.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full input-dark"
          />
        </div>
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full input-dark"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <p className="text-xs text-muted font-display uppercase tracking-wider mr-1 self-center">Quick:</p>
        {[
          { label: '30 days', days: 30 },
          { label: '90 days', days: 90 },
          { label: '6 months', days: 180 },
          { label: '1 year', days: 365 },
          { label: 'All time', days: 3650 },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => setPreset(p.days)}
            className="px-2.5 py-1 text-[11px] font-display uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>
    </Modal>
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
