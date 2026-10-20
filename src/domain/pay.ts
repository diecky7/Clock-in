import type { Employer, Expense, TimeEntry } from './types'
import { shiftMinutes } from './time'
import { addDays, weekDates, weekStartOf } from './weeks'

export const OVERTIME_THRESHOLD_MIN = 2400

export interface EmployerWeek {
  employerId: string
  minutes: number
  regularMinutes: number
  overtimeMinutes: number
  regularCents: number
  overtimeCents: number
  expensesCents: number
  entries: TimeEntry[]
  expenses: Expense[]
  /** How each shift splits into regular and overtime (exact cents, unrounded), in shift order. */
  splits: ShiftSplit[]
}

export interface ShiftSplit {
  entryId: string
  date: string
  regularMinutes: number
  overtimeMinutes: number
  regularExact: number
  overtimeExact: number
}

export interface WeekSummary {
  totalMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  regularCents: number
  overtimeCents: number
  expensesCents: number
  totalCents: number
  byEmployer: EmployerWeek[]
}

export function computeWeek(input: {
  weekStart: string
  entries: TimeEntry[]
  expenses: Expense[]
  employers: Employer[]
}): WeekSummary {
  const dates = new Set(weekDates(input.weekStart))
  const overtimeOn = new Map(input.employers.map(e => [e.id, e.overtimeEnabled]))
  const groups = new Map<string, EmployerWeek>()
  const group = (id: string): EmployerWeek => {
    let g = groups.get(id)
    if (!g) {
      g = {
        employerId: id, minutes: 0, regularMinutes: 0, overtimeMinutes: 0,
        regularCents: 0, overtimeCents: 0, expensesCents: 0, entries: [], expenses: [], splits: [],
      }
      groups.set(id, g)
    }
    return g
  }

  for (const e of input.entries) {
    if (dates.has(e.start.split('T')[0])) group(e.employerId).entries.push(e)
  }
  for (const x of input.expenses) {
    if (dates.has(x.date)) group(x.employerId).expenses.push(x)
  }

  for (const g of groups.values()) {
    g.entries.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    const ot = overtimeOn.get(g.employerId) ?? false // unknown employer: no overtime
    let acc = 0
    let regularExact = 0
    let overtimeExact = 0
    for (const e of g.entries) {
      const m = shiftMinutes(e)
      const regular = ot ? Math.max(0, Math.min(m, OVERTIME_THRESHOLD_MIN - acc)) : m
      const over = m - regular
      acc += m
      g.minutes += m
      g.regularMinutes += regular
      g.overtimeMinutes += over
      const rx = (regular * e.rateCents) / 60
      const ox = (over * e.rateCents * 1.5) / 60
      regularExact += rx
      overtimeExact += ox
      g.splits.push({ entryId: e.id, date: e.start.slice(0, 10), regularMinutes: regular, overtimeMinutes: over, regularExact: rx, overtimeExact: ox })
    }
    // round once per employer per kind so the PDF total matches hours x rate
    g.regularCents = Math.round(regularExact)
    g.overtimeCents = Math.round(overtimeExact)
    g.expensesCents = g.expenses.reduce((s, x) => s + x.amountCents, 0)
  }

  // employers-list order first, then unknown employers in encounter order
  const order = [...input.employers.map(e => e.id), ...groups.keys()]
  const byEmployer = [...new Set(order)].filter(id => groups.has(id)).map(id => groups.get(id)!)

  const sum = (f: (g: EmployerWeek) => number) => byEmployer.reduce((s, g) => s + f(g), 0)
  const regularCents = sum(g => g.regularCents)
  const overtimeCents = sum(g => g.overtimeCents)
  const expensesCents = sum(g => g.expensesCents)
  return {
    totalMinutes: sum(g => g.minutes),
    regularMinutes: sum(g => g.regularMinutes),
    overtimeMinutes: sum(g => g.overtimeMinutes),
    regularCents, overtimeCents, expensesCents,
    totalCents: regularCents + overtimeCents + expensesCents,
    byEmployer,
  }
}

/**
 * Per-employer totals for any date range (two weeks, a month…). Overtime is judged on whole work weeks, so pass every
 * entry of the weeks touching the range. A week fully inside counts its rounded weekly figures (same as the weekly
 * report); a week cut by an edge counts only its shifts inside the range, with the overtime they really earned.
 */
export function computeRange(input: {
  from: string
  to: string
  weekStartsOn: number
  entries: TimeEntry[]
  expenses: Expense[]
  employers: Employer[]
}): WeekSummary {
  const { from, to } = input
  const inRange = (d: string) => d >= from && d <= to
  const groups = new Map<string, EmployerWeek & { regularExact: number; overtimeExact: number }>()
  const group = (id: string) => {
    let g = groups.get(id)
    if (!g) {
      g = {
        employerId: id, minutes: 0, regularMinutes: 0, overtimeMinutes: 0, regularCents: 0, overtimeCents: 0,
        expensesCents: 0, entries: [], expenses: [], splits: [], regularExact: 0, overtimeExact: 0,
      }
      groups.set(id, g)
    }
    return g
  }
  for (let ws = weekStartOf(from, input.weekStartsOn); ws <= to; ws = addDays(ws, 7)) {
    const w = computeWeek({ weekStart: ws, entries: input.entries, expenses: [], employers: input.employers })
    const whole = ws >= from && addDays(ws, 6) <= to
    for (const wg of w.byEmployer) {
      const ids = new Set(wg.splits.filter((s) => whole || inRange(s.date)).map((s) => s.entryId))
      if (ids.size === 0) continue
      const g = group(wg.employerId)
      g.entries.push(...wg.entries.filter((e) => ids.has(e.id)))
      for (const s of wg.splits)
        if (ids.has(s.entryId)) {
          g.splits.push(s)
          g.minutes += s.regularMinutes + s.overtimeMinutes
          g.regularMinutes += s.regularMinutes
          g.overtimeMinutes += s.overtimeMinutes
          if (!whole) {
            g.regularExact += s.regularExact
            g.overtimeExact += s.overtimeExact
          }
        }
      if (whole) {
        g.regularCents += wg.regularCents
        g.overtimeCents += wg.overtimeCents
      }
    }
  }
  for (const x of input.expenses)
    if (inRange(x.date)) {
      const g = group(x.employerId)
      g.expenses.push(x)
      g.expensesCents += x.amountCents
    }
  const order = [...input.employers.map((e) => e.id), ...groups.keys()]
  const byEmployer: EmployerWeek[] = [...new Set(order)]
    .filter((id) => groups.has(id))
    .map((id) => {
      const { regularExact, overtimeExact, ...g } = groups.get(id)!
      g.regularCents += Math.round(regularExact)
      g.overtimeCents += Math.round(overtimeExact)
      g.entries.sort((a, b) => a.start.localeCompare(b.start))
      return g
    })
  const sum = (f: (g: EmployerWeek) => number) => byEmployer.reduce((s, g) => s + f(g), 0)
  const regularCents = sum((g) => g.regularCents)
  const overtimeCents = sum((g) => g.overtimeCents)
  const expensesCents = sum((g) => g.expensesCents)
  return {
    totalMinutes: sum((g) => g.minutes),
    regularMinutes: sum((g) => g.regularMinutes),
    overtimeMinutes: sum((g) => g.overtimeMinutes),
    regularCents, overtimeCents, expensesCents,
    totalCents: regularCents + overtimeCents + expensesCents,
    byEmployer,
  }
}
