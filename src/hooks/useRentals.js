import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { diffForAuditLog, writeAuditLog, writeAuditLogBatch } from '../lib/auditLog'

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

  const createRental = useCallback(
    async (data) => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const row = {
        id,
        equipment: data.equipment || '',
        vendor: data.vendor || null,
        agreement_num: data.agreement_num || null,
        id_num: data.id_num || null,
        serial: data.serial || null,
        job: data.job || null,
        date_out: data.date_out || null,
        date_returned: data.date_returned || null,
        billed_thru: data.billed_thru || null,
        authorized_by: data.authorized_by || null,
        duration: data.duration || null,
        notes: data.notes || null,
        updated_at: now,
      }

      const { error } = await supabase.from('rentals').insert(row)
      if (error) return { error }

      await writeAuditLog({
        unitLabel: data.equipment || id,
        changeType: 'rental_created',
        field: 'rental',
        oldValue: null,
        newValue: `${data.equipment || '?'} from ${data.vendor || '?'} (${data.date_out || 'no date'})`,
        changedBy: user?.email || 'unknown',
      })

      await fetchRentals()
      return { error: null, id }
    },
    [fetchRentals, user?.email]
  )

  const deleteRental = useCallback(
    async (id, original) => {
      const { error } = await supabase.from('rentals').delete().eq('id', id)
      if (error) return { error }

      await writeAuditLog({
        unitLabel: original?.equipment || id,
        changeType: 'rental_deleted',
        field: 'rental',
        oldValue: `${original?.equipment || '?'} from ${original?.vendor || '?'} (${original?.date_out || 'no date'})`,
        newValue: null,
        changedBy: user?.email || 'unknown',
      })

      await fetchRentals()
      return { error: null }
    },
    [fetchRentals, user?.email]
  )

  return {
    rentals,
    loading,
    error,
    refetch: fetchRentals,
    updateRental,
    createRental,
    deleteRental,
  }
}
