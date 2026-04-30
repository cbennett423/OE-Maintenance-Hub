// invoice-intake Edge Function
//
// Extracts structured invoice records from a (possibly batched) vendor PDF
// using Claude Sonnet 4.6. Replaces the Wagner-only regex parser at
// src/lib/parseInvoicePdf.js as the universal extraction path when the
// regex doesn't recognize the vendor's format.
//
// Self-contained (no _shared imports) so the file is ready to paste into
// the Supabase dashboard Edge Function editor without modification.
//
// Source-of-truth prompt: ../../OE Work Orders/prompts/invoice-intake.md
//
// POST body: { pdf_base64: string, pdf_filename?: string }
// Response : { invoices: Array<{ vendor, invoice_number, invoice_date,
//              po_raw, total_amount, line_items, page_range, confidence }> }

import Anthropic from 'npm:@anthropic-ai/sdk@^0.40.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
if (!apiKey) {
  console.warn('[invoice-intake] ANTHROPIC_API_KEY is not set.')
}
const anthropic = new Anthropic({ apiKey: apiKey ?? '' })

const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You extract structured invoice records from heavy-equipment parts/service invoice PDFs. The PDFs come from vendors like Caterpillar, Wagner Equipment, Komatsu, Volvo, Kenworth, and others. A single PDF may contain multiple invoices (a batched mailing) — extract every invoice in the file as a separate record.

For each invoice in the PDF, return:

- vendor — the company that issued the invoice
- invoice_number — the unique invoice identifier printed on the document. If both a "raw" invoice number and a customer-facing number (PSO/WO#) are present, return the raw invoice number here.
- invoice_date — ISO 8601 date (YYYY-MM-DD)
- po_raw — the PO / customer reference exactly as printed. Do not normalize. This is the field the customer (the maintenance shop) wrote on the order — usually their internal unit/equipment number, but format varies (e.g. "225", "CAT-225D", "Unit 225").
- total_amount — number, in USD. Strip currency symbols and commas.
- line_items — array of one object per line on the invoice. Each line:
    - part_number — the vendor's part number / SKU, exactly as printed (e.g. "1R-1808"). null if the line is labor or has no part number.
    - description — the description as printed on the invoice.
    - qty — number, the quantity ordered.
    - unit_price — number.
    - line_total — number.
    - explanation — ONE short sentence (≤25 words) explaining what this part is and what it's for, written for a heavy-equipment mechanic. Examples: "Engine oil filter for C-series engines — replace at every PM service." or "Bucket pin retainer bolt — secures the bucket pin against the boom side."
                    For labor lines, briefly describe the labor type. If you genuinely don't know what the part is, set explanation to null — do NOT guess.
  If line items aren't reliably parseable, return [] and set line_items_unparsed: true.
- page_range — [start, end] 1-indexed page numbers in the source PDF where this invoice appears.
- confidence — number 0–1, your confidence in the extraction.

If a field is genuinely absent from the document, return null — do not guess.

Output: a single JSON object { "invoices": [ ... ] }. No prose before or after.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let payload: { pdf_base64?: string; pdf_filename?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { pdf_base64, pdf_filename } = payload
  if (!pdf_base64 || typeof pdf_base64 !== 'string') {
    return json({ error: 'Missing pdf_base64' }, 400)
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdf_base64,
              },
            },
            {
              type: 'text',
              text: 'Extract every invoice in this PDF. The PDF may contain one invoice or many.',
            },
          ],
        },
      ],
    })

    const text = response.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()

    let parsed: unknown
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

    return json({
      ...((parsed as Record<string, unknown>) ?? {}),
      meta: {
        model: response.model,
        pdf_filename: pdf_filename ?? null,
        usage: response.usage,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[invoice-intake] error', message)
    return json({ error: 'invoice_intake_failed', detail: message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
