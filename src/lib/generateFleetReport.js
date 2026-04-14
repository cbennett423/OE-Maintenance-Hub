import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { computeServiceStatus } from './serviceLogic'

// Site order from handoff doc — FT Lupton and OE Shop are pinned last
// via siteRank(), not listed here.
const SITE_ORDER = [
  'DIA PREFLIGHT',
  'HUF8 OVERLOT/APS HORIZON',
  'COLUMBINE SQUARE',
  '4 MILE',
  'CCSD LAREDO',
  'BRONCOS TRAINING FACILITY',
  'CU CHAP',
  'CU RESIDENCE HALLS',
]

function siteRank(site) {
  if (!site) return 8500
  const normalized = site.toUpperCase().trim()
  if (normalized === 'OE SHOP') return 10000
  if (normalized === 'FT LUPTON STORAGE YARD') return 9000
  const idx = SITE_ORDER.indexOf(normalized)
  if (idx !== -1) return idx
  return 5000
}

// CAT theme colors
const CAT_YELLOW = [255, 205, 17]
const BLACK = [26, 26, 26]
const DARK_GRAY = [50, 50, 50]
const ROW_GRAY = [245, 245, 245]
const WHITE = [255, 255, 255]
const RED = [198, 40, 40]
const GREEN = [46, 125, 50]

/**
 * Generate the full fleet report PDF matching the OE Construction Corp format.
 * Returns the jsPDF doc or triggers download.
 */
export function generateFleetReport(equipment, rentals, options = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  const today = new Date()
  const dateStr = `${today.getMonth() + 1}/${today.getDate().toString().padStart(2, '0')}/${today.getFullYear()}`

  // Address lookup by normalized site name (uppercase+trim). Options.jobs
  // is expected to be the rows from the `jobs` table.
  const addressMap = {}
  for (const j of options.jobs || []) {
    if (j.name) addressMap[j.name.toUpperCase().trim()] = j.address || ''
  }

  // ── Page 1 & 2: Equipment Report ──────────────────────────

  drawHeader(doc, pageWidth, margin, dateStr, 'Equipment & Services Report')

  // Group equipment by NORMALIZED site so case/whitespace differences
  // don't split the same site into two sections.
  const grouped = groupBySite(equipment)

  // Sort sites by rank (named → unknown → FT Lupton → OE Shop)
  const sortedSites = Object.keys(grouped).sort((a, b) => {
    const rankDiff = siteRank(a) - siteRank(b)
    if (rankDiff !== 0) return rankDiff
    return a.localeCompare(b)
  })

  let startY = 52

  for (const site of sortedSites) {
    const units = grouped[site]
    if (!units || units.length === 0) continue

    // Check if we have room for at least the header + 1 row
    if (startY > pageHeight - 40) {
      drawFooter(doc, pageWidth, pageHeight, margin)
      doc.addPage()
      drawHeader(doc, pageWidth, margin, dateStr, 'Equipment & Services Report')
      startY = 52
    }

    // Site header bar (black background, white site name + lighter address)
    doc.setFillColor(...DARK_GRAY)
    doc.rect(margin, startY, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...WHITE)
    doc.text(site, margin + 3, startY + 5)
    const address = addressMap[site]
    if (address) {
      // Measure site name width to place the address after it
      const siteWidth = doc.getTextWidth(site)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(200, 200, 200) // lighter gray
      doc.text(`  \u00B7  ${address}`, margin + 3 + siteWidth, startY + 5)
    }
    startY += 9

    // Build table data
    const tableData = units.map((u) => {
      const svc = computeServiceStatus(u)
      const svcText = formatServiceText(svc, u)
      return [
        u.label || '',
        u.hours != null ? Number(u.hours).toLocaleString() : '—',
        svcText,
        u.notes || '',
      ]
    })

    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin },
      head: [['EQUIPMENT', 'HOURS', 'SERVICE', 'NOTES / SERVICE INFO']],
      body: tableData,
      theme: 'plain',
      styles: {
        fontSize: 8,
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
        0: { cellWidth: 45, fontStyle: 'bold' },
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 28, halign: 'center', fontSize: 7 },
        3: { cellWidth: 'auto', fontSize: 7.5 },
      },
      alternateRowStyles: {
        fillColor: ROW_GRAY,
      },
      willDrawCell: function (data) {
        // Suppress default rendering on the service column so we can draw
        // each line with its own color in didDrawCell.
        if (data.section === 'body' && data.column.index === 2 && data.cell.raw) {
          data.cell.text = []
        }
      },
      didDrawCell: function (data) {
        if (data.section === 'body' && data.column.index === 2 && data.cell.raw) {
          const raw = String(data.cell.raw)
          if (!raw.trim()) return

          const lines = raw.split('\n')
          const lineHeight = 3
          const cellCenterX = data.cell.x + data.cell.width / 2
          let y =
            data.cell.y +
            data.cell.height / 2 -
            ((lines.length - 1) * lineHeight) / 2 +
            1

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7)

          for (const line of lines) {
            const lc = line.toLowerCase()
            let color = GREEN
            if (lc.includes('order kit') || lc.includes('overdue')) {
              color = RED
            } else if (lc.includes('done')) {
              color = [120, 120, 120]
            }
            doc.setTextColor(...color)
            doc.text(line, cellCenterX, y, { align: 'center' })
            y += lineHeight
          }
        }
      },
    })

    startY = doc.lastAutoTable.finalY + 6
  }

  drawFooter(doc, pageWidth, pageHeight, margin)

  // ── Page 3: Rental Equipment ──────────────────────────────

  if (rentals && rentals.length > 0) {
    doc.addPage()
    drawHeader(doc, pageWidth, margin, dateStr, 'Rental Equipment')

    // Section header
    let ry = 52
    doc.setFillColor(...DARK_GRAY)
    doc.rect(margin, ry, contentWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...WHITE)
    doc.text('RENTAL EQUIPMENT — CURRENT & UPCOMING', margin + 3, ry + 5)
    ry += 9

    const rentalData = rentals.map((r) => [
      r.equipment || '',
      r.vendor || '',
      r.agreement_num || '',
      r.id_num || '',
      r.job || '',
      r.date_out || '',
      r.billed_thru || '',
      r.authorized_by || '',
      r.duration || '',
      r.notes || '',
    ])

    autoTable(doc, {
      startY: ry,
      margin: { left: margin, right: margin },
      head: [['EQUIPMENT', 'VENDOR', 'AGR #', 'ID #', 'JOB', 'DATE OUT', 'BILLED THRU', 'AUTH', 'DURATION', 'NOTES']],
      body: rentalData,
      theme: 'plain',
      styles: {
        fontSize: 6.5,
        cellPadding: { top: 2, bottom: 2, left: 1.5, right: 1.5 },
        textColor: [40, 40, 40],
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        fontSize: 6,
        fontStyle: 'bold',
        textColor: [80, 80, 80],
        fillColor: false,
      },
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold' },
        9: { cellWidth: 35, fontSize: 6 },
      },
      alternateRowStyles: { fillColor: ROW_GRAY },
      didParseCell: function (data) {
        // Highlight reserved/upcoming rentals (no date_out)
        if (data.section === 'body') {
          const row = rentals[data.row.index]
          if (row && !row.date_out && !row.date_returned) {
            data.cell.styles.fillColor = [255, 248, 225] // amber highlight
          }
        }
      },
    })

    drawFooter(doc, pageWidth, pageHeight, margin)
  }

  // Add page numbers
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(`Page ${i}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  // Download
  const filename = `OE_Fleet_Report_${today.getMonth() + 1}-${today.getDate().toString().padStart(2, '0')}-${today.getFullYear()}.pdf`
  doc.save(filename)
}

// ── Helpers ──────────────────────────────────────────────────

function drawHeader(doc, pageWidth, margin, dateStr, subtitle) {
  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...BLACK)
  doc.text('OE Construction Corp', margin + 2, 22)

  // Subtitle + date (right-aligned)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(subtitle, pageWidth - margin, 18, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BLACK)
  doc.text(dateStr, pageWidth - margin, 24, { align: 'right' })

  // Yellow rule
  doc.setDrawColor(...CAT_YELLOW)
  doc.setLineWidth(1.5)
  doc.line(margin, 30, pageWidth - margin, 30)

  // Reset
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
}

function drawFooter(doc, pageWidth, pageHeight, margin) {
  // Yellow rule
  doc.setDrawColor(...CAT_YELLOW)
  doc.setLineWidth(1)
  doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16)

  // Footer text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(
    'OE Construction Corp \u00B7 Confidential Fleet Report \u00B7 Do Not Distribute',
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' }
  )

  // Reset
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
}

function groupBySite(equipment) {
  const grouped = {}
  for (const u of equipment) {
    const normalized = u.site ? u.site.toUpperCase().trim() : 'UNASSIGNED'
    if (!grouped[normalized]) grouped[normalized] = []
    grouped[normalized].push(u)
  }
  // Sort each group by sort_order then label for stable row ordering
  for (const site of Object.keys(grouped)) {
    grouped[site].sort((a, b) => {
      const aOrder = a.sort_order ?? 9999
      const bOrder = b.sort_order ?? 9999
      if (aOrder !== bOrder) return aOrder - bOrder
      return (a.label || '').localeCompare(b.label || '')
    })
  }
  return grouped
}

function formatServiceText(svc, unit) {
  if (svc.status === 'none') return ''
  if (svc.status === 'done') return `${svc.primary} Done`
  if (svc.status === 'override') return svc.primary
  if (svc.status === 'overdue' || svc.status === 'forceOverdue') {
    return `${svc.primary}\nOVERDUE`
  }
  if (svc.status === 'kit') {
    return `${svc.primary}\n${svc.secondary}`
  }
  if (svc.status === 'due') {
    return `${svc.primary}\norder kit`
  }
  return svc.primary || ''
}
