// Helpers around equipment_hours_history (phase 15).
//
// `getHoursForEquipmentOnDate` is the load-bearing primitive: given an
// equipment_id and a date (e.g. an invoice_date), return the most recent
// recorded SMU on or before that date. Used by the WO close flow to
// pre-fill closed_machine_hours, and by the InvoiceDetailModal to show
// "what were this unit's hours when this invoice was issued?"
//
// `upsertHoursReadings` ingests a parsed utilization report. Conflicts on
// (equipment_id, recorded_date) are resolved by replacing — the most
// recent reading for a given day wins.

import { supabase } from './supabase'

// Returns { hours, recorded_date, source } or null when no reading exists
// on or before `date` for this unit.
export async function getHoursForEquipmentOnDate(equipment_id, date) {
  if (!equipment_id || !date) return null
  const { data, error } = await supabase
    .from('equipment_hours_history')
    .select('hours, recorded_date, source')
    .eq('equipment_id', equipment_id)
    .lte('recorded_date', date)
    .order('recorded_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.warn('[equipmentHours] lookup failed', error)
    return null
  }
  return data || null
}

// Bulk upsert. `rows` is an array of { equipment_id, recorded_date, hours,
// source?, created_by? }. Re-importing the same date overwrites the prior
// reading — we treat the most recent import as authoritative.
export async function upsertHoursReadings(rows, { source = 'utilization_report', created_by } = {}) {
  if (!rows || rows.length === 0) return { count: 0, error: null }
  const payload = rows.map((r) => ({
    equipment_id: r.equipment_id,
    recorded_date: r.recorded_date,
    hours: r.hours,
    source: r.source || source,
    created_by: r.created_by || created_by || null,
  }))
  const { error } = await supabase
    .from('equipment_hours_history')
    .upsert(payload, { onConflict: 'equipment_id,recorded_date' })
  if (error) return { count: 0, error }
  return { count: payload.length, error: null }
}

// Returns { earliest_date, latest_date, count } describing the coverage
// window we have for a unit. Used by the import preview to tell the user
// "we already have N readings between X and Y for this unit."
export async function getHoursCoverage(equipment_id) {
  if (!equipment_id) return null
  const { data, error } = await supabase
    .from('equipment_hours_history')
    .select('recorded_date')
    .eq('equipment_id', equipment_id)
    .order('recorded_date', { ascending: true })
  if (error) {
    console.warn('[equipmentHours] coverage failed', error)
    return null
  }
  if (!data || data.length === 0) {
    return { earliest_date: null, latest_date: null, count: 0 }
  }
  return {
    earliest_date: data[0].recorded_date,
    latest_date: data[data.length - 1].recorded_date,
    count: data.length,
  }
}
