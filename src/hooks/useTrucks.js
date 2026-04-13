import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { diffForAuditLog, writeAuditLogBatch } from '../lib/auditLog'

export function useTrucks() {
  const { user } = useAuth()
  const [trucks, setTrucks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTrucks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('trucks')
      .select('*')
      .order('type', { ascending: true })
      .order('unit', { ascending: true })

    if (error) {
      setError(error)
      setTrucks([])
    } else {
      setTrucks(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTrucks()
  }, [fetchTrucks])

  const updateTruck = useCallback(
    async (id, changes, original) => {
      const patch = { ...changes, updated_at: new Date().toISOString() }
      const { error: updateError } = await supabase
        .from('trucks')
        .update(patch)
        .eq('id', id)

      if (updateError) return { error: updateError }

      const entries = diffForAuditLog({
        unitLabel: original?.name ?? original?.unit ?? id,
        changes,
        original,
        changedBy: user?.email || 'unknown',
        changeType: 'truck_update',
      })
      if (entries.length > 0) await writeAuditLogBatch(entries)

      await fetchTrucks()
      return { error: null }
    },
    [fetchTrucks, user?.email]
  )

  return { trucks, loading, error, refetch: fetchTrucks, updateTruck }
}
