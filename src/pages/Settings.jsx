import { useEffect, useState } from 'react'
import { Save, Check } from 'lucide-react'
import PageHeader from '../components/layout/PageHeader'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const SITE_LIST = [
  'DIA PREFLIGHT',
  'HUF8 OVERLOT/APS HORIZON',
  'COLUMBINE SQUARE',
  '4 MILE',
  'CCSD LAREDO',
  'BRONCOS TRAINING FACILITY',
  'CU CHAP',
  'CU RESIDENCE HALLS',
  'FT LUPTON STORAGE YARD',
  'OE SHOP',
]

const MECHANIC_LIST = ['Tim', 'Mechanic 2', 'Mechanic 3']

export default function Settings() {
  const { user } = useAuth()

  return (
    <div>
      <PageHeader title="Settings" />

      <div className="grid gap-6 max-w-2xl">
        {/* Current user */}
        <SettingsCard title="Current User">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Email" value={user?.email || '—'} />
            <InfoRow label="User ID" value={user?.id?.slice(0, 8) + '…' || '—'} mono />
            <InfoRow label="Role" value="Admin" />
            <InfoRow label="Domain" value="@oeconstruct.com" />
          </div>
        </SettingsCard>

        {/* Service interval configuration */}
        <ServiceSettings />

        {/* Active sites */}
        <SettingsCard title="Active Job Sites">
          <p className="text-xs text-muted mb-3">
            Sites available in equipment and truck dropdowns. Ordered as they appear in fleet reports.
          </p>
          <div className="space-y-1">
            {SITE_LIST.map((site, i) => (
              <div key={site} className="flex items-center gap-3 px-3 py-1.5 rounded bg-black-soft text-sm text-text-dim">
                <span className="text-xs text-muted font-mono w-5">{i + 1}</span>
                {site}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2">
            To modify this list, update the Settings table in Supabase or contact Chase.
          </p>
        </SettingsCard>

        {/* Mechanics */}
        <SettingsCard title="Mechanics">
          <p className="text-xs text-muted mb-3">
            Mechanics available for work order assignment.
          </p>
          <div className="space-y-1">
            {MECHANIC_LIST.map((m) => (
              <div key={m} className="px-3 py-1.5 rounded bg-black-soft text-sm text-text-dim">
                {m}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-2">
            Mechanic names will be configurable in a future update.
          </p>
        </SettingsCard>

        {/* App info */}
        <SettingsCard title="App Info">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Version" value="Phase 7 — Audit Log & Admin" />
            <InfoRow label="Stack" value="React + Vite + Supabase" />
            <InfoRow label="Database" value="Supabase (US East)" />
            <InfoRow label="Hosting" value="Vercel (planned)" />
          </div>
        </SettingsCard>
      </div>
    </div>
  )
}

function ServiceSettings() {
  const [threshold, setThreshold] = useState(75)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'warning_threshold')
        .single()
      if (data?.value) setThreshold(Number(data.value))
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    const { error } = await supabase
      .from('settings')
      .upsert({
        key: 'warning_threshold',
        value: String(threshold),
        updated_at: new Date().toISOString(),
      })
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <SettingsCard title="Service Intervals">
      <p className="text-xs text-muted mb-4">
        CAT PM intervals: 250HR / 500HR / 1000HR / 2000HR. Units are flagged as "due soon" when they are within the warning threshold of the next interval.
      </p>
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-muted mb-1">
            Warning Threshold (hours)
          </label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            min={10}
            max={200}
            className="w-32 input-dark"
            disabled={loading}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-display font-bold uppercase tracking-wider bg-cat-yellow text-black rounded hover:bg-cat-yellow-hover transition-colors disabled:opacity-50"
        >
          {saved ? (
            <><Check size={13} /> Saved</>
          ) : (
            <><Save size={13} /> Save</>
          )}
        </button>
      </div>
      <p className="text-[11px] text-muted mt-2">
        Default: 75 hours. Changing this affects which units show "due soon" badges on the Equipment page and Dashboard.
      </p>
    </SettingsCard>
  )
}

function SettingsCard({ title, children }) {
  return (
    <div className="bg-black-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-black-soft">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-cat-yellow rounded-sm" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
            {title}
          </h3>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs font-display uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-sm text-text-dim mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}
