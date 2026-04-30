// Client-side wrapper around the `po-matcher` Supabase Edge Function.
//
// Three-tier resolution lives server-side: exact alias hit → normalized
// label match → LLM fallback. The UI calls this once after invoice extraction
// to suggest an equipment_id + confidence; on user confirmation, callers
// should write the (po_raw, equipment_id, vendor) tuple to equipment_aliases
// via writeAliasFromConfirmedMatch.

import { supabase } from './supabase'

// Confidence ≥ this auto-fills the equipment dropdown without showing the
// confirm chip. Below it, we surface the suggestion and require a tap.
export const PO_MATCH_AUTO_THRESHOLD = 0.85

// Returns { equipment_id, confidence, source, reasoning, normalized_po }
// or null if the lookup failed for any reason. Never throws — callers
// silently fall through to manual entry on error.
export async function matchPo({ po_raw, vendor, equipment, aliases }) {
  if (!po_raw) return null
  try {
    const { data, error } = await supabase.functions.invoke('po-matcher', {
      body: {
        po_raw,
        vendor: vendor || null,
        equipment: (equipment || []).map(slimEquipment),
        aliases: aliases || [],
        use_llm_fallback: true,
      },
    })
    if (error) {
      console.warn('[po-matcher] invoke failed', error)
      return null
    }
    return data
  } catch (err) {
    console.warn('[po-matcher] threw', err)
    return null
  }
}

// Slim down equipment rows before sending to the Edge Function. The
// matcher only needs id + label + a few identifying fields; sending the
// full row inflates the prompt unnecessarily.
function slimEquipment(unit) {
  return {
    id: unit.id,
    label: unit.label,
    make: unit.make ?? null,
    model: unit.model ?? null,
    year: unit.year ?? null,
    serial_number: unit.serial ?? unit.serial_number ?? null,
  }
}

// After the user confirms (or implicitly accepts) a match, persist it so
// the matcher gets a 1.0 hit on the same vendor+po_raw next time. Idempotent
// — the unique index on (po_raw, vendor) makes the second insert a no-op.
export async function writeAliasFromConfirmedMatch({
  po_raw,
  equipment_id,
  vendor,
  source = 'confirmed_match',
  created_by,
}) {
  if (!po_raw || !equipment_id) return { error: null }
  const { error } = await supabase.from('equipment_aliases').insert({
    po_raw,
    po_normalized: normalizePoClient(po_raw),
    equipment_id,
    vendor: vendor || null,
    source,
    created_by: created_by || null,
  })
  // Duplicate violations are fine — alias already exists.
  if (error && error.code !== '23505') {
    console.warn('[po-matcher] alias write failed', error)
    return { error }
  }
  return { error: null }
}

// Mirror of the server-side normalizer in po-matcher/index.ts. Kept in sync
// so the UI can render the normalized form without a round trip.
export function normalizePoClient(raw) {
  if (!raw) return ''
  return String(raw)
    .toUpperCase()
    .replace(/^(CAT[-\s]?|UNIT[-\s]?|#)+/i, '')
    .replace(/[^A-Z0-9]/g, '')
}

// Fetch confirmed aliases for the current vendor. Used to seed the
// matcher's tier-1 (exact) lookup. Returns [] on error so the caller can
// proceed with deterministic + LLM tiers only.
export async function fetchAliasesForVendor(vendor) {
  let q = supabase.from('equipment_aliases').select('po_raw, equipment_id, vendor')
  if (vendor) q = q.or(`vendor.is.null,vendor.eq.${vendor}`)
  const { data, error } = await q
  if (error) {
    console.warn('[po-matcher] fetch aliases failed', error)
    return []
  }
  return data || []
}
