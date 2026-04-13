import { useCallback, useEffect, useState } from 'react'
import { FileText, Upload, ClipboardCopy, Check, X, File, RefreshCw, Download } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import { supabase } from '../lib/supabase'
import { useEquipment } from '../hooks/useEquipment'
import { useRentals } from '../hooks/useRentals'
import { generateFleetReport } from '../lib/generateFleetReport'

const BUCKET = 'telematics-uploads'

const UPLOAD_SLOTS = [
  { key: 'visionlink', label: 'VisionLink Export', accept: '.xlsx,.xls,.csv', folder: 'visionlink' },
  { key: 'samsara', label: 'Samsara Vehicle Activity Report', accept: '.xlsx,.xls,.csv', folder: 'samsara' },
]

const REPORTS = [
  {
    name: 'Weekly Fleet Report',
    script: 'fleet_report.py',
    description: 'Full fleet report by site with equipment, hours, service status, and notes. CAT black/yellow theme.',
    needs: ['visionlink', 'samsara'],
  },
  {
    name: 'Service Due Report',
    script: 'service_due_pdf.py',
    description: 'Overdue units, due within 75 hours, and active service notes.',
    needs: ['visionlink'],
  },
  {
    name: 'Changelog Report',
    script: 'changelog_pdf.py',
    description: 'Hour updates, notes changes, geofence mismatches, and data discrepancies.',
    needs: ['visionlink'],
  },
]

export default function Reports() {
  const { equipment } = useEquipment()
  const { rentals } = useRentals()
  const [generating, setGenerating] = useState(false)
  const [uploads, setUploads] = useState({}) // key -> { name, uploading, error, path, uploadedAt }
  const [existingFiles, setExistingFiles] = useState({}) // key -> [{ name, created_at }]

  function handleGenerateFleetReport() {
    setGenerating(true)
    try {
      generateFleetReport(equipment, rentals)
    } catch (err) {
      console.error('PDF generation failed', err)
      alert('Failed to generate report: ' + err.message)
    } finally {
      setGenerating(false)
    }
  }

  // Load existing files from storage on mount
  const loadExisting = useCallback(async () => {
    const result = {}
    for (const slot of UPLOAD_SLOTS) {
      const { data } = await supabase.storage.from(BUCKET).list(slot.folder, {
        limit: 5,
        sortBy: { column: 'created_at', order: 'desc' },
      })
      if (data && data.length > 0) {
        result[slot.key] = data.filter((f) => f.name !== '.emptyFolderPlaceholder')
      }
    }
    setExistingFiles(result)
  }, [])

  useEffect(() => {
    loadExisting()
  }, [loadExisting])

  async function handleUpload(slot, file) {
    if (!file) return
    setUploads((u) => ({ ...u, [slot.key]: { name: file.name, uploading: true, error: null } }))

    const path = `${slot.folder}/${file.name}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
    })

    if (error) {
      setUploads((u) => ({
        ...u,
        [slot.key]: { name: file.name, uploading: false, error: error.message },
      }))
      return
    }

    setUploads((u) => ({
      ...u,
      [slot.key]: { name: file.name, uploading: false, error: null, path, uploadedAt: new Date() },
    }))
    loadExisting()
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
      </div>

      {/* Upload section (for future VisionLink/Samsara import) */}
      <SectionHeader title="Upload Telematics Files (Optional)" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {UPLOAD_SLOTS.map((slot) => (
          <UploadCard
            key={slot.key}
            slot={slot}
            upload={uploads[slot.key]}
            existing={existingFiles[slot.key]}
            onUpload={(file) => handleUpload(slot, file)}
          />
        ))}
      </div>

      {/* Legacy Python scripts reference */}
      <SectionHeader title="Python Scripts (Legacy)" />
      <div className="bg-black-card border border-border rounded-lg p-4 mb-4">
        <p className="text-xs text-muted">
          The Python scripts below are still available in Claude.ai for advanced reports (service due, changelog). The fleet report above replaces fleet_report.py.
        </p>
      </div>
      <div className="grid gap-4">
        {REPORTS.filter(r => r.script !== 'fleet_report.py').map((r) => (
          <ReportCard key={r.script} report={r} uploads={uploads} existingFiles={existingFiles} />
        ))}
      </div>
    </div>
  )
}

function UploadCard({ slot, upload, existing, onUpload }) {
  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) onUpload(file)
  }

  const latestExisting = existing?.[0]

  return (
    <div className="bg-black-card border border-border rounded-lg p-4">
      <p className="font-display text-sm font-bold uppercase tracking-wider text-text mb-3">
        {slot.label}
      </p>

      <label
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-cat-yellow/50 transition-colors"
      >
        <Upload size={24} className="text-muted" />
        <span className="text-sm text-muted">
          {upload?.uploading ? 'Uploading…' : 'Click or drag to upload'}
        </span>
        <span className="text-[11px] text-muted/60">{slot.accept}</span>
        <input
          type="file"
          accept={slot.accept}
          onChange={handleChange}
          className="hidden"
        />
      </label>

      {upload?.error && (
        <div className="mt-2 text-svc-red text-xs bg-svc-red/10 border border-svc-red/30 rounded px-2 py-1">
          {upload.error}
        </div>
      )}

      {upload?.uploadedAt && !upload?.error && (
        <div className="mt-2 flex items-center gap-2 text-svc-green text-xs">
          <Check size={13} />
          <span>Uploaded: {upload.name}</span>
        </div>
      )}

      {latestExisting && !upload?.uploadedAt && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <File size={12} />
          <span>Latest: {latestExisting.name}</span>
          <span className="text-muted/60">
            ({new Date(latestExisting.created_at).toLocaleDateString()})
          </span>
        </div>
      )}
    </div>
  )
}

function ReportCard({ report, uploads, existingFiles }) {
  const [copied, setCopied] = useState(false)

  const allFilesReady = report.needs.every(
    (key) => uploads[key]?.uploadedAt || existingFiles[key]?.length > 0
  )

  function handleCopyPrompt() {
    const prompt = `Run ${report.script} to generate the ${report.name}. Pull current data from Supabase and use the uploaded telematics files in the "${BUCKET}" storage bucket for hour/odometer updates.`
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-black-card border border-border rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-cat-yellow mt-0.5 shrink-0" />
          <div>
            <h3 className="font-display text-base font-bold uppercase tracking-wider text-text">
              {report.name}
            </h3>
            <p className="text-sm text-muted mt-1">{report.description}</p>
            <div className="mt-2 flex items-center gap-2">
              {allFilesReady ? (
                <span className="text-xs text-svc-green flex items-center gap-1">
                  <Check size={12} /> Files ready
                </span>
              ) : (
                <span className="text-xs text-cat-yellow flex items-center gap-1">
                  <Upload size={12} /> Upload files above first
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <button
            onClick={handleCopyPrompt}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wider border border-border text-muted hover:text-text hover:border-muted rounded transition-colors"
          >
            {copied ? (
              <>
                <Check size={13} className="text-svc-green" /> Copied
              </>
            ) : (
              <>
                <ClipboardCopy size={13} /> Copy Prompt
              </>
            )}
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-[11px] font-mono text-muted">
          Script: {report.script}
        </p>
      </div>
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
