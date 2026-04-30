// Client-side wrapper around the `invoice-intake` Supabase Edge Function.
//
// Used as the universal fallback when the Wagner-only regex parser at
// src/lib/parseInvoicePdf.js doesn't recognize the vendor's format. The
// Edge Function calls Claude Opus 4.7 with vision and returns structured
// invoice records — see supabase/functions/invoice-intake/index.ts.
//
// The returned shape is camelCased to mirror parseInvoicePdf's output, plus
// extra fields (vendor, totalAmount, poRaw, pageRange, confidence) that the
// regex parser doesn't surface.

import { supabase } from './supabase'

// Convert a File / Blob to a base64 string (no data: URL prefix). Processed
// in chunks so large PDFs don't blow the call stack on String.fromCharCode.
async function fileToBase64(file) {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// Returns an array of:
//   { vendor, invoiceNumber, invoiceDate, poRaw, totalAmount,
//     lineItems, pageRange, confidence }
// Throws on transport / function errors so callers can decide whether to
// fall back to manual entry.
export async function agentExtractInvoices(file) {
  const pdf_base64 = await fileToBase64(file)
  const { data, error } = await supabase.functions.invoke('invoice-intake', {
    body: { pdf_base64, pdf_filename: file.name },
  })
  if (error) {
    throw new Error(error.message || 'invoice-intake invocation failed')
  }
  if (!data || !Array.isArray(data.invoices)) {
    throw new Error('invoice-intake returned no invoices array')
  }
  return data.invoices.map((inv) => ({
    vendor: inv.vendor || null,
    invoiceNumber: inv.invoice_number || null,
    invoiceDate: inv.invoice_date || null,
    poRaw: inv.po_raw || null,
    shortDescription: inv.short_description || null,
    totalAmount: inv.total_amount ?? null,
    lineItems: inv.line_items || [],
    pageRange: inv.page_range || null,
    confidence: inv.confidence ?? null,
  }))
}
