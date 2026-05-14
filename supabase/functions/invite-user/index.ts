// invite-user Edge Function
//
// Sends a Supabase invite email to a new teammate and stamps their role
// on the profiles row created by the on_auth_user_created trigger.
//
// Only admins can call it — the caller's JWT is checked against the
// profiles table before the service-role client touches anything.
//
// Self-contained (no _shared imports) so the file is ready to paste into
// the Supabase dashboard Edge Function editor without modification.
//
// POST body: { email: string, role: 'admin' | 'member', full_name?: string }
// Response : { user_id: string } on success, { error: string } on failure.

import { createClient } from 'npm:@supabase/supabase-js@^2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Service-role client bypasses RLS — used for the admin invite call and
// the post-invite role update. Never returned to the caller.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ─── Verify caller is an admin ────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  const { data: callerData, error: callerError } = await admin.auth.getUser(jwt)
  if (callerError || !callerData?.user) {
    return json({ error: 'Invalid or expired token' }, 401)
  }

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .single()

  if (profileError || callerProfile?.role !== 'admin') {
    return json({ error: 'Only admins can invite users' }, 403)
  }

  // ─── Parse + validate body ────────────────────────────────────────
  let body: { email?: string; role?: string; full_name?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const role = body.role ?? 'member'
  const fullName = body.full_name?.trim() || null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'A valid email is required' }, 400)
  }
  if (!email.endsWith('@oeconstruct.com')) {
    return json({ error: 'Email must be @oeconstruct.com' }, 400)
  }
  if (role !== 'admin' && role !== 'member') {
    return json({ error: 'Role must be "admin" or "member"' }, 400)
  }

  // ─── Send the invite ──────────────────────────────────────────────
  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email)

  if (inviteError || !inviteData?.user) {
    return json(
      { error: inviteError?.message ?? 'Invite failed' },
      400
    )
  }

  const userId = inviteData.user.id

  // ─── Stamp the role + name on the profile (the trigger has already
  //     inserted the row with defaults). ────────────────────────────
  const { error: updateError } = await admin
    .from('profiles')
    .update({
      role,
      full_name: fullName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (updateError) {
    return json(
      { error: `Invited, but failed to set role: ${updateError.message}` },
      500
    )
  }

  return json({ user_id: userId })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
