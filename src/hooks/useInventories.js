import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches the user-defined inventories list and exposes CRUD helpers.
 * Inventories replace the hardcoded category enum (phase 16+).
 */
export function useInventories() {
  const [inventories, setInventories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchInventories = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('inventories')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      setError(error)
      setInventories([])
    } else {
      setInventories(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchInventories()
  }, [fetchInventories])

  const addInventory = useCallback(
    async (name) => {
      const trimmed = (name || '').trim()
      if (!trimmed) return { error: new Error('Name is required') }
      const { error } = await supabase.from('inventories').insert({ name: trimmed })
      if (error) return { error }
      await fetchInventories()
      return { error: null }
    },
    [fetchInventories]
  )

  const renameInventory = useCallback(
    async (id, newName) => {
      const trimmed = (newName || '').trim()
      if (!trimmed) return { error: new Error('Name is required') }
      const { error } = await supabase
        .from('inventories')
        .update({ name: trimmed, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return { error }
      await fetchInventories()
      return { error: null }
    },
    [fetchInventories]
  )

  const deleteInventory = useCallback(
    async (id) => {
      const { error } = await supabase.from('inventories').delete().eq('id', id)
      if (error) return { error }
      await fetchInventories()
      return { error: null }
    },
    [fetchInventories]
  )

  return {
    inventories,
    loading,
    error,
    refetch: fetchInventories,
    addInventory,
    renameInventory,
    deleteInventory,
  }
}
