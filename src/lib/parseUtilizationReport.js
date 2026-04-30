// Parses a VisionLink utilization-report xlsx export into daily SMU readings.
//
// Interim feature while VisionLink API access is pending. The user can pull
// a per-machine utilization report from VisionLink's web UI and upload it
// here; we extract { date, hours } pairs and persist them to
// equipment_hours_history so we can answer "what were the hours on this
// invoice's date?" at WO closeout.
//
// Mirrors the column-detection pattern in parseTelematics.js. The exact
// VisionLink utilization-report format varies (cumulative SMU column vs.
// daily delta vs. both); we look for any column that smells like daily
// hours and any column that smells like a date.

import * as XLSX from 'xlsx'

export function parseUtilizationReport(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })

        if (rows.length === 0) {
          resolve({ rows: [], headers: [] })
          return
        }

        const headers = Object.keys(rows[0])
        const dateCol = findColumn(headers, [
          'date', 'reading date', 'report date', 'day', 'recorded date',
          'datetime', 'timestamp',
        ])
        // Prefer cumulative SMU; fall back to daily-runtime columns.
        const hoursCol =
          findColumn(headers, [
            'cumulative smu', 'smu', 'service meter', 'hour meter',
            'hourmeter', 'cumulative hours', 'engine hours',
            'machine hours', 'end hours', 'ending hours', 'hours',
          ]) ||
          findColumn(headers, [
            'runtime hours', 'utilization hours', 'daily runtime',
            'daily hours', 'hours per day',
          ])
        // Optional: which unit the row is for (only meaningful in a
        // combined multi-machine export).
        const serialCol = findColumn(headers, [
          'serial number', 'serialnumber', 'asset serial', 'equipment serial',
          'serial', 'sn', 's/n', 'machine serial',
        ])

        const parsed = rows
          .map((row) => ({
            date: parseDate(row[dateCol]),
            hours: hoursCol
              ? parseFloat(String(row[hoursCol]).replace(/,/g, ''))
              : null,
            serial: serialCol ? String(row[serialCol]).trim() : null,
            _raw: row,
          }))
          .filter(
            (r) => r.date && r.hours != null && !isNaN(r.hours) && r.hours >= 0
          )
          // Sort oldest-first for deterministic upserts.
          .sort((a, b) => a.date.localeCompare(b.date))

        resolve({
          rows: parsed,
          headers,
          dateCol,
          hoursCol,
          serialCol,
          rawRows: rows,
        })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

// Accept Excel Date objects, ISO strings, MM/DD/YY(YY), DD-MM-YYYY, etc.
// Returns "YYYY-MM-DD" or null.
function parseDate(value) {
  if (!value) return null
  if (value instanceof Date && !isNaN(value)) {
    return formatDate(value)
  }
  const s = String(value).trim()
  if (!s) return null
  // ISO-ish (YYYY-MM-DD)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`
  }
  // MM/DD/YYYY or MM/DD/YY (US-default — VisionLink uses US locale)
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (us) {
    let yy = us[3]
    if (yy.length === 2) yy = '20' + yy
    return `${yy}-${pad(us[1])}-${pad(us[2])}`
  }
  // Last resort: let JS Date parse
  const d = new Date(s)
  if (!isNaN(d)) return formatDate(d)
  return null
}

function formatDate(d) {
  const yy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  return `${yy}-${mm}-${dd}`
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function findColumn(headers, patterns) {
  for (const pattern of patterns) {
    const found = headers.find(
      (h) => h.toLowerCase().trim() === pattern.toLowerCase()
    )
    if (found) return found
  }
  for (const pattern of patterns) {
    const found = headers.find((h) =>
      h.toLowerCase().includes(pattern.toLowerCase())
    )
    if (found) return found
  }
  return null
}
