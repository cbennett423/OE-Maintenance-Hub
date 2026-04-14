import { useState } from 'react'
import { Upload, Check, AlertTriangle, ArrowRight } from 'lucide-react'

/**
 * Shows a preview of matched telematics data and lets the user confirm updates.
 * Used for both VisionLink (equipment hours) and Samsara (truck odometers).
 */
export default function ImportPreview({ matches, type, onApply, onCancel }) {
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState(null)

  const matched = matches.filter((m) => m.matched)
  const unmatched = matches.filter((m) => !m.matched)
  const changed = matched.filter((m) => m.changed && !m.skip)
  const skipped = matched.filter((m) => m.skip)
  const unchanged = matched.filter((m) => !m.changed && !m.skip)

  const isEquipment = type === 'visionlink'
  const oldLabel = isEquipment ? 'Current Hours' : 'Current Odo'
  const newLabel = isEquipment ? 'New Hours' : 'New Odo'
  const unitField = isEquipment ? 'equipment' : 'truck'

  async function handleApply() {
    setApplying(true)
    try {
      const applied = await onApply(changed)
      setResult({ success: applied, total: changed.length })
    } catch (err) {
      setResult({ error: err.message })
    }
    setApplying(false)
  }

  if (result) {
    return (
      <div className="bg-black-card border border-border border-t-4 border-t-svc-green rounded-lg p-6 text-center">
        <Check size={32} className="text-svc-green mx-auto mb-3" />
        <p className="text-text font-display text-lg font-bold uppercase tracking-wider">
          {result.error ? 'Import Failed' : `${result.success} units updated`}
        </p>
        {result.error && <p className="text-svc-red text-sm mt-2">{result.error}</p>}
        <button
          onClick={onCancel}
          className="mt-4 px-4 py-1.5 text-sm font-display uppercase tracking-wider border border-border text-muted hover:text-text rounded transition-colors"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="bg-black-card border border-border rounded-lg overflow-hidden">
      {/* Summary bar */}
      <div className="px-5 py-3 border-b border-border bg-black-soft flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-svc-green font-display font-semibold uppercase tracking-wider">
            {changed.length} to update
          </span>
          <span className="text-muted">
            {unchanged.length} unchanged
          </span>
          {skipped.length > 0 && (
            <span className="text-cat-yellow flex items-center gap-1">
              <AlertTriangle size={12} /> {skipped.length} skipped (telematics issue)
            </span>
          )}
          {unmatched.length > 0 && (
            <span className="text-muted">
              {unmatched.length} unmatched
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-display uppercase tracking-wider border border-border text-muted hover:text-text rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying || changed.length === 0}
            className="px-4 py-1.5 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
          >
            {applying ? 'Applying…' : `Apply ${changed.length} Updates`}
          </button>
        </div>
      </div>

      {/* Changes table */}
      {changed.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <Th>Unit</Th>
                <Th className="text-right">{oldLabel}</Th>
                <Th className="text-center" />
                <Th className="text-right">{newLabel}</Th>
                <Th className="text-right">Change</Th>
              </tr>
            </thead>
            <tbody>
              {changed.map((m, i) => {
                const unit = m[unitField]
                const label = isEquipment ? unit?.label : unit?.name || unit?.unit
                const oldVal = isEquipment ? m.oldHours : m.oldOdometer
                const newVal = isEquipment ? m.newHours : m.newOdometer
                const diff = newVal - (oldVal || 0)
                return (
                  <tr key={i} className={`border-b border-border ${i % 2 === 1 ? 'bg-black/30' : ''}`}>
                    <td className="px-4 py-2 text-text-dim font-medium">{label}</td>
                    <td className="px-4 py-2 font-mono text-muted text-right">
                      {oldVal != null ? Number(oldVal).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-center text-cat-yellow">
                      <ArrowRight size={14} className="inline" />
                    </td>
                    <td className="px-4 py-2 font-mono text-text-dim text-right font-bold">
                      {Number(newVal).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-right text-xs">
                      <span className={diff > 0 ? 'text-svc-green' : diff < 0 ? 'text-svc-red' : 'text-muted'}>
                        {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {changed.length === 0 && (
        <div className="p-6 text-center text-muted">
          No changes detected — all matched values are the same as current data.
        </div>
      )}

      {/* Skipped units */}
      {skipped.length > 0 && (
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs text-cat-yellow mb-1 font-display uppercase tracking-wider">
            Skipped (telematics issue flag):
          </p>
          <p className="text-xs text-muted">
            {skipped.map((m) => m.equipment?.label).join(', ')}
          </p>
        </div>
      )}

      {/* Unmatched rows */}
      {unmatched.length > 0 && (
        <details className="border-t border-border">
          <summary className="px-4 py-2 text-xs text-muted cursor-pointer hover:text-text">
            {unmatched.length} rows from file did not match any {isEquipment ? 'equipment' : 'truck'}
          </summary>
          <div className="px-4 pb-3 text-xs text-muted">
            {unmatched.map((m, i) => (
              <span key={i} className="inline-block mr-3">
                {isEquipment ? m.parsed.serial : m.parsed.vehicle}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function Th({ children, className = '' }) {
  return (
    <th className={`px-4 py-2 font-display font-semibold uppercase tracking-wider text-muted text-xs ${className}`}>
      {children}
    </th>
  )
}
