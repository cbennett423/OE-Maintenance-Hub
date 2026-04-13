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
      const patch = { ...changes, updated_at: new Date().toISOString() }

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
        changes,
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
