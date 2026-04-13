import { computeServiceStatus } from '../../lib/serviceLogic'

/**
 * Renders the service status badge(s) for a unit.
 * Mirrors the visual language of the HTML prototype.
 */
export default function ServiceBadge({ unit, size = 'md' }) {
  const status = computeServiceStatus(unit)

  if (status.status === 'none') {
    return <span className="text-muted text-xs font-mono">—</span>
  }

  const sizeClasses =
    size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'

  // Gray "done" style (reserved for future "SERVICE_DONE" state)
  if (status.status === 'done') {
    return (
      <span
        className={`inline-flex items-center rounded font-display font-semibold uppercase tracking-wider bg-muted/20 text-muted border border-muted/40 ${sizeClasses}`}
      >
        {status.primary} Done
      </span>
    )
  }

  // Text override (e.g. "CHECK SERVICE") — green pill
  if (status.status === 'override') {
    return (
      <span
        className={`inline-flex items-center rounded font-display font-semibold uppercase tracking-wider bg-svc-green/20 text-svc-green border border-svc-green/50 ${sizeClasses}`}
      >
        {status.primary}
      </span>
    )
  }

  // Green interval badge + red/green secondary
  const isOverdue = status.status === 'overdue' || status.status === 'forceOverdue'
  const secondaryClasses = isOverdue
    ? 'bg-svc-red/20 text-svc-red border-svc-red/50'
    : status.status === 'kit'
      ? 'bg-svc-green/20 text-svc-green border-svc-green/50'
      : 'bg-svc-red/20 text-svc-red border-svc-red/50' // "order kit" is red

  return (
    <div className="inline-flex flex-wrap items-center gap-1">
      <span
        className={`inline-flex items-center rounded font-display font-semibold uppercase tracking-wider bg-svc-green/20 text-svc-green border border-svc-green/50 ${sizeClasses}`}
      >
        {status.primary}
      </span>
      {status.secondary && (
        <span
          className={`inline-flex items-center rounded font-display font-semibold uppercase tracking-wider border ${secondaryClasses} ${sizeClasses}`}
        >
          {status.secondary}
        </span>
      )}
    </div>
  )
}
