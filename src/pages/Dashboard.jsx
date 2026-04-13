import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Wrench,
  Package,
  CalendarClock,
  ArrowRight,
  Plus,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import PageHeader from '../components/layout/PageHeader'
import ServiceBadge from '../components/equipment/ServiceBadge'
import WOStatusBadge from '../components/workorders/WOStatusBadge'
import { useEquipment } from '../hooks/useEquipment'
import { useWorkOrders } from '../hooks/useWorkOrders'
import { useRentals } from '../hooks/useRentals'
import { useInventory } from '../hooks/useInventory'
import { computeServiceStatus, forecastIntervals, WARNING_THRESHOLD } from '../lib/serviceLogic'

export default function Dashboard() {
  const { equipment, loading: eqLoading } = useEquipment()
  const { workOrders, loading: woLoading } = useWorkOrders()
  const { rentals, loading: rLoading } = useRentals()
  const { parts, loading: pLoading } = useInventory()

  const loading = eqLoading || woLoading || rLoading || pLoading

  // Service alerts
  const serviceAlerts = useMemo(() => {
    return equipment
      .map((u) => ({ unit: u, status: computeServiceStatus(u) }))
      .filter(({ status }) =>
        ['due', 'kit', 'overdue', 'forceOverdue'].includes(status.status)
      )
      .sort((a, b) => {
        const order = { overdue: 0, forceOverdue: 0, due: 1, kit: 2 }
        return (order[a.status.status] ?? 3) - (order[b.status.status] ?? 3)
      })
  }, [equipment])

  // WO counts
  const woCounts = useMemo(() => {
    const c = { open: 0, in_progress: 0 }
    workOrders.forEach((wo) => {
      if (wo.status === 'open') c.open++
      if (wo.status === 'in_progress') c.in_progress++
    })
    return c
  }, [workOrders])

  // Active rentals
  const activeRentals = useMemo(
    () => rentals.filter((r) => !r.date_returned),
    [rentals]
  )

  // Low stock parts
  const lowStock = useMemo(
    () => parts.filter((p) => p.quantity_on_hand <= p.quantity_min),
    [parts]
  )

  // Equipment by site chart data
  const siteData = useMemo(() => {
    const map = {}
    equipment.forEach((u) => {
      const site = u.site || 'UNASSIGNED'
      map[site] = (map[site] || 0) + 1
    })
    return Object.entries(map)
      .map(([name, count]) => ({ name: shortenSite(name), count }))
      .sort((a, b) => b.count - a.count)
  }, [equipment])

  // Upcoming service (next 30 days worth of hours — rough estimate: ~40hrs/week average usage)
  const upcomingService = useMemo(() => {
    return equipment
      .map((u) => {
        const intervals = forecastIntervals(u.hours)
        const nearest = intervals.reduce(
          (min, i) => (i.hoursRemaining < min.hoursRemaining ? i : min),
          intervals[0]
        )
        return { unit: u, nearest }
      })
      .filter(({ nearest }) => nearest.hoursRemaining <= 200) // ~5 weeks at 40hrs/wk
      .sort((a, b) => a.nearest.hoursRemaining - b.nearest.hoursRemaining)
      .slice(0, 8)
  }, [equipment])

  // Recent audit log entries
  const recentWOs = useMemo(
    () => workOrders.slice(0, 5),
    [workOrders]
  )

  return (
    <div>
      <PageHeader title="Dashboard">
        <div className="flex gap-2">
          <Link
            to="/work-orders"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors"
          >
            <Plus size={13} /> New WO
          </Link>
        </div>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={AlertTriangle}
          label="Service Alerts"
          value={loading ? '…' : serviceAlerts.length}
          color="border-t-svc-red"
          to="/equipment"
        />
        <StatCard
          icon={Wrench}
          label="Open Work Orders"
          value={loading ? '…' : woCounts.open + woCounts.in_progress}
          sub={!loading && woCounts.in_progress > 0 ? `${woCounts.in_progress} in progress` : null}
          color="border-t-cat-yellow"
          to="/work-orders"
        />
        <StatCard
          icon={Package}
          label="Low Inventory"
          value={loading ? '…' : lowStock.length}
          color={lowStock.length > 0 ? 'border-t-svc-red' : 'border-t-svc-green'}
          to="/inventory"
        />
        <StatCard
          icon={CalendarClock}
          label="Active Rentals"
          value={loading ? '…' : activeRentals.length}
          color="border-t-svc-green"
          to="/rentals"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Service alerts list */}
        <Section title="Service Alerts" to="/equipment">
          {serviceAlerts.length === 0 ? (
            <p className="text-muted text-sm p-4">No service alerts.</p>
          ) : (
            <div className="divide-y divide-border">
              {serviceAlerts.slice(0, 6).map(({ unit }) => (
                <Link
                  key={unit.id}
                  to={`/equipment/${unit.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-cat-yellow/5 transition-colors"
                >
                  <span className="text-sm text-text-dim">{unit.label}</span>
                  <ServiceBadge unit={unit} size="sm" />
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* Equipment by site */}
        <Section title="Equipment by Site">
          {siteData.length > 0 && (
            <div className="px-2 pt-2 pb-1">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={siteData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fill: '#888888', fontSize: 11, fontFamily: 'Barlow Condensed' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#2C2C2C', border: '1px solid #3A3A3A', borderRadius: 4, color: '#E8E8E8', fontFamily: 'Barlow' }}
                    cursor={{ fill: 'rgba(255,205,17,0.05)' }}
                  />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                    {siteData.map((_, i) => (
                      <Cell key={i} fill="#FFCD11" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        {/* Upcoming service */}
        <Section title="Upcoming Service" to="/equipment">
          {upcomingService.length === 0 ? (
            <p className="text-muted text-sm p-4">No units approaching service.</p>
          ) : (
            <div className="divide-y divide-border">
              {upcomingService.map(({ unit, nearest }) => (
                <Link
                  key={unit.id}
                  to={`/equipment/${unit.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-cat-yellow/5 transition-colors"
                >
                  <div>
                    <span className="text-sm text-text-dim">{unit.label}</span>
                    <span className="ml-2 text-xs text-muted">{nearest.label} at {nearest.nextAt.toLocaleString()}</span>
                  </div>
                  <span className={`text-xs font-mono ${nearest.hoursRemaining <= WARNING_THRESHOLD ? 'text-svc-red' : 'text-muted'}`}>
                    {nearest.hoursRemaining} hrs
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* Recent work orders */}
        <Section title="Recent Work Orders" to="/work-orders">
          {recentWOs.length === 0 ? (
            <p className="text-muted text-sm p-4">No work orders yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentWOs.map((wo) => (
                <div key={wo.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-text-dim truncate">{wo.equipment_label}</p>
                    <p className="text-xs text-muted truncate">{wo.description}</p>
                  </div>
                  <WOStatusBadge status={wo.status} />
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color, to }) {
  return (
    <Link
      to={to}
      className={`bg-black-card border border-border rounded-lg p-4 border-t-3 ${color} hover:bg-black-card/80 transition-colors group`}
    >
      <div className="flex items-start justify-between">
        <p className="font-display text-3xl font-bold text-text">{value}</p>
        <Icon size={18} className="text-muted group-hover:text-cat-yellow transition-colors" />
      </div>
      <p className="text-sm text-muted mt-1">{label}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </Link>
  )
}

function Section({ title, to, children }) {
  return (
    <div className="bg-black-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-black-soft">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-cat-yellow rounded-sm" />
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted">
            {title}
          </h3>
        </div>
        {to && (
          <Link to={to} className="text-xs text-muted hover:text-cat-yellow transition-colors inline-flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function shortenSite(name) {
  if (!name) return '—'
  // Shorten long site names for chart labels
  return name
    .replace('BRONCOS TRAINING FACILITY', 'BRONCOS TF')
    .replace('FT LUPTON STORAGE YARD', 'FT LUPTON')
    .replace('HUF8 OVERLOT/APS HORIZON', 'HUF8/APS')
    .replace('CU RESIDENCE HALLS', 'CU RES HALLS')
    .replace('COLUMBINE SQUARE', 'COLUMBINE SQ')
    .replace('DIA PREFLIGHT', 'DIA PRE')
    .replace('CCSD LAREDO', 'CCSD')
}
