import * as XLSX from 'xlsx'

/**
 * Generate an XLSX spreadsheet of machine + telematics data.
 * Excludes units flagged with telematics_issue.
 * Columns: Unit | Serial | Hours | Radio | Radio Software | ECM | ECM Software
 *
 * @param {Array} equipment - rows from useEquipment()
 * @returns {number} count of units exported
 */
export function generateTelematicsSpreadsheet(equipment) {
  const units = (equipment || [])
    .filter((e) => !e.telematics_issue)
    .slice()
    .sort((a, b) => {
      const sa = a.sort_order ?? Number.POSITIVE_INFINITY
      const sb = b.sort_order ?? Number.POSITIVE_INFINITY
      if (sa !== sb) return sa - sb
      return (a.label || '').localeCompare(b.label || '')
    })

  const rows = units.map((e) => ({
    Unit: e.label ?? '',
    Serial: e.serial ?? '',
    Hours: e.hours ?? '',
    Radio: e.product_link_radio ?? '',
    'Radio Software': e.product_link_radio_software ?? '',
    ECM: e.product_link_ecm ?? '',
    'ECM Software': e.product_link_ecm_software ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: ['Unit', 'Serial', 'Hours', 'Radio', 'Radio Software', 'ECM', 'ECM Software'],
  })

  ws['!cols'] = [
    { wch: 12 }, // Unit
    { wch: 18 }, // Serial
    { wch: 10 }, // Hours
    { wch: 18 }, // Radio
    { wch: 18 }, // Radio Software
    { wch: 18 }, // ECM
    { wch: 18 }, // ECM Software
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Machines')

  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const yyyy = now.getFullYear()
  const filename = `OE_Machine_Telematics_${mm}-${dd}-${yyyy}.xlsx`

  XLSX.writeFile(wb, filename)

  return rows.length
}
