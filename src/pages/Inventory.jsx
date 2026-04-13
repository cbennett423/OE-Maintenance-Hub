import { useMemo, useState } from 'react'
import { Plus, Search, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import PartModal from '../components/inventory/PartModal'
import { useInventory, CATEGORIES } from '../hooks/useInventory'

export default function Inventory() {
  const { parts, loading, error, addPart, updatePart } = useInventory()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editingPart, setEditingPart] = useState(null)

  const lowStockCount = useMemo(
    () => parts.filter((p) => p.quantity_on_hand <= p.quantity_min).length,
    [parts]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return parts.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false
      if (stockFilter === 'low' && p.quantity_on_hand > p.quantity_min) return false
      if (stockFilter === 'ok' && p.quantity_on_hand <= p.quantity_min) return false
      if (q) {
        const hay = [p.description, p.part_number, p.vendor, p.location, p.compatible_equipment, p.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [parts, search, categoryFilter, stockFilter])

  return (
    <div>
      <PageHeader title="Inventory">
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors"
        >
          <Plus size={14} /> Add Part
        </button>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard label="Total Parts" value={parts.length} color="border-t-cat-yellow" />
        <StatCard
          label="Low Stock"
          value={lowStockCount}
          color={lowStockCount > 0 ? 'border-t-svc-red' : 'border-t-svc-green'}
          alert={lowStockCount > 0}
        />
        <StatCard
          label="Total Value"
          value={
            '$' +
            parts
              .reduce((sum, p) => sum + (p.unit_cost || 0) * (p.quantity_on_hand || 0), 0)
              .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          }
          color="border-t-cat-yellow"
          isText
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parts, vendors, locations…"
            className="w-full pl-9 pr-3 py-2 bg-black-card border border-border rounded text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-cat-yellow"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-dark min-w-[160px]"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="input-dark min-w-[140px]"
        >
          <option value="all">All Stock</option>
          <option value="low">Low Stock</option>
          <option value="ok">In Stock</option>
        </select>
      </div>

      {loading && <p className="text-muted">Loading inventory…</p>}
      {error && (
        <div className="text-svc-red bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          Failed to load inventory: {error.message}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="bg-black-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted">
            {parts.length === 0
              ? 'No parts in inventory yet. Click "Add Part" to start.'
              : 'No parts match your filters.'}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="bg-black-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b-2 border-b-cat-yellow bg-black-soft">
                  <Th>Description</Th>
                  <Th>Part #</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Qty</Th>
                  <Th className="text-right">Min</Th>
                  <Th className="text-right">Cost</Th>
                  <Th>Vendor</Th>
                  <Th>Location</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const isLow = p.quantity_on_hand <= p.quantity_min
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setEditingPart(p)}
                      className={`border-b border-border cursor-pointer hover:bg-cat-yellow/5 transition-colors ${
                        i % 2 === 1 ? 'bg-black/30' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-text-dim font-medium">
                        <div className="flex items-center gap-1.5">
                          {isLow && <AlertTriangle size={13} className="text-svc-red shrink-0" />}
                          {p.description}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted">{p.part_number || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted">{p.category}</td>
                      <td className={`px-4 py-2.5 font-mono text-right ${isLow ? 'text-svc-red font-bold' : 'text-text-dim'}`}>
                        {p.quantity_on_hand}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-right text-muted">{p.quantity_min}</td>
                      <td className="px-4 py-2.5 font-mono text-right text-text-dim text-xs">
                        {p.unit_cost != null ? `$${Number(p.unit_cost).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted">{p.vendor || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted">{p.location || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add modal */}
      <PartModal
        part={null}
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={addPart}
      />
      {/* Edit modal */}
      <PartModal
        part={editingPart}
        isOpen={!!editingPart}
        onClose={() => setEditingPart(null)}
        onSave={updatePart}
      />
    </div>
  )
}

function StatCard({ label, value, color, alert, isText }) {
  return (
    <div className={`bg-black-card border border-border rounded-lg p-4 border-t-3 ${color}`}>
      <p className={`font-display ${isText ? 'text-xl' : 'text-3xl'} font-bold text-text`}>
        {alert && <AlertTriangle size={18} className="inline text-svc-red mr-1 -mt-1" />}
        {value}
      </p>
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
