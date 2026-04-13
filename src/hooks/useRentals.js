import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { diffForAuditLog, writeAuditLogBatch } from '../lib/auditLog'

export function useRentals() {
  const { user } = useAuth()
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchRentals = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('rentals')
      .select('*')
      .order('date_out', { ascending: false })

    if (error) {
      setError(error)
      setRentals([])
    } else {
      setRentals(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRentals()
  }, [fetchRentals])

  const updateRental = useCallback(
    async (id, changes, original) => {
      const patch = { ...changes, updated_at: new Date().toISOString() }
      const { error: updateError } = await supabase
        .from('rentals')
        .update(patch)
        .eq('id', id)

      if (updateError) return { error: updateError }

      const entries = diffForAuditLog({
        unitLabel: original?.equipment ?? id,
        changes,
        original,
        changedBy: user?.email || 'unknown',
        changeType: 'rental_update',
      })
      if (entries.length > 0) await writeAuditLogBatch(entries)

      await fetchRentals()
      return { error: null }
    },
    [fetchRentals, user?.email]
  )

  return { rentals, loading, error, refetch: fetchRentals, updateRental }
}
