// CAT PM service interval logic — preserves behavior from the HTML prototype.
//
// Intervals: every 250 hours, with 500 including the 250-hour tasks,
// 1000 including 500, and 2000 (major) including 1000. We find the
// next multiple of 250 above current hours, then determine which
// interval it falls on by checking the largest interval that divides it.

export const CAT_INTERVALS = [250, 500, 1000, 2000]
export const WARNING_THRESHOLD = 75 // hours before next due

/**
 * Given the hours at which a service was completed and the interval
 * number (250/500/1000/2000), determine which interval mark the service
 * was "for". Uses the nearest multiple — so completing a 1000HR service
 * at 1014 hrs targets 1000 (just passed), and completing it at 990 hrs
 * targets 1000 (just ahead). Ties (exactly halfway) resolve to upper.
 */
export function targetMarkFor(anchorHours, intervalNum) {
  const a = Number(anchorHours) || 0
  const lower = Math.floor(a / intervalNum) * intervalNum
  const upper = lower + intervalNum
  const distLower = a - lower
  const distUpper = upper - a
  return distUpper <= distLower ? upper : lower
}

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

  // Compute next interval up front so "Done" overrides can yield to it
  const nextMark = nextIntervalMark(hours)
  const hoursToNext = nextMark - hours
  const label = intervalLabelFor(nextMark)

  // 1. Manual text override
  if (unit.svc_override && String(unit.svc_override).trim() !== '') {
    const text = String(unit.svc_override).trim()
    const doneMatch = text.match(/^(\d+)HR\s+Done\b/i)

    if (doneMatch) {
      const intervalNum = parseInt(doneMatch[1], 10)
      const doneLabel = `${intervalNum}HR`
      if (unit.svc_done_at_hours != null && intervalNum > 0) {
        // Target mark = nearest multiple of intervalNum to the hours at
        // the moment the service was marked complete. Late completions
        // (e.g. 1000HR done at 1014) target the mark just passed (1000);
        // early completions (e.g. 500HR done at 490) target the upcoming
        // mark (500).
        const targetMark = targetMarkFor(unit.svc_done_at_hours, intervalNum)
        if (hours < targetMark) {
          return {
            status: 'done',
            intervalLabel: doneLabel,
            hoursToNext: targetMark - hours,
            primary: doneLabel,
            secondary: '',
          }
        }
        // Expired — hours have crossed the specific interval that was
        // marked complete. Show nothing. Do NOT fall through to due/overdue
        // so the unit doesn't re-trigger as a new service.
        return {
          status: 'none',
          intervalLabel: label,
          hoursToNext,
          primary: '',
          secondary: '',
        }
      }
      // Legacy row without svc_done_at_hours → preserve always-show behavior
      return {
        status: 'done',
        intervalLabel: doneLabel,
        hoursToNext: null,
        primary: doneLabel,
        secondary: '',
      }
    }

    // Plain interval override (e.g. "500HR", "1000HR") — use the override
    // as the forced interval label but still honor kit/order-kit behavior
    // based on the kit_ordered flag.
    const intervalOnlyMatch = text.match(/^(\d+)HR$/i)
    if (intervalOnlyMatch) {
      const forcedLabel = `${intervalOnlyMatch[1]}HR`
      if (unit.kit_ordered === true) {
        return {
          status: 'kit',
          intervalLabel: forcedLabel,
          hoursToNext,
          primary: forcedLabel,
          secondary: '',
        }
      }
      return {
        status: 'due',
        intervalLabel: forcedLabel,
        hoursToNext,
        primary: forcedLabel,
        secondary: 'order kit',
      }
    }

    // Custom text override (e.g. "Oil change", "CHECK SERVICE")
    return {
      status: 'override',
      intervalLabel: text,
      hoursToNext: null,
      primary: text,
      secondary: '',
    }
  }

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
      // Kit ordered: "order kit" tag goes away entirely — only the interval
      // label remains. Matches the original prototype PDF behavior.
      return {
        status: 'kit',
        intervalLabel: label,
        hoursToNext,
        primary: label,
        secondary: '',
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

export function formatKitDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}
