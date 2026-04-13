import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 50

export default function AuditLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [userFilter, setUserFilter] = useState('all')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (typeFilter !== 'all') query = query.eq('change_type', typeFilter)
    if (userFilter !== 'all') query = query.eq('changed_by', userFilter)
    if (search.trim()) query = query.ilike('unit_label', `%${search.trim()}%`)

    const { data, error, count } = await query
    if (error) {
      setError(error)
      setEntries([])
    } else {
      setEntries(data || [])
      setTotal(count || 0)
    }
    setLoading(false)
  }, [page, typeFilter, userFilter, search])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  // Fetch distinct change_types and changed_by for filter dropdowns
  const [changeTypes, setChangeTypes] = useState([])
  const [changedByUsers, setChangedByUsers] = useState([])

  useEffect(() => {
    async function loadFilterOptions() {
      const { data: allEntries } = await supabase
        .from('audit_log')
        .select('change_type, changed_by')
        .limit(2000)

      if (allEntries) {
        const types = [...new Set(allEntries.map((e) => e.change_type).filter(Boolean))].sort()
        const users = [...new Set(allEntries.map((e) => e.changed_by).filter(Boolean))].sort()
        setChangeTypes(types)
        setChangedByUsers(users)
      }
    }
    loadFilterOptions()
  }, [])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div>
      <PageHeader title="Audit Log">
        <span className="text-sm text-muted">
          {loading ? '…' : `${total} entries`}
        </span>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search by unit label…"
            className="w-full pl-9 pr-3 py-2 bg-black-card border border-border rounded text-sm text-text placeholder:text-muted/60 focus:outline-none focus:border-cat-yellow"
          />
        </div>
        {changeTypes.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(0) }}
            className="input-dark min-w-[160px]"
          >
            <option value="all">All Types</option>
            {changeTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        {changedByUsers.length > 0 && (
          <select
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(0) }}
            className="input-dark min-w-[160px]"
          >
            <option value="all">All Users</option>
            {changedByUsers.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        )}
      </div>

      {loading && <p className="text-muted">Loading audit log…</p>}
      {error && (
        <div className="text-svc-red bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          Failed to load audit log: {error.message}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="bg-black-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted">No audit log entries match your filters.</p>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="bg-black-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b-2 border-b-cat-yellow bg-black-soft">
                  <Th>When</Th>
                  <Th>Unit</Th>
                  <Th>Type</Th>
                  <Th>Field</Th>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>By</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`border-b border-border ${i % 2 === 1 ? 'bg-black/30' : ''}`}
                  >
                    <td className="px-4 py-2 text-xs text-muted whitespace-nowrap">
                      {formatWhen(e.created_at)}
                    </td>
                    <td className="px-4 py-2 text-xs text-text-dim font-medium">
                      {e.unit_label || '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-display font-semibold uppercase tracking-wider bg-black-soft border border-border text-muted">
                        {e.change_type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-text-dim font-mono">{e.field || '—'}</td>
                    <td className="px-4 py-2 text-xs text-muted max-w-[150px] truncate">{e.old_value ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-text-dim max-w-[150px] truncate">{e.new_value ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-muted">{e.changed_by || e.source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 text-xs font-display uppercase tracking-wider border border-border text-muted hover:text-text rounded transition-colors disabled:opacity-30"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 text-xs font-display uppercase tracking-wider border border-border text-muted hover:text-text rounded transition-colors disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Th({ children }) {
  return (
    <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs">
      {children}
    </th>
  )
}

function formatWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
