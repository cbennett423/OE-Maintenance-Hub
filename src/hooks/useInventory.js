import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { writeAuditLog, diffForAuditLog, writeAuditLogBatch } from '../lib/auditLog'

const CATEGORIES = [
  'Filters',
  'Fluids',
  'Belts & Hoses',
  'Electrical',
  'Undercarriage',
  'Attachments',
  'Shop Supplies',
]

export { CATEGORIES }

export function useInventory() {
  const { user } = useAuth()
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchParts = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('parts_inventory')
      .select('*')
      .order('category', { ascending: true })
      .order('description', { ascending: true })

    if (error) {
      setError(error)
      setParts([])
    } else {
      setParts(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchParts()
  }, [fetchParts])

  const addPart = useCallback(
    async (data) => {
      const row = {
        part_number: data.part_number || null,
        description: data.description,
        category: data.category || 'Shop Supplies',
        quantity_on_hand: data.quantity_on_hand != null ? Number(data.quantity_on_hand) : 0,
        quantity_min: data.quantity_min != null ? Number(data.quantity_min) : 0,
        unit_cost: data.unit_cost != null && data.unit_cost !== '' ? Number(data.unit_cost) : null,
        vendor: data.vendor || null,
        location: data.location || null,
        compatible_equipment: data.compatible_equipment || null,
        last_ordered: data.last_ordered || null,
        notes: data.notes || null,
      }

      const { error } = await supabase.from('parts_inventory').insert(row)
      if (error) return { error }

      await writeAuditLog({
        unitLabel: data.description,
        changeType: 'part_added',
        field: 'parts_inventory',
        oldValue: null,
        newValue: `${data.description} (qty: ${row.quantity_on_hand})`,
        changedBy: user?.email || 'unknown',
      })

      await fetchParts()
      return { error: null }
    },
    [fetchParts, user?.email]
  )

  const updatePart = useCallback(
    async (id, changes, original) => {
      const patch = { ...changes, updated_at: new Date().toISOString() }
      const { error: updateError } = await supabase
        .from('parts_inventory')
        .update(patch)
        .eq('id', id)

      if (updateError) return { error: updateError }

      const entries = diffForAuditLog({
        unitLabel: original?.description ?? id,
        changes,
        original,
        changedBy: user?.email || 'unknown',
        changeType: 'part_update',
      })
      if (entries.length > 0) await writeAuditLogBatch(entries)

      await fetchParts()
      return { error: null }
    },
    [fetchParts, user?.email]
  )

  return { parts, loading, error, refetch: fetchParts, addPart, updatePart }
}
