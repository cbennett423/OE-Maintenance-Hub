const STATUS_STYLES = {
  open: 'bg-cat-yellow/20 text-cat-yellow border-cat-yellow/50',
  closed: 'bg-svc-green/20 text-svc-green border-svc-green/50',
}

const STATUS_LABELS = {
  open: 'Open',
  closed: 'Closed',
}

export default function InvoiceStatusBadge({ status }) {
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
