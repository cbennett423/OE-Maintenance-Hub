import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const CAT_YELLOW = [255, 205, 17]
const BLACK = [26, 26, 26]
const DARK_GRAY = [50, 50, 50]
const ROW_GRAY = [245, 245, 245]
const WHITE = [255, 255, 255]

/**
 * Generate a Rental History PDF for rentals that fall within a date range.
 * A rental is included if its date_out falls within [startDate, endDate]
 * OR if it was still active during the range.
 *
 * startDate / endDate are JS Date objects.
 */
export function generateRentalReport(allRentals, startDate, endDate) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2

  const filtered = filterRentalsByDateRange(allRentals, startDate, endDate)
  const today = new Date()
  const dateStr = `${today.getMonth() + 1}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`
  const rangeStr = `${formatDate(startDate)} — ${formatDate(endDate)}`

  // ── Header ─────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...BLACK)
  doc.text('OE Construction Corp', margin + 2, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text('Rental History Report', pageWidth - margin, 16, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BLACK)
  doc.text(rangeStr, pageWidth - margin, 22, { align: 'right' })

  // Yellow rule
  doc.setDrawColor(...CAT_YELLOW)
  doc.setLineWidth(1.5)
  doc.line(margin, 28, pageWidth - margin, 28)
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)

  // Section header
  let y = 36
  doc.setFillColor(...DARK_GRAY)
  doc.rect(margin, y, contentWidth, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text(`RENTAL HISTORY — ${filtered.length} RENTAL${filtered.length !== 1 ? 'S' : ''}`, margin + 3, y + 5)
  y += 9

  // ── Table ──────────────────────────────────────────────
  if (filtered.length === 0) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text('No rentals in the selected date range.', pageWidth / 2, y + 10, { align: 'center' })
  } else {
    const rows = filtered.map((r) => [
      r.equipment || '',
      r.vendor || '',
      r.agreement_num || '',
      r.id_num || '',
      r.job || '',
      r.date_out || '',
      r.date_returned || r.billed_thru || '—',
      r.authorized_by || '',
      r.duration || '',
      r.notes || '',
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['EQUIPMENT', 'VENDOR', 'AGR #', 'ID #', 'JOB', 'DATE OUT', 'RETURNED', 'AUTH', 'DURATION', 'NOTES']],
      body: rows,
      theme: 'plain',
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
        textColor: [40, 40, 40],
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        fontSize: 7,
        fontStyle: 'bold',
        textColor: [80, 80, 80],
        fillColor: false,
      },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        9: { cellWidth: 50, fontSize: 6.5 },
      },
      alternateRowStyles: { fillColor: ROW_GRAY },
      didParseCell: function (data) {
        // Highlight returned rentals with a subtle green tint in date col
        if (data.section === 'body' && data.column.index === 6) {
          const row = filtered[data.row.index]
          if (row.date_returned) {
            data.cell.styles.textColor = [46, 125, 50]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })
  }

  // ── Footer ─────────────────────────────────────────────
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...CAT_YELLOW)
    doc.setLineWidth(1)
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      'OE Construction Corp \u00B7 Confidential Rental History \u00B7 Generated ' + dateStr,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
  }

  const filename = `OE_Rental_History_${formatFilenameDate(startDate)}_to_${formatFilenameDate(endDate)}.pdf`
  doc.save(filename)
}

// ── Helpers ────────────────────────────────────────────

function filterRentalsByDateRange(rentals, startDate, endDate) {
  if (!startDate || !endDate) return rentals
  const start = startDate.getTime()
  const end = endDate.getTime()

  return rentals.filter((r) => {
    const out = parseRentalDate(r.date_out)
    const returned = parseRentalDate(r.date_returned)

    if (!out) return false

    // Rental overlaps the range if:
    //   - it started before the range ended AND
    //   - it returned after the range started (or is still active)
    const outTime = out.getTime()
    const returnedTime = returned ? returned.getTime() : Date.now()

    return outTime <= end && returnedTime >= start
  })
}

function parseRentalDate(str) {
  if (!str) return null
  // Try MM/DD/YYYY, M/D/YYYY, YYYY-MM-DD
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slashMatch) {
    let [, m, d, y] = slashMatch
    y = y.length === 2 ? `20${y}` : y
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return new Date(Number(y), Number(m) - 1, Number(d))
  }
  const parsed = new Date(str)
  return isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(d) {
  if (!d) return ''
  return `${d.getMonth() + 1}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`
}

function formatFilenameDate(d) {
  if (!d) return ''
  return `${d.getMonth() + 1}-${d.getDate().toString().padStart(2, '0')}-${d.getFullYear()}`
}
