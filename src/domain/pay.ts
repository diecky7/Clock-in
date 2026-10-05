import type { Employer, Expense, TimeEntry } from './types'
import { shiftMinutes } from './time'
import { weekDates } from './weeks'

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
        regularCents: 0, overtimeCents: 0, expensesCents: 0, entries: [], expenses: [],
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
    for (const e of g.entries) {
      const m = shiftMinutes(e)
      const regular = ot ? Math.max(0, Math.min(m, OVERTIME_THRESHOLD_MIN - acc)) : m
      const over = m - regular
      acc += m
      g.minutes += m
      g.regularMinutes += regular
      g.overtimeMinutes += over
      g.regularCents += Math.round((regular * e.rateCents) / 60)
      if (over > 0) g.overtimeCents += Math.round((over * e.rateCents * 1.5) / 60)
    }
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
