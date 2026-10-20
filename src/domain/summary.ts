import type { Employer, Expense, TimeEntry } from './types'
import { computeWeek } from './pay'
import { addDays, weekStartOf } from './weeks'

export interface PeriodSummary {
  minutes: number
  overtimeMinutes: number
  earnedCents: number
  expensesCents: number
  totalCents: number
}

/**
 * Totals for an inclusive date range. Overtime is always judged on the whole work week (pass every entry of the
 * weeks touching the range); a week cut by the range edge counts only its shifts inside the range, with the
 * overtime they really earned.
 */
export function summarizePeriod(input: {
  from: string
  to: string
  weekStartsOn: number
  entries: TimeEntry[]
  expenses: Expense[]
  employers: Employer[]
}): PeriodSummary {
  const { from, to } = input
  const inRange = (d: string) => d >= from && d <= to
  const out: PeriodSummary = { minutes: 0, overtimeMinutes: 0, earnedCents: 0, expensesCents: 0, totalCents: 0 }
  let partialExact = 0
  for (let ws = weekStartOf(from, input.weekStartsOn); ws <= to; ws = addDays(ws, 7)) {
    const w = computeWeek({ weekStart: ws, entries: input.entries, expenses: [], employers: input.employers })
    if (ws >= from && addDays(ws, 6) <= to) {
      // Whole week inside: same rounded figures as the weekly view and the PDF.
      out.minutes += w.totalMinutes
      out.overtimeMinutes += w.overtimeMinutes
      out.earnedCents += w.regularCents + w.overtimeCents
      continue
    }
    for (const g of w.byEmployer)
      for (const s of g.splits)
        if (inRange(s.date)) {
          out.minutes += s.regularMinutes + s.overtimeMinutes
          out.overtimeMinutes += s.overtimeMinutes
          partialExact += s.regularExact + s.overtimeExact
        }
  }
  out.earnedCents += Math.round(partialExact)
  out.expensesCents = input.expenses.filter((x) => inRange(x.date)).reduce((sum, x) => sum + x.amountCents, 0)
  out.totalCents = out.earnedCents + out.expensesCents
  return out
}

/** First and last day of the month / year containing `date` (YYYY-MM-DD). */
export function monthRange(date: string): [string, string] {
  const [y, m] = date.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return [`${y}-${mm}-01`, `${y}-${mm}-${String(last).padStart(2, '0')}`]
}
export const yearRange = (date: string): [string, string] => [`${date.slice(0, 4)}-01-01`, `${date.slice(0, 4)}-12-31`]
