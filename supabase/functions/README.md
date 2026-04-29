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

## Model choice — Sonnet 4.6

- Sonnet 4.6 with `effort: low` and `thinking: disabled` is the cheap-and-fast configuration. It handles clean digital invoice PDFs well.
- The system prompt is cached (`cache_control: ephemeral`) so per-invoice cost is dominated by the PDF tokens, not the prompt.
- If a particular vendor's scans are too low-quality for Sonnet to read accurately, switch [`_shared/claudeClient.ts`](./_shared/claudeClient.ts) to `claude-opus-4-7` for that workload — Opus has higher-resolution vision (up to 2576px long edge) but costs ~3-5x more.
