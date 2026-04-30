import { useMemo, useState } from 'react'
import { Plus, Search, FileText } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import InvoiceStatusBadge from '../components/invoices/InvoiceStatusBadge'
import UploadInvoiceModal from '../components/invoices/UploadInvoiceModal'
import InvoiceDetailModal from '../components/invoices/InvoiceDetailModal'
import { useInvoices } from '../hooks/useInvoices'
import { useEquipment } from '../hooks/useEquipment'
import { standardizePo } from '../lib/poFormat'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
]

export default function OpenInvoices() {
  const {
    invoices,
    loading,
    error,
    createInvoice,
    updateInvoice,
    closeInvoice,
    reopenInvoice,
    deleteInvoice,
  } = useInvoices()
  const { equipment } = useEquipment()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selected, setSelected] = useState(null)

  const equipmentById = useMemo(() => {
    const map = new Map()
    equipment.forEach((u) => map.set(u.id, u))
    return map
  }, [equipment])

  // Equipment labels are numeric (225, 305, etc.), so use natural numeric
  // sort — otherwise string sort puts "10" before "2".
  const sortedEquipment = useMemo(
    () =>
      [...equipment].sort((a, b) =>
        String(a.label || '').localeCompare(String(b.label || ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      ),
    [equipment]
  )

  const vendors = useMemo(() => {
    const set = new Set()
    invoices.forEach((inv) => inv.vendor && set.add(inv.vendor))
    return Array.from(set).sort()
  }, [invoices])

  const counts = useMemo(() => {
    const c = { open: 0, closed: 0, totalOpen: 0 }
    invoices.forEach((inv) => {
      if (inv.status === 'open') {
        c.open++
        if (inv.total_amount != null) c.totalOpen += Number(inv.total_amount)
      } else if (inv.status === 'closed') {
        c.closed++
      }
    })
    return c
  }, [invoices])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false
      if (vendorFilter !== 'all' && inv.vendor !== vendorFilter) return false
      if (q) {
        const eq = equipmentById.get(inv.equipment_id)
        const haystack = [
          inv.invoice_number,
          inv.description,
          inv.vendor,
          inv.notes,
          // Search both the raw and standardized PO so "336F-0258" and
          // "336F0258" both find the same row.
          inv.po_raw,
          standardizePo(inv.po_raw),
          eq?.label,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [invoices, search, statusFilter, vendorFilter, equipmentById])

  return (
    <div>
      <PageHeader title="Open Invoices">
        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors"
        >
          <Plus size={14} /> Upload Invoice
        </button>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label="Open" value={counts.open} color="border-t-cat-yellow" />
        <StatCard label="Closed" value={counts.closed} color="border-t-svc-green" />
        <StatCard
          label="Total Open $"
          value={
            '$' +
            counts.totalOpen.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
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
            placeholder="Search invoice #, description, PO, vendor, notes…"
            className="w-full pl-9 pr-3 py-2 bg-black-card border border-border rounded text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-cat-yellow"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-dark min-w-[140px]"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {vendors.length > 1 && (
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="input-dark min-w-[160px]"
          >
            <option value="all">All Vendors</option>
            {vendors.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {loading && <p className="text-muted">Loading invoices…</p>}
      {error && (
        <div className="text-svc-red bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          Failed to load invoices: {error.message}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-black-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted">
            {invoices.length === 0
              ? 'No invoices yet. Click "Upload Invoice" to add your first CAT invoice PDF.'
              : 'No invoices match your filters.'}
          </p>
        </div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-black-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b-2 border-b-cat-yellow bg-black-soft">
                  <Th>Vendor</Th>
                  <Th>Invoice #</Th>
                  <Th>Description</Th>
                  <Th>Date</Th>
                  <Th>Equipment</Th>
                  <Th>PO</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Status</Th>
                  <Th className="text-center">PDF</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, i) => {
                  const eq = equipmentById.get(inv.equipment_id)
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelected(inv)}
                      className={`border-b border-border cursor-pointer hover:bg-cat-yellow/5 transition-colors ${
                        i % 2 === 1 ? 'bg-black/30' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-text-dim font-medium">{inv.vendor || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted">
                        {inv.invoice_number || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-text-dim text-xs max-w-xs truncate">
                        {inv.description || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted text-xs whitespace-nowrap">
                        {inv.invoice_date || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted">{eq?.label || '—'}</td>
                      <td
                        className="px-4 py-2.5 font-mono text-xs text-muted"
                        title={inv.po_raw && inv.po_raw !== standardizePo(inv.po_raw) ? `As printed: ${inv.po_raw}` : ''}
                      >
                        {standardizePo(inv.po_raw) || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-text-dim font-mono text-right text-xs">
                        {inv.total_amount != null ? `$${Number(inv.total_amount).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {inv.pdf_url ? (
                          <a
                            href={inv.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex text-muted hover:text-cat-yellow transition-colors"
                            title="Open PDF"
                          >
                            <FileText size={14} />
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <UploadInvoiceModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCreate={createInvoice}
        equipment={sortedEquipment}
      />
      <InvoiceDetailModal
        invoice={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        onUpdate={updateInvoice}
        onCloseInvoice={closeInvoice}
        onReopenInvoice={reopenInvoice}
        onDelete={deleteInvoice}
        equipment={sortedEquipment}
      />
    </div>
  )
}

function StatCard({ label, value, color, isText }) {
  return (
    <div className={`bg-black-card border border-border rounded-lg p-4 border-t-3 ${color}`}>
      <p className={`font-display ${isText ? 'text-xl' : 'text-3xl'} font-bold text-text`}>
        {value}
      </p>
      <p className="text-sm text-muted mt-1">{label}</p>
    </div>
  )
}

function Th({ children, className = '' }) {
  return (
    <th
      className={`px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs ${className}`}
    >
      {children}
    </th>
  )
}
