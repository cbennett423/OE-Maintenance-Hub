import { useState } from 'react'
import { FileText, Upload, ClipboardCopy, Check } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'

const REPORTS = [
  {
    name: 'Weekly Fleet Report',
    script: 'fleet_report.py',
    description: 'Full fleet report by site with equipment, hours, service status, and notes. CAT black/yellow theme.',
    inputs: ['VisionLink Export (.xlsx)', 'Samsara Vehicle Activity Report (.xlsx)'],
  },
  {
    name: 'Service Due Report',
    script: 'service_due_pdf.py',
    description: 'Overdue units, due within 75 hours, and active service notes.',
    inputs: ['VisionLink Export (.xlsx)'],
  },
  {
    name: 'Changelog Report',
    script: 'changelog_pdf.py',
    description: 'Hour updates, notes changes, geofence mismatches, and data discrepancies.',
    inputs: ['VisionLink Export (.xlsx)'],
  },
]

export default function Reports() {
  return (
    <div>
      <PageHeader title="Reports" />

      <div className="bg-black-card border border-border border-t-4 border-t-cat-yellow rounded-lg p-5 mb-6">
        <p className="text-text-dim text-sm">
          PDF reports are generated via Python scripts in Claude.ai. Upload the required telematics export files below, then run the appropriate script to generate the report.
        </p>
        <p className="text-muted text-xs mt-2">
          Scripts pull live equipment/truck/rental data from Supabase automatically — you only need to upload the VisionLink and Samsara xlsx exports.
        </p>
      </div>

      <div className="grid gap-4">
        {REPORTS.map((r) => (
          <ReportCard key={r.script} report={r} />
        ))}
      </div>
    </div>
  )
}

function ReportCard({ report }) {
  const [copied, setCopied] = useState(false)

  function handleCopyPrompt() {
    const prompt = `Run ${report.script} to generate the ${report.name}. Pull current data from Supabase and use the uploaded telematics files for hour/odometer updates.`
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
            <div className="mt-3">
              <p className="text-xs font-display uppercase tracking-wider text-muted mb-1.5">
                Required Uploads:
              </p>
              <div className="flex flex-wrap gap-2">
                {report.inputs.map((input) => (
                  <span
                    key={input}
                    className="inline-flex items-center gap-1.5 text-xs bg-black-soft border border-border rounded px-2.5 py-1 text-text-dim"
                  >
                    <Upload size={11} className="text-muted" />
                    {input}
                  </span>
                ))}
              </div>
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
