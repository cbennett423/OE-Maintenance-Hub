// Client-side extraction of invoice number (PSO/WO #) + invoice date from
// Wagner Equipment invoice PDFs. Uses pdfjs-dist (Mozilla) so no external
// API is called — everything runs in the browser.
//
// Returns an array of { invoiceNumber, invoiceDate, rawInvoiceNumber }:
//   invoiceNumber   → PSO/WO # value (e.g. "AHC072415"). What the user wants
//                     auto-filled into the `invoice_number` form field.
//   invoiceDate     → ISO date string "YYYY-MM-DD" from "Invoice Date: MM/DD/YY".
//   rawInvoiceNumber → Wagner's top-right INVOICE NUMBER value (e.g.
//                     "P00C2904256"). Used for deduplication across
//                     multi-page invoices. Not surfaced to the user.
//
// Empty array means parse failed or format wasn't recognized — caller
// falls back to manual entry with no error shown.

// pdfjs-dist is ~1MB — dynamic-imported on first use so it stays out of
// the initial bundle. Cached after first load.
let pdfjsPromise = null
async function getPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import('pdfjs-dist')
      const { default: workerUrl } = await import(
        'pdfjs-dist/build/pdf.worker.min.mjs?url'
      )
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjsLib
    })()
  }
  return pdfjsPromise
}

// Fire-and-forget warm-up so the ~1MB chunk is loaded before the user
// picks a file. Safe to call repeatedly.
export function preloadInvoicePdfParser() {
  getPdfJs()
}

export async function parseInvoicePdf(file) {
  try {
    const pdfjsLib = await getPdfJs()
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let corpus = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = reconstructText(textContent.items)
      corpus += pageText + '\n--PAGE--\n'
    }

    return extractInvoices(corpus)
  } catch (err) {
    console.error('Invoice PDF parse failed', err)
    return []
  }
}

// Reconstruct readable text by grouping items on the same Y (within a
// small tolerance) into lines, sorted top-to-bottom, left-to-right.
function reconstructText(items) {
  if (!items || !items.length) return ''
  const lines = new Map()
  for (const item of items) {
    if (!item.str) continue
    const y = item.transform ? Math.round(item.transform[5]) : 0
    // Bucket Y into 2pt windows so items that should share a line do
    const bucket = Math.round(y / 2) * 2
    if (!lines.has(bucket)) lines.set(bucket, [])
    lines.get(bucket).push(item)
  }
  // Sort buckets top-to-bottom (pdf.js Y increases toward the top)
  const keys = [...lines.keys()].sort((a, b) => b - a)
  return keys
    .map((k) => {
      const group = lines.get(k).sort((a, b) => {
        const ax = a.transform?.[4] || 0
        const bx = b.transform?.[4] || 0
        return ax - bx
      })
      return group.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim()
    })
    .filter(Boolean)
    .join('\n')
}

// Split the document into chunks by unique INVOICE NUMBER: markers, then
// pull invoice date and PSO/WO # from each chunk. Multi-page invoices
// repeat the same INVOICE NUMBER header on every page, so we dedupe by
// the captured value.
function extractInvoices(corpus) {
  const markerRegex = /INVOICE NUMBER:\s*([A-Z0-9]+)/gi
  const markers = []
  let m
  while ((m = markerRegex.exec(corpus)) !== null) {
    markers.push({ index: m.index, raw: m[1] })
  }

  if (markers.length === 0) {
    // Not a Wagner-format PDF — bail silently
    return []
  }

  // Keep only the first occurrence of each unique raw invoice number, in
  // document order. A 2-page invoice appears twice; we want one entry.
  const seen = new Set()
  const unique = []
  for (const mk of markers) {
    if (seen.has(mk.raw)) continue
    seen.add(mk.raw)
    unique.push(mk)
  }

  const results = []
  for (let i = 0; i < unique.length; i++) {
    const start = unique[i].index
    const end = i + 1 < unique.length ? unique[i + 1].index : corpus.length
    const chunk = corpus.slice(start, end)
    const parsed = extractFieldsFromChunk(chunk)
    results.push({
      invoiceNumber: parsed.invoiceNumber,
      invoiceDate: parsed.invoiceDate,
      rawInvoiceNumber: unique[i].raw,
    })
  }
  return results
}

function extractFieldsFromChunk(chunk) {
  // Invoice date — e.g. "Invoice Date: 04/18/26"
  let invoiceDate = null
  const dateMatch = chunk.match(
    /Invoice\s*Date\s*[:\s]+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i
  )
  if (dateMatch) {
    let [, mm, dd, yy] = dateMatch
    if (yy.length === 2) yy = '20' + yy
    invoiceDate = `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  // PSO/WO # — value is in a table cell. Wagner's format is 3 uppercase
  // letters followed by 6–8 digits (e.g. AHC072415). This pattern is
  // distinct from Wagner's top-right INVOICE NUMBER (which starts with
  // at least one digit in positions 2-4, e.g. P00C...).
  let invoiceNumber = null
  const psoMatch = chunk.match(/\b([A-Z]{3}\d{6,8})\b/)
  if (psoMatch) {
    invoiceNumber = psoMatch[1]
  }

  return { invoiceNumber, invoiceDate }
}
