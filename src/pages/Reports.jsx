import { useState } from 'react'
import { FileText, Upload, Check, Download, Table } from 'lucide-react'
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
