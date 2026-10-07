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

/** Totals for an inclusive date range. Overtime is judged per week, using only the part of the week inside the range. */
export function summarizePeriod(input: {
  from: string
  to: string
  weekStartsOn: number
  entries: TimeEntry[]
  expenses: Expense[]
  employers: Employer[]
}): PeriodSummary {
  const entries = input.entries.filter((e) => e.start.slice(0, 10) >= input.from && e.start.slice(0, 10) <= input.to)
  const expenses = input.expenses.filter((x) => x.date >= input.from && x.date <= input.to)
  const out: PeriodSummary = { minutes: 0, overtimeMinutes: 0, earnedCents: 0, expensesCents: 0, totalCents: 0 }
  for (let ws = weekStartOf(input.from, input.weekStartsOn); ws <= input.to; ws = addDays(ws, 7)) {
    const w = computeWeek({ weekStart: ws, entries, expenses, employers: input.employers })
    out.minutes += w.totalMinutes
    out.overtimeMinutes += w.overtimeMinutes
    out.earnedCents += w.regularCents + w.overtimeCents
    out.expensesCents += w.expensesCents
  }
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
