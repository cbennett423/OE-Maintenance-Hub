import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { writeAuditLog, diffForAuditLog, writeAuditLogBatch } from '../lib/auditLog'
import { writeAliasFromConfirmedMatch } from '../lib/poMatcher'

function invoiceLabel(row) {
  return row?.invoice_number || (row?.id ? `Invoice-${String(row.id).slice(0, 8)}` : 'Invoice')
}

export function useInvoices() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error)
      setInvoices([])
    } else {
      setInvoices(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const createInvoice = useCallback(
    async (data) => {
      const id = data.id || crypto.randomUUID()
      const now = new Date().toISOString()
      const row = {
        id,
        invoice_number: data.invoice_number || null,
        invoice_date: data.invoice_date || null,
        vendor: data.vendor || 'Caterpillar',
        total_amount:
          data.total_amount === '' || data.total_amount == null
            ? null
            : Number(data.total_amount),
        pdf_url: data.pdf_url || null,
        pdf_path: data.pdf_path || null,
        mpw_wo_number:
          data.mpw_wo_number === '' || data.mpw_wo_number == null
            ? null
            : Number(data.mpw_wo_number),
        equipment_id: data.equipment_id || null,
        status: 'open',
        description: data.description || null,
        notes: data.notes || null,
        date_closed: null,
        po_raw: data.po_raw || null,
        line_items: Array.isArray(data.line_items) ? data.line_items : [],
        created_at: now,
        updated_at: now,
      }

      const { error } = await supabase.from('invoices').insert(row)
      if (error) return { error }

      await writeAuditLog({
        unitLabel: invoiceLabel(row),
        changeType: 'invoice_created',
        field: 'invoice',
        oldValue: null,
        newValue: row.invoice_number || row.vendor,
        changedBy: user?.email || 'unknown',
      })

      // Teach the PO matcher whenever the user saved an invoice with both a
      // PO and an equipment_id — they've effectively confirmed the mapping
      // (whether by accepting the auto-fill or picking manually).
      if (row.po_raw && row.equipment_id) {
        await writeAliasFromConfirmedMatch({
          po_raw: row.po_raw,
          equipment_id: row.equipment_id,
          vendor: row.vendor,
          source: 'confirmed_match',
          created_by: user?.email || null,
        })
      }

      await fetchInvoices()
      return { error: null, id }
    },
    [fetchInvoices, user?.email]
  )

  const updateInvoice = useCallback(
    async (id, changes, original) => {
      const patch = { ...changes, updated_at: new Date().toISOString() }

      const { error: updateError } = await supabase
        .from('invoices')
        .update(patch)
        .eq('id', id)

      if (updateError) return { error: updateError }

      const entries = diffForAuditLog({
        unitLabel: invoiceLabel(original),
        changes: patch,
        original,
        changedBy: user?.email || 'unknown',
        changeType: 'invoice_update',
      })
      const filtered = entries.filter((e) => e.field !== 'updated_at')
      if (filtered.length > 0) {
        await writeAuditLogBatch(filtered)
      }

      await fetchInvoices()
      return { error: null }
    },
    [fetchInvoices, user?.email]
  )

  const closeInvoice = useCallback(
    async (id, original) => {
      const today = new Date().toISOString().slice(0, 10)
      const patch = {
        status: 'closed',
        date_closed: today,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('invoices')
        .update(patch)
        .eq('id', id)

      if (updateError) return { error: updateError }

      await writeAuditLog({
        unitLabel: invoiceLabel(original),
        changeType: 'invoice_closed',
        field: 'status',
        oldValue: original?.status || 'open',
        newValue: 'closed',
        changedBy: user?.email || 'unknown',
      })

      await fetchInvoices()
      return { error: null }
    },
    [fetchInvoices, user?.email]
  )

  const reopenInvoice = useCallback(
    async (id, original) => {
      const patch = {
        status: 'open',
        date_closed: null,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('invoices')
        .update(patch)
        .eq('id', id)

      if (updateError) return { error: updateError }

      await writeAuditLog({
        unitLabel: invoiceLabel(original),
        changeType: 'invoice_update',
        field: 'status',
        oldValue: original?.status || 'closed',
        newValue: 'open',
        changedBy: user?.email || 'unknown',
      })

      await fetchInvoices()
      return { error: null }
    },
    [fetchInvoices, user?.email]
  )

  const deleteInvoice = useCallback(
    async (id, original) => {
      if (original?.pdf_path) {
        await supabase.storage
          .from('equipment-files')
          .remove([original.pdf_path])
          .catch(() => {})
      }

      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)

      if (deleteError) return { error: deleteError }

      await writeAuditLog({
        unitLabel: invoiceLabel(original),
        changeType: 'invoice_deleted',
        field: 'invoice',
        oldValue: original?.invoice_number || original?.vendor,
        newValue: null,
        changedBy: user?.email || 'unknown',
      })

      await fetchInvoices()
      return { error: null }
    },
    [fetchInvoices, user?.email]
  )

  return {
    invoices,
    loading,
    error,
    refetch: fetchInvoices,
    createInvoice,
    updateInvoice,
    closeInvoice,
    reopenInvoice,
    deleteInvoice,
  }
}
