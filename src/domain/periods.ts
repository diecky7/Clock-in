import { monthRange } from './summary'
import type { Employer } from './types'
import { addDays, weekLabel, weekStartOf } from './weeks'

export type PeriodKind = 'week' | 'biweek' | 'month'

export const PERIOD_KINDS: { kind: PeriodKind; name: string }[] = [
  { kind: 'week', name: 'Weekly' },
  { kind: 'biweek', name: 'Biweekly' },
  { kind: 'month', name: 'Monthly' },
]

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Biweekly periods are pairs of weeks counted from the first week of 2026, so they never shift. */
const BIWEEK_EPOCH = '2026-01-01'

const dayNumber = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, dd) / 86_400_000
}

/**
 * First day of the period of `kind` that contains `date`. Two-week periods run every 14 days from `biweekAnchor`
 * (an employer's pay-period start); without one, from the first week of 2026.
 */
export function periodStart(kind: PeriodKind, date: string, weekStartsOn: number, biweekAnchor?: string): string {
  if (kind === 'month') return `${date.slice(0, 7)}-01`
  if (kind === 'week') return weekStartOf(date, weekStartsOn)
  const anchor = biweekAnchor ?? weekStartOf(BIWEEK_EPOCH, weekStartsOn)
  const days = Math.round(dayNumber(date) - dayNumber(anchor))
  return addDays(anchor, Math.floor(days / 14) * 14)
}

/** The two-week pay period to show: the last-used employer's, else the first active employer that has one. */
export function biweekAnchorFor(employers: Employer[], lastEmployerId?: string): string | undefined {
  const active = employers.filter((e) => !e.archived)
  return (active.find((e) => e.id === lastEmployerId)?.biweeklyStart ?? active.find((e) => e.biweeklyStart)?.biweeklyStart) || undefined
}

/** Last day (inclusive) of the period that starts on `start`. */
export function periodEnd(kind: PeriodKind, start: string): string {
  if (kind === 'week') return addDays(start, 6)
  if (kind === 'biweek') return addDays(start, 13)
  return monthRange(start)[1]
}

/** Start of the next (dir 1) or previous (dir -1) period. */
export function shiftPeriod(kind: PeriodKind, start: string, dir: -1 | 1): string {
  if (kind === 'week') return addDays(start, 7 * dir)
  if (kind === 'biweek') return addDays(start, 14 * dir)
  const [y, m] = start.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + dir, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export function periodLabel(kind: PeriodKind, start: string): string {
  if (kind === 'week') return weekLabel(start)
  if (kind === 'month') return `${MONTHS[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)}`
  const end = periodEnd(kind, start)
  const [sm, em] = [Number(start.slice(5, 7)) - 1, Number(end.slice(5, 7)) - 1]
  const tail = sm === em ? `${Number(end.slice(8))}` : `${SHORT[em]} ${Number(end.slice(8))}`
  return `${SHORT[sm]} ${Number(start.slice(8))} – ${tail}`
}

/** Words for the arrows and the empty list. */
export const PERIOD_WORDS: Record<PeriodKind, { unit: string; this: string }> = {
  week: { unit: 'week', this: 'this week' },
  biweek: { unit: 'two weeks', this: 'these two weeks' },
  month: { unit: 'month', this: 'this month' },
}
