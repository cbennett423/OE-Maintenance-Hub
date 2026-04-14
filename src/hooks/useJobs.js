import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  diffForAuditLog,
  writeAuditLog,
  writeAuditLogBatch,
} from '../lib/auditLog'

/**
 * Fetches all jobs and exposes create / update / delete helpers with
 * audit logging. equipment.site is a string that references jobs.name,
 * so there's no FK cleanup to worry about.
 */
export function useJobs() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    if (error) {
      setError(error)
      setJobs([])
    } else {
      setJobs(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const createJob = useCallback(
    async (data) => {
      const row = {
        id: crypto.randomUUID(),
        name: (data.name || '').trim(),
        address: data.address || null,
        job_number: data.job_number || null,
        active: data.active !== false,
        sort_order: data.sort_order ?? null,
      }
      if (!row.name) return { error: new Error('Name is required') }

      const { error } = await supabase.from('jobs').insert(row)
      if (error) return { error }

      await writeAuditLog({
        unitLabel: row.name,
        changeType: 'job_created',
        field: 'job',
        oldValue: null,
        newValue: `${row.name}${row.address ? ' @ ' + row.address : ''}`,
        changedBy: user?.email || 'unknown',
      })

      await fetchJobs()
      return { error: null, id: row.id }
    },
    [fetchJobs, user?.email]
  )

  const updateJob = useCallback(
    async (id, changes, original) => {
      const patch = { ...changes, updated_at: new Date().toISOString() }
      const { error: updateError } = await supabase
        .from('jobs')
        .update(patch)
        .eq('id', id)

      if (updateError) return { error: updateError }

      const entries = diffForAuditLog({
        unitLabel: original?.name ?? id,
        changes,
        original,
        changedBy: user?.email || 'unknown',
        changeType: 'job_update',
      })
      if (entries.length > 0) await writeAuditLogBatch(entries)

      await fetchJobs()
      return { error: null }
    },
    [fetchJobs, user?.email]
  )

  const deleteJob = useCallback(
    async (id, original) => {
      const { error } = await supabase.from('jobs').delete().eq('id', id)
      if (error) return { error }

      await writeAuditLog({
        unitLabel: original?.name || id,
        changeType: 'job_deleted',
        field: 'job',
        oldValue: `${original?.name || '?'}${original?.address ? ' @ ' + original.address : ''}`,
        newValue: null,
        changedBy: user?.email || 'unknown',
      })

      await fetchJobs()
      return { error: null }
    },
    [fetchJobs, user?.email]
  )

  return { jobs, loading, error, refetch: fetchJobs, createJob, updateJob, deleteJob }
}

/**
 * Build a map from normalized site name → address, for quick lookup
 * by the PDF generator.
 */
export function buildAddressMap(jobs) {
  const map = {}
  for (const j of jobs || []) {
    if (j.name) map[j.name.toUpperCase().trim()] = j.address || ''
  }
  return map
}
