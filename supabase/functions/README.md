# Supabase Edge Functions

Server-side agents for the OE Work Orders accountability loop. They run on Supabase Edge (Deno runtime) so the Anthropic API key is never exposed to the browser.

| Function | Purpose | Spec |
| --- | --- | --- |
| `invoice-intake` | Extracts structured invoices from a (possibly batched) vendor PDF using Claude Opus 4.7 with vision. Universal fallback for the Wagner-only regex parser. | [`../../OE Work Orders/prompts/invoice-intake.md`](../../OE%20Work%20Orders/prompts/invoice-intake.md) |
| `po-matcher` | Three-tier resolution of a freeform PO to a piece of equipment: exact alias hit → normalized label match → LLM fallback. Includes a hallucination guard against invented equipment IDs. | [`../../OE Work Orders/prompts/po-matcher.md`](../../OE%20Work%20Orders/prompts/po-matcher.md) |

Future:
- `visionlink-hours` — VisionLink API call or screenshot parsing for SMU at closeout.
- `inbound-email` — Phase 2: Postmark/SendGrid webhook that drops incoming vendor emails into `invoice-intake`.

## Deployment

```bash
# One-time: set the Anthropic key as a secret on the project
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Deploy a function
supabase functions deploy invoice-intake
supabase functions deploy po-matcher
```

## Local development

```bash
supabase functions serve invoice-intake --env-file ./supabase/.env.local
```

Then POST to `http://localhost:54321/functions/v1/invoice-intake` with a JSON body containing a base64-encoded PDF.

## Calling from the React app

```js
const { data, error } = await supabase.functions.invoke('invoice-intake', {
  body: { pdf_base64, pdf_filename: file.name },
})
```

The shared `_shared/claudeClient.ts` initializes the Anthropic SDK from the `ANTHROPIC_API_KEY` env var and exports the model constant (`claude-opus-4-7`).

## Model choice — Haiku 4.5

- Haiku 4.5 with `thinking: disabled` is the cheapest-and-fastest configuration (~3x cheaper than Sonnet 4.6 on tokens). It handles clean digital invoice PDFs well.
- Note: the `effort` parameter is **not supported on Haiku 4.5** (it errors). The intake and matcher calls therefore omit `output_config` — `effort` only applies on Sonnet 4.6 / Opus-tier models.
- The system prompt is cached (`cache_control: ephemeral`) so per-invoice cost is dominated by the PDF tokens, not the prompt.
- If a particular vendor's scans are too low-quality for Haiku to read accurately, switch that workload up to `claude-sonnet-4-6` (re-add `output_config: { effort: 'low' }`) or `claude-opus-4-7` — Opus has higher-resolution vision (up to 2576px long edge) but costs more.
