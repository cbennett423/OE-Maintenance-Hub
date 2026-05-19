import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetch recent audit_log entries for a specific equipment id.
 * Linked by equipment_id so the audit history survives unit renames.
 */
export function useUnitAuditLog(unitId, limit = 30) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEntries = useCallback(async () => {
    if (!unitId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('equipment_id', unitId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      setError(error)
      setEntries([])
    } else {
      setEntries(data || [])
    }
    setLoading(false)
  }, [unitId, limit])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  return { entries, loading, error, refetch: fetchEntries }
}
