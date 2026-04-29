import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches active mechanics from the `mechanics` table (Phase 12).
 * Replaces the hardcoded MECHANICS list previously embedded in
 * CreateWOModal.jsx so the shop can manage the roster as a real table.
 */
export function useMechanics({ includeInactive = false } = {}) {
  const [mechanics, setMechanics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchMechanics = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('mechanics')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    if (!includeInactive) {
      query = query.eq('active', true)
    }

    const { data, error } = await query
    if (error) {
      setError(error)
      setMechanics([])
    } else {
      setMechanics(data || [])
    }
    setLoading(false)
  }, [includeInactive])

  useEffect(() => {
    fetchMechanics()
  }, [fetchMechanics])

  return { mechanics, loading, error, refetch: fetchMechanics }
}
