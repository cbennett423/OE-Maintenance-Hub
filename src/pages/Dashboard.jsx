import PageHeader from '../components/layout/PageHeader'

export default function Dashboard() {
  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Service Alerts', value: '--', color: 'border-t-svc-red' },
          { label: 'Open Work Orders', value: '--', color: 'border-t-cat-yellow' },
          { label: 'Low Inventory', value: '--', color: 'border-t-cat-yellow' },
          { label: 'Active Rentals', value: '--', color: 'border-t-svc-green' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-black-card border border-border rounded-lg p-4 border-t-3 ${color}`}>
            <p className="font-display text-3xl font-bold text-text">{value}</p>
            <p className="text-sm text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>
      <p className="text-muted">Dashboard content coming in Phase 6.</p>
    </div>
  )
}
