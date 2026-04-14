import * as XLSX from 'xlsx'

/**
 * Parse a VisionLink xlsx export and extract serial → hours mappings.
 * Auto-detects column names by scanning headers for common patterns.
 */
export function parseVisionLinkExport(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (rows.length === 0) {
          resolve({ rows: [], headers: [], serialCol: null, hoursCol: null, geofenceCol: null })
          return
        }

        const headers = Object.keys(rows[0])

        // Auto-detect columns
        const serialCol = findColumn(headers, ['serial', 'serial number', 'serialnumber', 'asset serial', 'equipment serial'])
        const hoursCol = findColumn(headers, ['hours', 'hour meter', 'hourmeter', 'hour reading', 'engine hours', 'smu', 'cumulative hours'])
        const geofenceCol = findColumn(headers, ['geofence', 'geo fence', 'location', 'site', 'current geofence'])

        // Parse rows into standardized format
        const parsed = rows
          .map((row) => ({
            serial: serialCol ? String(row[serialCol]).trim() : '',
            hours: hoursCol ? parseFloat(String(row[hoursCol]).replace(/,/g, '')) : null,
            geofence: geofenceCol ? String(row[geofenceCol]).trim() : '',
            _raw: row,
          }))
          .filter((r) => r.serial && r.hours != null && !isNaN(r.hours))

        resolve({ rows: parsed, headers, serialCol, hoursCol, geofenceCol, rawRows: rows })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Parse a Samsara Vehicle Activity Report xlsx and extract unit → odometer mappings.
 */
export function parseSamsaraExport(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

        if (rows.length === 0) {
          resolve({ rows: [], headers: [] })
          return
        }

        const headers = Object.keys(rows[0])

        const vehicleCol = findColumn(headers, ['vehicle', 'vehicle name', 'name', 'unit', 'asset', 'asset name'])
        const odometerCol = findColumn(headers, ['end odometer', 'odometer', 'end odo', 'mileage', 'end odometer (mi)', 'odometer (mi)'])

        const parsed = rows
          .map((row) => ({
            vehicle: vehicleCol ? String(row[vehicleCol]).trim() : '',
            odometer: odometerCol ? parseFloat(String(row[odometerCol]).replace(/,/g, '')) : null,
            _raw: row,
          }))
          .filter((r) => r.vehicle && r.odometer != null && !isNaN(r.odometer))

        resolve({ rows: parsed, headers, vehicleCol, odometerCol, rawRows: rows })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Match parsed VisionLink rows to equipment records by serial number.
 * Returns array of { equipment, parsed, oldHours, newHours, changed }
 */
export function matchVisionLinkToEquipment(parsedRows, equipment) {
  const serialMap = {}
  for (const unit of equipment) {
    if (unit.serial) {
      serialMap[unit.serial.toUpperCase()] = unit
    }
  }

  return parsedRows.map((row) => {
    const match = serialMap[row.serial.toUpperCase()]
    if (!match) return { parsed: row, equipment: null, matched: false }

    const oldHours = match.hours
    const newHours = Math.round(row.hours)
    return {
      parsed: row,
      equipment: match,
      matched: true,
      oldHours,
      newHours,
      changed: newHours !== oldHours,
      // Skip units with telematics issues
      skip: match.telematics_issue === true,
    }
  })
}

/**
 * Match parsed Samsara rows to truck records by unit name.
 * Tries matching the vehicle name against truck unit or name fields.
 */
export function matchSamsaraToTrucks(parsedRows, trucks) {
  return parsedRows.map((row) => {
    const vehicle = row.vehicle.toUpperCase()
    const match = trucks.find((t) => {
      const unit = (t.unit || '').toUpperCase()
      const name = (t.name || '').toUpperCase()
      return vehicle.includes(unit) || unit.includes(vehicle) ||
             vehicle.includes(name) || name.includes(vehicle)
    })

    if (!match) return { parsed: row, truck: null, matched: false }

    const oldOdometer = match.odometer
    const newOdometer = Math.round(row.odometer)
    return {
      parsed: row,
      truck: match,
      matched: true,
      oldOdometer,
      newOdometer,
      changed: newOdometer !== oldOdometer,
    }
  })
}

function findColumn(headers, patterns) {
  for (const pattern of patterns) {
    const found = headers.find((h) => h.toLowerCase().trim() === pattern.toLowerCase())
    if (found) return found
  }
  // Partial match
  for (const pattern of patterns) {
    const found = headers.find((h) => h.toLowerCase().includes(pattern.toLowerCase()))
    if (found) return found
  }
  return null
}
