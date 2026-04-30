import { useState } from 'react'
import { FileText, Upload, Check, Download, Table, Clock } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import { useEquipment } from '../hooks/useEquipment'
import { useTrucks } from '../hooks/useTrucks'
import { useRentals } from '../hooks/useRentals'
import { useJobs } from '../hooks/useJobs'
import { generateFleetReport } from '../lib/generateFleetReport'
import { generateTelematicsSpreadsheet } from '../lib/generateTelematicsSpreadsheet'
import { useAuth } from '../context/AuthContext'
import { writeAuditLog } from '../lib/auditLog'
import { parseVisionLinkExport, parseSamsaraExport, matchVisionLinkToEquipment, matchSamsaraToTrucks } from '../lib/parseTelematics'
import { parseUtilizationReport } from '../lib/parseUtilizationReport'
import { upsertHoursReadings, getHoursCoverage } from '../lib/equipmentHours'
import ImportPreview from '../components/reports/ImportPreview'


export default function Reports() {
  const { user } = useAuth()
  const { equipment, updateUnit, refetch: refetchEquipment } = useEquipment()
  const { trucks, updateTruck, refetch: refetchTrucks } = useTrucks()
  const { rentals } = useRentals()
  const { jobs } = useJobs()
  const [generating, setGenerating] = useState(false)
  const [generatingSheet, setGeneratingSheet] = useState(false)

  // Import state
  const [importType, setImportType] = useState(null) // 'visionlink' | 'samsara' | null
  const [importMatches, setImportMatches] = useState(null)
  const [importError, setImportError] = useState(null)

  async function handleGenerateFleetReport() {
    setGenerating(true)
    try {
      await generateFleetReport(equipment, rentals, { jobs })
      await writeAuditLog({
        unitLabel: 'SYSTEM',
        changeType: 'report_generated',
        field: 'fleet_report',
        oldValue: null,
        newValue: `Fleet report generated — ${equipment.length} units, ${rentals.filter(r => !r.date_returned).length} active rentals`,
        changedBy: user?.email || 'unknown',
      })
    } catch (err) {
      console.error('PDF generation failed', err)
      alert('Failed to generate report: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerateMachineTelematicsReport() {
    setGeneratingSheet(true)
    try {
      const count = generateTelematicsSpreadsheet(equipment)
      await writeAuditLog({
        unitLabel: 'SYSTEM',
        changeType: 'report_generated',
        field: 'machine_telematics_spreadsheet',
        oldValue: null,
        newValue: `Machine & telematics spreadsheet generated — ${count} units`,
        changedBy: user?.email || 'unknown',
      })
    } catch (err) {
      console.error('Spreadsheet generation failed', err)
      alert('Failed to generate spreadsheet: ' + err.message)
    } finally {
      setGeneratingSheet(false)
    }
  }

  const [parseMeta, setParseMeta] = useState(null)

  async function handleVisionLinkImport(file) {
    setImportError(null)
    try {
      const parsed = await parseVisionLinkExport(file)
      if (parsed.rows.length === 0) {
        setImportError('No data found in file. Check that it has serial number and hours columns.')
        return
      }
      const matches = matchVisionLinkToEquipment(parsed.rows, equipment)
      setImportType('visionlink')
      setImportMatches(matches)
      setParseMeta({
        serialCol: parsed.serialCol,
        hoursCol: parsed.hoursCol,
        geofenceCol: parsed.geofenceCol,
        totalRows: parsed.rows.length,
      })
    } catch (err) {
      setImportError('Failed to parse file: ' + err.message)
    }
  }

  async function handleSamsaraImport(file) {
    setImportError(null)
    try {
      const parsed = await parseSamsaraExport(file)
      if (parsed.rows.length === 0) {
        setImportError('No data found in file. Check that it has vehicle and odometer columns.')
        return
      }
      const matches = matchSamsaraToTrucks(parsed.rows, trucks)
      setImportType('samsara')
      setImportMatches(matches)
    } catch (err) {
      setImportError('Failed to parse file: ' + err.message)
    }
  }

  async function applyVisionLinkUpdates(changed) {
    let count = 0
    for (const m of changed) {
      const patch = {}
      if (m.hoursChanged) patch.hours = m.newHours
      if (m.siteChanged) patch.site = m.newSite
      if (Object.keys(patch).length === 0) continue
      const result = await updateUnit(m.equipment.id, patch, m.equipment)
      if (!result.error) count++
    }
    await refetchEquipment()
    return count
  }

  async function applySamsaraUpdates(changed) {
    let count = 0
    for (const m of changed) {
      const result = await updateTruck(m.truck.id, { odometer: m.newOdometer }, m.truck)
      if (!result.error) count++
    }
    await refetchTrucks()
    return count
  }


  return (
    <div>
      <PageHeader title="Reports" />

      {/* Generate reports from live data */}
      <SectionHeader title="Generate Reports" />
      <div className="grid gap-4 mb-6">
        <div className="bg-black-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileText size={20} className="text-cat-yellow mt-0.5 shrink-0" />
              <div>
                <h3 className="font-display text-base font-bold uppercase tracking-wider text-text">
                  Weekly Fleet Report
                </h3>
                <p className="text-sm text-muted mt-1">
                  Full fleet report by site with equipment, hours, service status, notes, and rental equipment. Generated from live Supabase data.
                </p>
                <p className="text-xs text-muted mt-2">
                  {equipment.length} equipment units · {rentals.filter(r => !r.date_returned).length} active rentals
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateFleetReport}
              disabled={generating || equipment.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50 shrink-0"
            >
              <Download size={15} />
              {generating ? 'Generating…' : 'Generate PDF'}
            </button>
          </div>
        </div>

        <div className="bg-black-card border border-border rounded-lg p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Table size={20} className="text-cat-yellow mt-0.5 shrink-0" />
              <div>
                <h3 className="font-display text-base font-bold uppercase tracking-wider text-text">
                  Machine & Telematics Export
                </h3>
                <p className="text-sm text-muted mt-1">
                  Machine list with serial, hours, and radio/ECM firmware versions. Excludes units flagged with telematics issues.
                </p>
                <p className="text-xs text-muted mt-2">
                  {equipment.filter(e => !e.telematics_issue).length} telematics-enabled units
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateMachineTelematicsReport}
              disabled={generatingSheet || equipment.filter(e => !e.telematics_issue).length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50 shrink-0"
            >
              <Download size={15} />
              {generatingSheet ? 'Generating…' : 'Generate XLSX'}
            </button>
          </div>
        </div>
      </div>

      {/* Import telematics data */}
      <SectionHeader title="Import Telematics Data" />

      {importMatches && (
        <div className="mb-6">
          <ImportPreview
            matches={importMatches}
            type={importType}
            parseMeta={parseMeta}
            onApply={importType === 'visionlink' ? applyVisionLinkUpdates : applySamsaraUpdates}
            onCancel={() => { setImportMatches(null); setImportType(null); setParseMeta(null) }}
          />
        </div>
      )}

      {!importMatches && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <ImportUploadCard
            label="VisionLink Export"
            description="Upload xlsx to update equipment hours. Matches by serial number."
            accept=".xlsx,.xls,.csv"
            onFile={handleVisionLinkImport}
            count={`${equipment.length} equipment units`}
          />
          <ImportUploadCard
            label="Samsara Vehicle Report"
            description="Upload xlsx to update truck odometers. Matches by vehicle name."
            accept=".xlsx,.xls,.csv"
            onFile={handleSamsaraImport}
            count={`${trucks.length} trucks`}
          />
        </div>
      )}

      {importError && (
        <div className="mb-6 text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2">
          {importError}
        </div>
      )}

      {/* Utilization-report import — interim machine-hours-by-date feed
          while VisionLink API access is pending. */}
      <SectionHeader title="Import VisionLink Utilization Report" />
      <UtilizationImportCard equipment={equipment} userEmail={user?.email} />

    </div>
  )
}

function UtilizationImportCard({ equipment, userEmail }) {
  const [equipmentId, setEquipmentId] = useState('')
  const [parsedRows, setParsedRows] = useState(null)
  const [parseMeta, setParseMeta] = useState(null)
  const [coverage, setCoverage] = useState(null)
  const [parseErr, setParseErr] = useState(null)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(null)

  async function handleEquipmentChange(id) {
    setEquipmentId(id)
    setCoverage(null)
    if (id) {
      const cov = await getHoursCoverage(id)
      setCoverage(cov)
    }
  }

  async function handleFile(file) {
    if (!file) return
    setParseErr(null)
    setImported(null)
    try {
      const result = await parseUtilizationReport(file)
      if (result.rows.length === 0) {
        setParseErr(
          'No usable rows in file. Need a date column and an SMU/hours column.'
        )
        return
      }
      setParsedRows(result.rows)
      setParseMeta({
        dateCol: result.dateCol,
        hoursCol: result.hoursCol,
        serialCol: result.serialCol,
        total: result.rows.length,
        firstDate: result.rows[0]?.date,
        lastDate: result.rows[result.rows.length - 1]?.date,
      })
    } catch (err) {
      setParseErr('Failed to parse file: ' + err.message)
    }
  }

  async function handleApply() {
    if (!equipmentId) {
      setParseErr('Pick which piece of equipment this report is for.')
      return
    }
    if (!parsedRows || parsedRows.length === 0) return
    setImporting(true)
    try {
      const payload = parsedRows.map((r) => ({
        equipment_id: equipmentId,
        recorded_date: r.date,
        hours: r.hours,
        source: 'utilization_report',
        created_by: userEmail || null,
      }))
      const { count, error } = await upsertHoursReadings(payload, {
        created_by: userEmail || null,
      })
      if (error) {
        setParseErr('Import failed: ' + error.message)
        return
      }
      const unit = equipment.find((e) => e.id === equipmentId)
      await writeAuditLog({
        unitLabel: unit?.label || equipmentId,
        changeType: 'utilization_report_imported',
        field: 'equipment_hours_history',
        oldValue: null,
        newValue: `${count} readings imported (${parseMeta.firstDate} → ${parseMeta.lastDate})`,
        changedBy: userEmail || 'unknown',
      })
      setImported({ count, firstDate: parseMeta.firstDate, lastDate: parseMeta.lastDate })
      setParsedRows(null)
      setParseMeta(null)
      // Refresh coverage so the user sees the updated window.
      const cov = await getHoursCoverage(equipmentId)
      setCoverage(cov)
    } finally {
      setImporting(false)
    }
  }

  function handleCancel() {
    setParsedRows(null)
    setParseMeta(null)
    setParseErr(null)
  }

  const unit = equipment.find((e) => e.id === equipmentId)

  return (
    <div className="bg-black-card border border-border rounded-lg p-5 mb-6">
      <div className="flex items-start gap-3 mb-4">
        <Clock size={20} className="text-cat-yellow mt-0.5 shrink-0" />
        <div>
          <h3 className="font-display text-base font-bold uppercase tracking-wider text-text">
            Daily SMU Hours by Unit
          </h3>
          <p className="text-sm text-muted mt-1">
            Upload a VisionLink utilization report (xlsx) for one machine. Daily readings go into <span className="font-mono text-text-dim">equipment_hours_history</span> so closeouts can pre-fill machine hours from the invoice date.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Equipment
          </label>
          <select
            value={equipmentId}
            onChange={(e) => handleEquipmentChange(e.target.value)}
            className="w-full input-dark"
          >
            <option value="">Pick the unit this report covers…</option>
            {equipment.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
                {u.serial ? ` — SN ${u.serial}` : ''}
              </option>
            ))}
          </select>
          {coverage && coverage.count > 0 && (
            <p className="text-[11px] text-muted mt-1">
              {coverage.count} readings on file ({coverage.earliest_date} → {coverage.latest_date})
            </p>
          )}
          {coverage && coverage.count === 0 && (
            <p className="text-[11px] text-muted mt-1">
              No readings on file for this unit yet.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Report file
          </label>
          <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-cat-yellow/50 transition-colors">
            <Upload size={16} className="text-muted" />
            <span className="text-sm text-muted">.xlsx / .xls / .csv</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFile(e.target.files[0])}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {parseErr && (
        <div className="text-svc-red text-sm bg-svc-red/10 border border-svc-red/30 rounded px-3 py-2 mb-3">
          {parseErr}
        </div>
      )}

      {parsedRows && parseMeta && (
        <div className="border border-border rounded p-3 bg-black-soft mb-3">
          <p className="text-xs text-text-dim mb-1">
            <span className="font-display font-bold uppercase tracking-wider text-text">
              Preview
            </span>{' '}
            — detected <span className="font-mono">{parseMeta.dateCol}</span> as date,{' '}
            <span className="font-mono">{parseMeta.hoursCol}</span> as hours.
          </p>
          <p className="text-xs text-muted">
            {parseMeta.total} readings, {parseMeta.firstDate} → {parseMeta.lastDate}
            {unit ? ` — for unit ${unit.label}` : ''}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleApply}
              disabled={importing || !equipmentId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
            >
              <Check size={12} />
              {importing ? 'Importing…' : `Import ${parseMeta.total} readings`}
            </button>
            <button
              onClick={handleCancel}
              disabled={importing}
              className="px-3 py-1.5 text-xs font-display uppercase tracking-wider border border-border text-muted hover:text-text rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {imported && (
        <div className="text-svc-green text-sm bg-svc-green/10 border border-svc-green/30 rounded px-3 py-2">
          Imported {imported.count} readings ({imported.firstDate} → {imported.lastDate}).
        </div>
      )}
    </div>
  )
}

function ImportUploadCard({ label, description, accept, onFile, count }) {
  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) onFile(file)
  }

  return (
    <div className="bg-black-card border border-border rounded-lg p-4">
      <p className="font-display text-sm font-bold uppercase tracking-wider text-text mb-1">
        {label}
      </p>
      <p className="text-xs text-muted mb-3">{description}</p>

      <label
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-cat-yellow/50 transition-colors"
      >
        <Upload size={24} className="text-muted" />
        <span className="text-sm text-muted">Click or drag to upload</span>
        <span className="text-[11px] text-muted/60">{accept}</span>
        <input
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
      </label>
      <p className="text-[11px] text-muted mt-2">Will match against {count}</p>
    </div>
  )
}

function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-5 bg-cat-yellow rounded-sm" />
      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
        {title}
      </h3>
    </div>
  )
}
