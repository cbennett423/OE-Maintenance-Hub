// Split a multi-invoice PDF into per-invoice PDFs using the page_range
// each invoice-intake agent extraction returns.
//
// Used by UploadInvoiceModal: after the agent identifies N invoices in a
// batched PDF (e.g. a 3-invoice Wagner mailing), each row gets its own
// single-invoice PDF stored in Supabase Storage. That way, when a mechanic
// later opens that work order's invoice, the "Open PDF" link gives them
// just the one invoice they need to upload into MP Web — no flipping
// through a 5-page batched PDF to find the right one.
//
// pdf-lib is dynamic-imported (~80kb) so it stays out of the initial
// bundle for users who never upload a PDF.

let pdfLibPromise = null
async function getPdfLib() {
  if (!pdfLibPromise) {
    pdfLibPromise = import('pdf-lib')
  }
  return pdfLibPromise
}

// Returns a Blob containing pages [startPage, endPage] (1-indexed,
// inclusive) extracted from `file`. Throws on invalid input or pdf-lib
// errors so the caller can fall back to the original PDF.
export async function extractPagesAsBlob(file, startPage, endPage) {
  if (!file) throw new Error('No file provided')
  if (!Number.isInteger(startPage) || !Number.isInteger(endPage)) {
    throw new Error('Page range must be integers')
  }
  if (startPage < 1 || endPage < startPage) {
    throw new Error(`Invalid page range [${startPage}, ${endPage}]`)
  }

  const { PDFDocument } = await getPdfLib()
  const buf = await file.arrayBuffer()
  const src = await PDFDocument.load(buf)
  const totalPages = src.getPageCount()

  // Clamp end to actual page count (the agent occasionally over-reports).
  const safeEnd = Math.min(endPage, totalPages)
  if (startPage > totalPages) {
    throw new Error(
      `Start page ${startPage} > document length ${totalPages}`
    )
  }

  const out = await PDFDocument.create()
  const indices = []
  for (let p = startPage; p <= safeEnd; p++) indices.push(p - 1) // pdf-lib is 0-indexed
  const pages = await out.copyPages(src, indices)
  for (const page of pages) out.addPage(page)

  const bytes = await out.save()
  // Bytes is a Uint8Array — pass directly so we don't double-allocate.
  return new Blob([bytes], { type: 'application/pdf' })
}

// Returns true if a page_range covers the entire document — used to skip
// splitting when the agent's range is just [1, totalPages].
export async function pageRangeCoversWholePdf(file, [start, end]) {
  if (!file || start !== 1) return false
  const { PDFDocument } = await getPdfLib()
  const buf = await file.arrayBuffer()
  const src = await PDFDocument.load(buf)
  return end >= src.getPageCount()
}
