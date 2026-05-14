import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useProfiles() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: true })

    if (error) {
      setError(error)
      setProfiles([])
    } else {
      setProfiles(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const updateRole = useCallback(
    async (id, role) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) return { error }
      await fetchProfiles()
      return { error: null }
    },
    [fetchProfiles]
  )

  const inviteUser = useCallback(
    async ({ email, role, full_name }) => {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, role, full_name },
      })
      if (error) {
        // Supabase wraps non-2xx responses in a FunctionsHttpError. The
        // edge function's JSON body is on error.context if present.
        const detail =
          (await safeReadBody(error.context)) || error.message || 'Invite failed'
        return { error: { message: detail } }
      }
      if (data?.error) return { error: { message: data.error } }
      await fetchProfiles()
      return { data, error: null }
    },
    [fetchProfiles]
  )

  return { profiles, loading, error, refetch: fetchProfiles, updateRole, inviteUser }
}

async function safeReadBody(response) {
  if (!response || typeof response.json !== 'function') return null
  try {
    const body = await response.json()
    return body?.error || null
  } catch {
    return null
  }
}
