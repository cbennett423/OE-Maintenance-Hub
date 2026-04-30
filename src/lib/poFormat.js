// PO display normalizer — converts vendor-printed POs into the canonical
// "MODEL-####" form (e.g. "336F-0258", "313F-0188") used everywhere in
// the UI.
//
// The agent stores `po_raw` exactly as printed on the invoice. This helper
// is the display layer: it's pure, idempotent, and falls back to the
// (cleaned) original string when the input doesn't fit the expected
// pattern. We don't store the normalized form — it's deterministic, so
// re-deriving on display avoids schema duplication.
//
// Patterns handled:
//   "336F-0258"        → "336F-0258"   (already canonical)
//   "336F0258"         → "336F-0258"   (insert dash)
//   "336 F 0258"       → "336F-0258"   (compact whitespace)
//   "336 F-0258"       → "336F-0258"
//   "Unit 336F-0258"   → "336F-0258"   (strip prefix)
//   "CAT-336F-0258"    → "336F-0258"
//   "336f-0258"        → "336F-0258"   (uppercase letter)
//   "972H"             → "972H"        (no serial — left alone)
//   "305"              → "305"         (no model letter — left alone)
//   ""                 → null

// Match groups: model digits, model letters (1-2), separator?, serial digits.
// Allows optional whitespace between groups since vendors are inconsistent.
const MODEL_SERIAL = /^(\d{2,4})\s*([A-Z]{1,2})\s*[-\s]?\s*(\d{2,6})$/

// Prefixes that vendors prepend ("UNIT 336F-...", "CAT-336F-...", "#336F-...").
const PREFIX = /^(?:UNIT[-\s]?|CAT[-\s]?|#)+/i

export function standardizePo(raw) {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null
  s = s.replace(PREFIX, '').trim().toUpperCase()
  const m = s.match(MODEL_SERIAL)
  if (m) {
    return `${m[1]}${m[2]}-${m[3]}`
  }
  // No pattern match — return cleaned string so casing/whitespace is at
  // least consistent across the UI.
  return s.replace(/\s+/g, ' ')
}
