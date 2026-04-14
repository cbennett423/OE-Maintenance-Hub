import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { diffForAuditLog, writeAuditLogBatch } from '../lib/auditLog'

/**
 * Fetches all equipment rows, exposes a refetch and an updateUnit
 * helper that persists changes and writes audit log entries.
 */
export function useEquipment() {
  const { user } = useAuth()
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEquipment = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('label', { ascending: true })

    if (error) {
      setError(error)
      setEquipment([])
    } else {
      setEquipment(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEquipment()
  }, [fetchEquipment])

  const updateUnit = useCallback(
    async (id, changes, original) => {
      // Auto-clear expired "XXXHR Done" markers. If the incoming patch
      // includes new hours that push past the target interval mark (and
      // the caller didn't already touch svc_override themselves), clear
      // both svc_override and svc_done_at_hours so the Done tag disappears
      // cleanly and the unit doesn't get stuck showing a stale completion.
      let effectiveChanges = changes
      const newHoursRaw =
        'hours' in changes ? changes.hours : original?.hours
      const newHours =
        newHoursRaw == null || newHoursRaw === '' ? null : Number(newHoursRaw)
      const overrideUntouched = !('svc_override' in changes)
      const doneMatch = String(original?.svc_override || '').match(
        /^(\d+)HR\s+Done\b/i
      )
      if (
        overrideUntouched &&
        doneMatch &&
        original?.svc_done_at_hours != null &&
        newHours != null
      ) {
        const intervalNum = parseInt(doneMatch[1], 10)
        const anchor = Number(original.svc_done_at_hours) || 0
        const targetMark =
          Math.floor(anchor / intervalNum) * intervalNum + intervalNum
        if (newHours >= targetMark) {
          effectiveChanges = {
            ...changes,
            svc_override: null,
            svc_done_at_hours: null,
          }
        }
      }

      const patch = {
        ...effectiveChanges,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('equipment')
        .update(patch)
        .eq('id', id)

      if (updateError) {
        return { error: updateError }
      }

      // Write audit log entries for every actually-changed field
      const entries = diffForAuditLog({
        unitLabel: original?.label ?? id,
        changes: effectiveChanges,
        original,
        changedBy: user?.email || 'unknown',
      })
      if (entries.length > 0) {
        await writeAuditLogBatch(entries)
      }

      await fetchEquipment()
      return { error: null }
    },
    [fetchEquipment, user?.email]
  )

  return { equipment, loading, error, refetch: fetchEquipment, updateUnit }
}
