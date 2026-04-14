import { AlertTriangle } from 'lucide-react'
import ServiceBadge from './ServiceBadge'

export default function EquipmentTable({ equipment, onRowClick, onViewProfile }) {
  if (!equipment || equipment.length === 0) {
    return (
      <div className="bg-black-card border border-border rounded-lg p-8 text-center">
        <p className="text-muted">No equipment matches your filters.</p>
      </div>
    )
  }

  return (
    <div className="bg-black-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b-2 border-b-cat-yellow bg-black-soft">
              <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs">Label</th>
              <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs">Serial</th>
              <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs">Site</th>
              <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs text-right">Hours</th>
              <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs">Service</th>
              <th className="px-4 py-2.5 font-display font-semibold uppercase tracking-wider text-muted text-xs">Notes</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((unit, i) => {
              const normSite = (unit.site || '').toUpperCase().trim()
              const prevNormSite = i > 0 ? (equipment[i - 1].site || '').toUpperCase().trim() : null
              const showDivider = normSite !== prevNormSite
              return (
              <>
              {showDivider && (
                <tr key={`site-${normSite}-${i}`} className="bg-black border-b border-border">
                  <td colSpan={6} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-5 bg-cat-yellow rounded-sm" />
                      <span className="font-display text-xs font-bold uppercase tracking-widest text-cat-yellow">
                        {normSite || 'UNASSIGNED'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
              <tr
                key={unit.id}
                onClick={() => onRowClick?.(unit)}
                className={`border-b border-border cursor-pointer hover:bg-cat-yellow/5 transition-colors ${
                  i % 2 === 1 ? 'bg-black/30' : ''
                }`}
              >
                <td className="px-4 py-2.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewProfile?.(unit)
                    }}
                    className="text-text-dim hover:text-cat-yellow font-medium transition-colors text-left"
                  >
                    {unit.label}
                  </button>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">
                  {unit.serial || '—'}
                </td>
                <td className="px-4 py-2.5 text-text-dim text-xs uppercase tracking-wide">
                  {unit.site || '—'}
                </td>
                <td className="px-4 py-2.5 font-mono text-text-dim text-right">
                  <div className="inline-flex items-center gap-1.5 justify-end">
                    {unit.telematics_issue && (
                      <span title="Manual hours — telematics issue">
                        <AlertTriangle size={13} className="text-cat-yellow" />
                      </span>
                    )}
                    {Number(unit.hours || 0).toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <ServiceBadge unit={unit} size="sm" />
                </td>
                <td className="px-4 py-2.5 text-muted text-xs max-w-xs truncate">
                  {unit.notes || ''}
                </td>
              </tr>
              </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
