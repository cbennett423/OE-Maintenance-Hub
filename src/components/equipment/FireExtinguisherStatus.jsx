export default function FireExtinguisherStatus({ status, size = 'md' }) {
  const sizeClasses =
    size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'

  if (status === 'installed') {
    return (
      <span
        className={`inline-flex items-center rounded font-display font-semibold uppercase tracking-wider bg-svc-green/20 text-svc-green border border-svc-green/50 ${sizeClasses}`}
      >
        ✓ Installed
      </span>
    )
  }

  if (status === 'pending') {
    return (
      <span
        className={`inline-flex items-center rounded font-display font-semibold uppercase tracking-wider bg-svc-red/20 text-svc-red border border-svc-red/50 ${sizeClasses}`}
      >
        Pending
      </span>
    )
  }

  return <span className="text-muted text-xs font-mono">—</span>
}
