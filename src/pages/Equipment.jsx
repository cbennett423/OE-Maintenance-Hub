import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import EquipmentTable from '../components/equipment/EquipmentTable'
import EditUnitModal from '../components/equipment/EditUnitModal'
import { useEquipment } from '../hooks/useEquipment'
import { computeServiceStatus } from '../lib/serviceLogic'

const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'issues', label: 'Any Issue' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due', label: 'Due Soon' },
  { value: 'kit', label: 'Kit Ordered' },
]

// Site display order — matches the weekly fleet report.
// FT Lupton and OE Shop are always pinned second-to-last and last.
const SITE_ORDER = [
  'DIA PREFLIGHT',
  'HUF8 OVERLOT/APS HORIZON',
  'COLUMBINE SQUARE',
  '4 MILE',
  'CCSD LAREDO',
  'BRONCOS TRAINING FACILITY',
  'CU CHAP',
  'CU RESIDENCE HALLS',
]

function siteRank(site) {
  if (!site) return 8500 // no site set — above FT Lupton/OE Shop
  const normalized = site.toUpperCase().trim()
  // Substring match so "OE SHOP", "Shop", "OE Shop Yard" all land last,
  // and "FT LUPTON YARD" / "FT LUPTON STORAGE YARD" land second-to-last.
  if (normalized.includes('OE SHOP') || normalized === 'SHOP') return 10000
  if (normalized.includes('LUPTON')) return 9000
  const idx = SITE_ORDER.indexOf(normalized)
  if (idx !== -1) return idx
  return 5000 // unknown but set — sits between named sites and FT Lupton
}

export default function Equipment() {
  const navigate = useNavigate()
  const { equipment, loading, error, updateUnit } = useEquipment()
  const [search, setSearch] = useState('')
  const [siteFilter, setSiteFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingUnit, setEditingUnit] = useState(null)

  const sites = useMemo(() => {
    const set = new Set()
    equipment.forEach((u) => u.site && set.add(u.site))
    return Array.from(set).sort()
  }, [equipment])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const result = equipment.filter((u) => {
      if (siteFilter !== 'all' && u.site !== siteFilter) return false
      if (statusFilter !== 'all') {
        const s = computeServiceStatus(u).status
        if (statusFilter === 'issues') {
          if (!['due', 'kit', 'overdue', 'forceOverdue', 'override'].includes(s)) return false
        } else if (statusFilter === 'overdue') {
          if (s !== 'overdue' && s !== 'forceOverdue') return false
        } else if (statusFilter === 'due') {
          if (s !== 'due') return false
        } else if (statusFilter === 'kit') {
          if (s !== 'kit') return false
        }
      }
      if (q) {
        const haystack = [u.label, u.serial, u.site, u.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    // Sort by site rank so units with the same site are always contiguous.
    // Uses the normalized (uppercase + trim) site string for grouping so
    // slight differences in casing/whitespace don't split a site in two.
    return result.sort((a, b) => {
      const rankDiff = siteRank(a.site) - siteRank(b.site)
      if (rankDiff !== 0) return rankDiff
      const aNorm = (a.site || '').toUpperCase().trim()
      const bNorm = (b.site || '').toUpperCase().trim()
      const siteDiff = aNorm.localeCompare(bNorm)
      if (siteDiff !== 0) return siteDiff
      const aOrder = a.sort_order ?? 9999
      const bOrder = b.sort_order ?? 9999
      if (aOrder !== bOrder) return aOrder - bOrder
      return (a.label || '').localeCompare(b.label || '')
    })
  }, [equipment, search, siteFilter, statusFilter])

  return (
    <div>
      <PageHeader title="Equipment">
        <span className="text-sm text-muted">
          {loading ? '…' : `${filtered.length} of ${equipment.length}`}
        </span>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search label, serial, site, notes…"
            className="w-full pl-9 pr-3 py-2 bg-black-card border border-border rounded text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-cat-yellow"
          />
        </div>
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="input-dark min-w-[180px]"
        >
          <option value="all">All Sites</option>
          {sites.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-dark min-w-[150px]"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {loading && <p className="text-muted">Loading equipment…</p>}
      {error && (
        <div className="text-svc-red bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          Failed to load equipment: {error.message}
        </div>
      )}
      {!loading && !error && (
        <EquipmentTable
          equipment={filtered}
          onRowClick={setEditingUnit}
          onViewProfile={(u) => navigate(`/equipment/${u.id}`)}
        />
      )}

      <EditUnitModal
        unit={editingUnit}
        sites={sites}
        isOpen={!!editingUnit}
        onClose={() => setEditingUnit(null)}
        onSave={updateUnit}
      />
    </div>
  )
}
