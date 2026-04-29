// po-matcher Edge Function
//
// Matches a vendor's freeform PO/customer-reference string to a piece of
// equipment in the fleet. Three-tier resolution:
//   1. Exact `po_raw` match in equipment_aliases (vendor-scoped)  → confidence 1.0
//   2. Normalized PO match against equipment.label                 → confidence 0.95
//   3. Claude fallback with full equipment list + alias context    → variable
//
// Tier 3 is gated behind an explicit fallback flag so we don't pay LLM
// latency on the common case. The UI always surfaces the suggestion to the
// user for confirmation when confidence < 0.85.
//
// Self-contained (no _shared imports) so the file is ready to paste into
// the Supabase dashboard Edge Function editor without modification.
//
// Source-of-truth prompt: ../../OE Work Orders/prompts/po-matcher.md

import Anthropic from 'npm:@anthropic-ai/sdk@^0.40.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
if (!apiKey) {
  console.warn('[po-matcher] ANTHROPIC_API_KEY is not set.')
}
const anthropic = new Anthropic({ apiKey: apiKey ?? '' })

const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You match a raw vendor PO/customer-reference string to the correct piece of equipment in the company's fleet. The PO field is freeform text that vendors fill in based on what the customer tells them at the parts counter — so it's inconsistent: sometimes just a number ("225"), sometimes prefixed ("CAT-225D"), sometimes verbose ("Unit 225 Excavator"), sometimes a serial number, occasionally wrong.

You will be given an equipment list, a list of known confirmed aliases, and one raw PO string. Return JSON:
{ "equipment_id": <id or null>, "confidence": <0-1>, "reasoning": "<one sentence>" }

Rules:
- If the raw PO is exactly in the alias list, return that with confidence: 1.0.
- If the normalized PO matches an equipment.label, return that with confidence >= 0.95.
- If the PO mentions make/model and only one piece of equipment fits, return it with confidence based on specificity.
- If multiple pieces of equipment plausibly match, return the most likely one with confidence < 0.7.
- If nothing plausibly matches, return equipment_id: null, confidence: 0.
- Never invent an equipment id that isn't in the list.

Output JSON only, no prose.`

interface Equipment {
  id: string
  label: string
  make?: string | null
  model?: string | null
  year?: number | null
  serial_number?: string | null
}

interface Alias {
  po_raw: string
  equipment_id: string
  vendor?: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let payload: {
    po_raw?: string
    vendor?: string
    equipment?: Equipment[]
    aliases?: Alias[]
    use_llm_fallback?: boolean
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    po_raw,
    vendor,
    equipment = [],
    aliases = [],
    use_llm_fallback = true,
  } = payload

  if (!po_raw || typeof po_raw !== 'string') {
    return json({ error: 'Missing po_raw' }, 400)
  }
  if (!Array.isArray(equipment)) {
    return json({ error: 'equipment must be an array' }, 400)
  }

  // Tier 1: exact alias match (vendor-scoped if vendor provided).
  const exactAlias = aliases.find(
    (a) =>
      a.po_raw === po_raw &&
      (vendor == null || a.vendor == null || a.vendor === vendor)
  )
  if (exactAlias) {
    return json({
      equipment_id: exactAlias.equipment_id,
      confidence: 1.0,
      source: 'alias',
      reasoning: 'Exact match in equipment_aliases for this vendor.',
      normalized_po: normalizePo(po_raw),
    })
  }

  // Tier 2: normalized PO -> equipment.label.
  const normalized = normalizePo(po_raw)
  const labelHit = equipment.find((e) => normalizePo(e.label) === normalized)
  if (labelHit) {
    return json({
      equipment_id: labelHit.id,
      confidence: 0.95,
      source: 'normalized',
      reasoning: `Normalized PO "${normalized}" matches equipment label "${labelHit.label}".`,
      normalized_po: normalized,
    })
  }

  // Tier 3: LLM fallback (optional).
  if (!use_llm_fallback) {
    return json({
      equipment_id: null,
      confidence: 0,
      source: 'none',
      reasoning: 'No deterministic match; LLM fallback disabled.',
      normalized_po: normalized,
    })
  }

  try {
    const userMessage = `Equipment list:\n${JSON.stringify(equipment, null, 2)}\n\nKnown aliases:\n${JSON.stringify(aliases, null, 2)}\n\nNew PO to match:\n"${po_raw}"`

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    let parsed: { equipment_id: string | null; confidence: number; reasoning: string }
    try {
      parsed = JSON.parse(text)
    } catch {
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (!fenced) {
        return json(
          { error: 'Model returned non-JSON output', raw: text },
          502
        )
      }
      parsed = JSON.parse(fenced[1])
    }

    // Hallucination guard: refuse equipment_ids the model invented.
    if (
      parsed.equipment_id != null &&
      !equipment.some((e) => e.id === parsed.equipment_id)
    ) {
      return json({
        equipment_id: null,
        confidence: 0,
        source: 'llm',
        reasoning: `Model returned an unknown equipment_id (${parsed.equipment_id}); rejected.`,
        normalized_po: normalized,
      })
    }

    return json({
      equipment_id: parsed.equipment_id,
      confidence: clamp01(parsed.confidence),
      source: 'llm',
      reasoning: parsed.reasoning,
      normalized_po: normalized,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[po-matcher] error', message)
    return json({ error: 'po_matcher_failed', detail: message }, 500)
  }
})

// Strip everything except A-Z and digits, uppercase, drop common prefixes
// vendors slap on the front of unit numbers (CAT-, UNIT, #, etc.).
function normalizePo(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/^(CAT[-\s]?|UNIT[-\s]?|#)+/i, '')
    .replace(/[^A-Z0-9]/g, '')
}

function clamp01(n: unknown): number {
  const x = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(1, x))
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
