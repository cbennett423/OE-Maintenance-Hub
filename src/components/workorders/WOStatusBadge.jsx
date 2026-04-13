const STATUS_STYLES = {
  open: 'bg-cat-yellow/20 text-cat-yellow border-cat-yellow/50',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  completed: 'bg-svc-green/20 text-svc-green border-svc-green/50',
}

const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
}

export default function WOStatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.open
  const label = STATUS_LABELS[status] || status
  return (
    <span
      className={`inline-flex items-center rounded text-[11px] px-2 py-0.5 font-display font-semibold uppercase tracking-wider border ${style}`}
    >
      {label}
    </span>
  )
}
