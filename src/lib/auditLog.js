import { supabase } from './supabase'

/**
 * Write a single entry to the audit_log table.
 * Use writeAuditLogBatch when logging multiple field changes at once.
 */
export async function writeAuditLog({
  unitLabel,
  changeType,
  field,
  oldValue,
  newValue,
  source = 'webapp',
  changedBy,
}) {
  const entry = {
    unit_label: unitLabel,
    change_type: changeType,
    field,
    old_value: stringifyValue(oldValue),
    new_value: stringifyValue(newValue),
    source,
    changed_by: changedBy,
    report_date: new Date().toISOString().slice(0, 10),
  }
  const { error } = await supabase.from('audit_log').insert(entry)
  if (error) console.error('audit_log insert failed', error)
  return { error }
}

/**
 * Insert many audit_log rows in one round trip.
 */
export async function writeAuditLogBatch(entries) {
  if (!entries || entries.length === 0) return { error: null }
  const rows = entries.map((e) => ({
    unit_label: e.unitLabel,
    change_type: e.changeType,
    field: e.field,
    old_value: stringifyValue(e.oldValue),
    new_value: stringifyValue(e.newValue),
    source: e.source || 'webapp',
    changed_by: e.changedBy,
    report_date: new Date().toISOString().slice(0, 10),
  }))
  const { error } = await supabase.from('audit_log').insert(rows)
  if (error) console.error('audit_log batch insert failed', error)
  return { error }
}

/**
 * Compare two shallow objects and return an array of audit log entry
 * descriptors for every field whose value changed. Only fields present
 * in `changes` are considered.
 */
export function diffForAuditLog({
  unitLabel,
  changes,
  original,
  changedBy,
  changeType = 'equipment_update',
}) {
  const entries = []
  for (const key of Object.keys(changes)) {
    const before = original?.[key]
    const after = changes[key]
    if (!valuesEqual(before, after)) {
      entries.push({
        unitLabel,
        changeType,
        field: key,
        oldValue: before,
        newValue: after,
        changedBy,
      })
    }
  }
  return entries
}

function stringifyValue(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function valuesEqual(a, b) {
  if (a === b) return true
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return String(a) === String(b)
}
