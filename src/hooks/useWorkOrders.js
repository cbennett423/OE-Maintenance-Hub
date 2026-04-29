import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { writeAuditLog, diffForAuditLog, writeAuditLogBatch } from '../lib/auditLog'

/**
 * Fetches work orders with optional filters.
 * Provides createWO and updateWO helpers with audit logging.
 */
export function useWorkOrders(filters = {}) {
  const { user } = useAuth()
  const [workOrders, setWorkOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchWorkOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from('work_orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.equipmentId) {
      query = query.eq('equipment_id', filters.equipmentId)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.mechanic) {
      query = query.eq('assigned_mechanic', filters.mechanic)
    }

    const { data, error } = await query
    if (error) {
      setError(error)
      setWorkOrders([])
    } else {
      setWorkOrders(data || [])
    }
    setLoading(false)
  }, [filters.equipmentId, filters.status, filters.mechanic])

  useEffect(() => {
    fetchWorkOrders()
  }, [fetchWorkOrders])

  const createWO = useCallback(
    async (data) => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const row = {
        id,
        equipment_id: data.equipment_id,
        equipment_label: data.equipment_label,
        description: data.description || '',
        date_opened: data.date_opened || now.slice(0, 10),
        status: 'open',
        priority: data.priority || 'medium',
        assigned_mechanic: data.assigned_mechanic || null,
        assigned_mechanic_id: data.assigned_mechanic_id || null,
        parts_needed: data.parts_needed || null,
        cost: data.cost != null && data.cost !== '' ? Number(data.cost) : null,
        notes: data.notes || null,
        date_completed: null,
        created_at: now,
        updated_at: now,
      }

      const { error } = await supabase.from('work_orders').insert(row)
      if (error) return { error }

      await writeAuditLog({
        unitLabel: data.equipment_label,
        changeType: 'work_order_created',
        field: 'work_order',
        oldValue: null,
        newValue: data.description,
        changedBy: user?.email || 'unknown',
      })

      await fetchWorkOrders()
      return { error: null, id }
    },
    [fetchWorkOrders, user?.email]
  )

  const updateWO = useCallback(
    async (id, changes, original) => {
      const patch = { ...changes, updated_at: new Date().toISOString() }

      // Auto-set date_completed when transitioning to completed
      if (changes.status === 'completed' && original?.status !== 'completed') {
        patch.date_completed = new Date().toISOString().slice(0, 10)
      }
      // Clear date_completed if reopening
      if (changes.status && changes.status !== 'completed' && original?.status === 'completed') {
        patch.date_completed = null
      }

      const { error: updateError } = await supabase
        .from('work_orders')
        .update(patch)
        .eq('id', id)

      if (updateError) return { error: updateError }

      const entries = diffForAuditLog({
        unitLabel: original?.equipment_label ?? id,
        changes: patch,
        original,
        changedBy: user?.email || 'unknown',
        changeType: 'work_order_update',
      })
      // Filter out updated_at from audit entries
      const filtered = entries.filter((e) => e.field !== 'updated_at')
      if (filtered.length > 0) {
        await writeAuditLogBatch(filtered)
      }

      await fetchWorkOrders()
      return { error: null }
    },
    [fetchWorkOrders, user?.email]
  )

  return { workOrders, loading, error, refetch: fetchWorkOrders, createWO, updateWO }
}
