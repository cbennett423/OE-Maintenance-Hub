// CAT PM service interval logic — preserves behavior from the HTML prototype.
//
// Intervals: every 250 hours, with 500 including the 250-hour tasks,
// 1000 including 500, and 2000 (major) including 1000. We find the
// next multiple of 250 above current hours, then determine which
// interval it falls on by checking the largest interval that divides it.

export const CAT_INTERVALS = [250, 500, 1000, 2000]
export const WARNING_THRESHOLD = 75 // hours before next due

/**
 * Determine which interval label applies to a given target hour mark.
 * e.g. 2000 → "2000HR", 1500 → "500HR", 1250 → "250HR", 1000 → "1000HR"
 */
export function intervalLabelFor(targetHours) {
  if (targetHours % 2000 === 0) return '2000HR'
  if (targetHours % 1000 === 0) return '1000HR'
  if (targetHours % 500 === 0) return '500HR'
  return '250HR'
}

/**
 * Compute the next interval mark above `hours`.
 * At exactly 500 hours, next is 750 (not 500).
 */
export function nextIntervalMark(hours) {
  const h = Math.max(0, Math.floor(hours || 0))
  return Math.floor(h / 250) * 250 + 250
}

/**
 * Compute the full service status for a unit.
 *
 * Priority order:
 *   1. svc_override (manual label like "CHECK SERVICE", "Oil change") → status "override"
 *   2. svc_overdue boolean flag → status "forceOverdue"
 *   3. If we've crossed an interval (hoursToNext <= 0) → status "overdue"
 *   4. Within WARNING_THRESHOLD of next interval:
 *        - kit_ordered true → status "kit"
 *        - kit_ordered false → status "due"
 *   5. Otherwise → status "none"
 *
 * Returns an object shape used by ServiceBadge and the profile page.
 */
export function computeServiceStatus(unit, threshold = WARNING_THRESHOLD) {
  if (!unit) {
    return { status: 'none', intervalLabel: '', hoursToNext: null, primary: '', secondary: '' }
  }

  const hours = Number(unit.hours) || 0

  // 1. Manual text override
  if (unit.svc_override && String(unit.svc_override).trim() !== '') {
    const text = String(unit.svc_override).trim()
    // "XXXHR Done" pattern means completed service — render as gray done badge
    const doneMatch = text.match(/^(\d+HR)\s+Done\b/i)
    if (doneMatch) {
      return {
        status: 'done',
        intervalLabel: doneMatch[1].toUpperCase(),
        hoursToNext: null,
        primary: doneMatch[1].toUpperCase(),
        secondary: '',
      }
    }
    return {
      status: 'override',
      intervalLabel: text,
      hoursToNext: null,
      primary: text,
      secondary: '',
    }
  }

  // Compute next interval
  const nextMark = nextIntervalMark(hours)
  const hoursToNext = nextMark - hours
  const label = intervalLabelFor(nextMark)

  // 2. Force-overdue flag
  if (unit.svc_overdue === true) {
    return {
      status: 'forceOverdue',
      intervalLabel: label,
      hoursToNext,
      primary: label,
      secondary: 'OVERDUE',
    }
  }

  // 3. Actually overdue (hours have passed the mark)
  if (hoursToNext <= 0) {
    return {
      status: 'overdue',
      intervalLabel: label,
      hoursToNext,
      primary: label,
      secondary: 'OVERDUE',
    }
  }

  // 4. Due soon (within warning threshold)
  if (hoursToNext <= threshold) {
    if (unit.kit_ordered === true) {
      const dateLabel = formatKitDate(unit.kit_ordered_date)
      return {
        status: 'kit',
        intervalLabel: label,
        hoursToNext,
        primary: label,
        secondary: dateLabel ? `kit ordered ${dateLabel}` : 'kit ordered',
      }
    }
    return {
      status: 'due',
      intervalLabel: label,
      hoursToNext,
      primary: label,
      secondary: 'order kit',
    }
  }

  // 5. Not due
  return {
    status: 'none',
    intervalLabel: label,
    hoursToNext,
    primary: '',
    secondary: '',
  }
}

/**
 * For the UnitProfile intervals panel: given current hours, compute
 * the next occurrence and hours remaining for each CAT interval.
 */
export function forecastIntervals(hours) {
  const h = Math.max(0, Math.floor(hours || 0))
  return CAT_INTERVALS.map((interval) => {
    const nextAt = Math.floor(h / interval) * interval + interval
    return {
      interval,
      label: `${interval}HR`,
      nextAt,
      hoursRemaining: nextAt - h,
    }
  })
}

function formatKitDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}
