import { useState } from 'react'
import { Upload, Check, AlertTriangle, ArrowRight } from 'lucide-react'

export default function ImportPreview({ matches, type, parseMeta, onApply, onCancel }) {
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState(null)

  const matched = matches.filter((m) => m.matched)
  const unmatched = matches.filter((m) => !m.matched)
  const changed = matched.filter((m) => m.changed && !m.skip)
  const skipped = matched.filter((m) => m.skip)
  const unchanged = matched.filter((m) => !m.changed && !m.skip)

  const hoursChangedCount = changed.filter((m) => m.hoursChanged).length
  const siteChangedCount = changed.filter((m) => m.siteChanged).length

  const isEquipment = type === 'visionlink'
  const oldLabel = isEquipment ? 'Current Hours' : 'Current Odo'
  const newLabel = isEquipment ? 'New Hours' : 'New Odo'
  const unitField = isEquipment ? 'equipment' : 'truck'

  // Per-field selection: { [idx]: { hours: bool, site: bool } }
  // Each applicable change starts checked. Samsara only uses `hours`
  // (the odometer field); VisionLink uses both.
  const [selected, setSelected] = useState(() => {
    const map = {}
    changed.forEach((m, i) => {
      map[i] = {
        hours: isEquipment ? !!m.hoursChanged : true,
        site: isEquipment && !!m.siteChanged,
      }
    })
    return map
  })

  function rowHoursApplicable(m) {
    return isEquipment ? !!m.hoursChanged : true
  }
  function rowSiteApplicable(m) {
    return isEquipment && !!m.siteChanged
  }
  function rowHasAnySelected(idx) {
    const m = changed[idx]
    const sel = selected[idx] || {}
    return (rowHoursApplicable(m) && sel.hours) || (rowSiteApplicable(m) && sel.site)
  }
  function rowHasAllSelected(idx) {
    const m = changed[idx]
    const sel = selected[idx] || {}
    return (
      (!rowHoursApplicable(m) || sel.hours) &&
      (!rowSiteApplicable(m) || sel.site)
    )
  }

  const hoursAppliedCount = changed.filter(
    (m, i) => rowHoursApplicable(m) && selected[i]?.hours
  ).length
  const siteAppliedCount = changed.filter(
    (m, i) => rowSiteApplicable(m) && selected[i]?.site
  ).length
  const selectedCount = changed.filter((_, i) => rowHasAnySelected(i)).length
  const allRowsAllSelected = changed.every((_, i) => rowHasAllSelected(i))

  function toggleRow(idx) {
    const m = changed[idx]
    const anySelected = rowHasAnySelected(idx)
    setSelected((prev) => ({
      ...prev,
      [idx]: anySelected
        ? { hours: false, site: false }
        : {
            hours: rowHoursApplicable(m),
            site: rowSiteApplicable(m),
          },
    }))
  }

  function toggleField(idx, field) {
    setSelected((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] || {}), [field]: !prev[idx]?.[field] },
    }))
  }

  function toggleAll() {
    const next = {}
    changed.forEach((m, i) => {
      next[i] = allRowsAllSelected
        ? { hours: false, site: false }
        : { hours: rowHoursApplicable(m), site: rowSiteApplicable(m) }
    })
    setSelected(next)
  }

  async function handleApply() {
    const toApply = changed
      .map((m, i) => ({
        ...m,
        applyHours: rowHoursApplicable(m) && !!selected[i]?.hours,
        applySite: rowSiteApplicable(m) && !!selected[i]?.site,
      }))
      .filter((m) => m.applyHours || m.applySite)
    if (toApply.length === 0) return
    setApplying(true)
    try {
      const applied = await onApply(toApply)
      setResult({ success: applied, total: toApply.length })
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
      {/* Column detection info */}
      {parseMeta && (
        <div className="px-5 py-2 border-b border-border bg-black text-[11px] text-muted flex flex-wrap gap-4">
          <span>Detected columns:</span>
          <span>Serial: <span className="text-text-dim font-mono">{parseMeta.serialCol || '—'}</span></span>
          <span>Hours: <span className="text-text-dim font-mono">{parseMeta.hoursCol || '—'}</span></span>
          <span>
            Geofence:{' '}
            <span className={`font-mono ${parseMeta.geofenceCol ? 'text-text-dim' : 'text-svc-red'}`}>
              {parseMeta.geofenceCol || 'NOT FOUND — site changes won\u2019t appear'}
            </span>
          </span>
        </div>
      )}

      {/* Summary bar */}
      <div className="px-5 py-3 border-b border-border bg-black-soft flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-svc-green font-display font-semibold uppercase tracking-wider">
            {selectedCount} of {changed.length} selected
          </span>
          <span className="text-muted">
            {isEquipment
              ? `${hoursAppliedCount}/${hoursChangedCount} hour ${hoursChangedCount === 1 ? 'change' : 'changes'}`
              : `${hoursChangedCount} ${hoursChangedCount === 1 ? 'change' : 'changes'}`}
          </span>
          {isEquipment && (
            <span className="text-muted">
              {siteAppliedCount}/{siteChangedCount} site {siteChangedCount === 1 ? 'change' : 'changes'}
            </span>
          )}
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
            disabled={applying || selectedCount === 0}
            className="px-4 py-1.5 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
          >
            {applying ? 'Applying…' : `Apply ${selectedCount} Updates`}
          </button>
        </div>
      </div>

      {/* Changes table with checkboxes */}
      {changed.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-4 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={allRowsAllSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-cat-yellow"
                  />
                </th>
                <Th>Unit</Th>
                <Th className="text-right">{oldLabel}</Th>
                <Th className="text-center" />
                <Th className="text-right">{newLabel}</Th>
                <Th className="text-right">Change</Th>
                {isEquipment && <Th>Site</Th>}
              </tr>
            </thead>
            <tbody>
              {changed.map((m, i) => {
                const unit = m[unitField]
                const label = isEquipment ? unit?.label : unit?.name || unit?.unit
                const oldVal = isEquipment ? m.oldHours : m.oldOdometer
                const newVal = isEquipment ? m.newHours : m.newOdometer
                const hoursChanged = rowHoursApplicable(m)
                const siteChanged = rowSiteApplicable(m)
                const diff = newVal - (oldVal || 0)
                const sel = selected[i] || { hours: false, site: false }
                const hoursChecked = hoursChanged && sel.hours
                const siteChecked = siteChanged && sel.site
                const anyChecked = hoursChecked || siteChecked
                return (
                  <tr
                    key={i}
                    onClick={() => toggleRow(i)}
                    className={`border-b border-border cursor-pointer transition-colors ${
                      !anyChecked ? 'opacity-40' : ''
                    } ${i % 2 === 1 ? 'bg-black/30' : ''} hover:bg-cat-yellow/5`}
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={rowHasAllSelected(i)}
                        onChange={() => toggleRow(i)}
                        className="w-4 h-4 accent-cat-yellow"
                      />
                    </td>
                    <td className="px-4 py-2 text-text-dim font-medium">{label}</td>
                    <td className="px-4 py-2 font-mono text-muted text-right">
                      {oldVal != null ? Number(oldVal).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-2 text-center text-cat-yellow">
                      {hoursChanged ? <ArrowRight size={14} className="inline" /> : <span className="text-muted">·</span>}
                    </td>
                    <td className="px-4 py-2 font-mono text-text-dim text-right font-bold">
                      {hoursChanged ? (
                        isEquipment ? (
                          <label
                            className={`inline-flex items-center justify-end gap-2 cursor-pointer ${hoursChecked ? '' : 'opacity-50'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={!!sel.hours}
                              onChange={() => toggleField(i, 'hours')}
                              className="w-3.5 h-3.5 accent-cat-yellow"
                            />
                            <span>{Number(newVal).toLocaleString()}</span>
                          </label>
                        ) : (
                          Number(newVal).toLocaleString()
                        )
                      ) : (
                        <span className="text-muted">{Number(oldVal || 0).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-right text-xs">
                      {hoursChanged ? (
                        <span className={diff > 0 ? 'text-svc-green' : diff < 0 ? 'text-svc-red' : 'text-muted'}>
                          {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    {isEquipment && (
                      <td className="px-4 py-2 text-xs">
                        {siteChanged ? (
                          <label
                            className={`inline-flex items-center gap-2 cursor-pointer ${siteChecked ? 'text-cat-yellow' : 'text-cat-yellow/60'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={!!sel.site}
                              onChange={() => toggleField(i, 'site')}
                              className="w-3.5 h-3.5 accent-cat-yellow"
                            />
                            <span className="text-muted">{m.oldSite || '—'}</span>
                            <ArrowRight size={11} />
                            <span className="font-bold">{m.newSite}</span>
                          </label>
                        ) : (
                          <span className="text-muted">{m.oldSite || '—'}</span>
                        )}
                      </td>
                    )}
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
