const PRIORITY_STYLES = {
  low: 'text-muted',
  medium: 'text-cat-yellow',
  high: 'text-orange-400',
  critical: 'text-svc-red',
}

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
  critical: 'Critical',
}

export default function PriorityBadge({ priority }) {
  const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium
  const label = PRIORITY_LABELS[priority] || priority
  return (
    <span className={`text-[11px] font-display font-semibold uppercase tracking-wider ${style}`}>
      {label}
    </span>
  )
}
