import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { diffForAuditLog, writeAuditLog, writeAuditLogBatch } from '../lib/auditLog'
import { targetMarkFor } from '../lib/serviceLogic'

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
      // Auto-clear expired "XXXHR Done" markers. This covers two cases:
      //   1. User had an existing Done marker and new hours cross its target
      //   2. User is newly marking a service done, but hours are already
      //      at/past the interval (e.g. 1000HR done at 1014 hrs) — no tag
      //      should exist in the DB in that case.
      // We clear the Done *text* (svc_override) so the gray "Done" badge goes
      // away, but DELIBERATELY KEEP svc_done_at_hours. That value is the
      // persistent "last serviced" anchor computeServiceStatus uses to decide
      // when the next service is due/overdue — nulling it would make a later
      // service silently vanish instead of going OVERDUE (the very bug this
      // logic guards against).
      let effectiveChanges = changes
      const postSave = { ...original, ...changes }
      const doneMatch = String(postSave.svc_override || '').match(
        /^(\d+)HR\s+Done\b/i
      )
      const postSaveHoursRaw = postSave.hours
      const postSaveHours =
        postSaveHoursRaw == null || postSaveHoursRaw === ''
          ? null
          : Number(postSaveHoursRaw)
      const anchorRaw = postSave.svc_done_at_hours
      const anchor =
        anchorRaw == null || anchorRaw === '' ? null : Number(anchorRaw)
      if (doneMatch && anchor != null && postSaveHours != null) {
        const intervalNum = parseInt(doneMatch[1], 10)
        if (intervalNum > 0) {
          const targetMark = targetMarkFor(anchor, intervalNum)
          if (postSaveHours >= targetMark) {
            effectiveChanges = {
              ...changes,
              svc_override: null,
            }
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
        unitId: id,
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

  const addUnit = useCallback(
    async (unit) => {
      const id = crypto.randomUUID()
      const { data, error: insertError } = await supabase
        .from('equipment')
        .insert({ id, ...unit, updated_at: new Date().toISOString() })
        .select()
        .single()

      if (insertError) {
        return { error: insertError }
      }

      await writeAuditLog({
        unitId: id,
        unitLabel: data.label,
        changeType: 'equipment_create',
        field: '_created',
        oldValue: null,
        newValue: JSON.stringify(unit),
        changedBy: user?.email || 'unknown',
      })

      await fetchEquipment()
      return { error: null, data }
    },
    [fetchEquipment, user?.email]
  )

  return { equipment, loading, error, refetch: fetchEquipment, updateUnit, addUnit }
}
