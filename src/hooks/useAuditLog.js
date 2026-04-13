import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetch recent audit_log entries for a specific unit label.
 */
export function useUnitAuditLog(unitLabel, limit = 30) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchEntries = useCallback(async () => {
    if (!unitLabel) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('unit_label', unitLabel)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      setError(error)
      setEntries([])
    } else {
      setEntries(data || [])
    }
    setLoading(false)
  }, [unitLabel, limit])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  return { entries, loading, error, refetch: fetchEntries }
}
