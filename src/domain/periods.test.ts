import { describe, expect, it } from 'vitest'
import { biweekAnchorFor, periodEnd, periodLabel, periodStart, shiftPeriod } from './periods'
import { summarizePeriod } from './summary'
import type { Employer, TimeEntry } from './types'

describe('periods', () => {
  it('week, biweek and month around a date', () => {
    expect(periodStart('week', '2026-10-20', 0)).toBe('2026-10-18')
    expect(periodStart('month', '2026-10-20', 0)).toBe('2026-10-01')
    expect(periodEnd('month', '2026-02-01')).toBe('2026-02-28')
    const b = periodStart('biweek', '2026-10-20', 0)
    // Both weeks of a pair give the same start; the next pair starts 14 days later.
    expect(periodStart('biweek', periodEnd('biweek', b), 0)).toBe(b)
    expect(periodStart('biweek', shiftPeriod('biweek', b, 1), 0)).toBe(shiftPeriod('biweek', b, 1))
    expect(['2026-10-11', '2026-10-18']).toContain(b)
  })

  it('two-week periods follow the employer start date every 14 days, any weekday', () => {
    const a = '2026-10-15' // a Thursday
    expect(periodStart('biweek', '2026-10-20', 0, a)).toBe('2026-10-15')
    expect(periodStart('biweek', '2026-10-28', 0, a)).toBe('2026-10-15')
    expect(periodStart('biweek', '2026-10-29', 0, a)).toBe('2026-10-29')
    expect(periodStart('biweek', '2026-10-14', 0, a)).toBe('2026-10-01')
    expect(periodStart('biweek', '2026-10-15', 0, a)).toBe('2026-10-15')
  })

  it('uses the last-used employer, else the first that has a start date', () => {
    const e = (id: string, biweeklyStart?: string, archived = false) => ({ id, name: id, overtimeEnabled: false, archived, rates: [], biweeklyStart }) as Employer
    expect(biweekAnchorFor([e('a', '2026-01-05'), e('b', '2026-01-12')], 'b')).toBe('2026-01-12')
    expect(biweekAnchorFor([e('a'), e('b', '2026-01-12')], 'a')).toBe('2026-01-12')
    expect(biweekAnchorFor([e('a', '2026-01-05', true)], 'a')).toBeUndefined()
    expect(biweekAnchorFor([])).toBeUndefined()
  })

  it('moves and labels periods', () => {
    expect(shiftPeriod('month', '2026-12-01', 1)).toBe('2027-01-01')
    expect(shiftPeriod('month', '2026-01-01', -1)).toBe('2025-12-01')
    expect(periodLabel('month', '2026-10-01')).toBe('October 2026')
    expect(periodLabel('biweek', '2026-09-27')).toBe('Sep 27 – Oct 10')
    expect(periodLabel('biweek', '2026-10-11')).toBe('Oct 11 – 24')
  })
})

describe('summarizePeriod across a month edge', () => {
  const emp = { id: 'e', name: 'A', overtimeEnabled: true, archived: false, rates: [] } as Employer
  const shift = (date: string): TimeEntry =>
    ({ id: date, employerId: 'e', start: `${date}T07:00`, end: `${date}T17:00`, breakMin: 0, rateCents: 2000 }) as TimeEntry
  // Week Sep 27 – Oct 3: 10 h a day Mon–Fri = 50 h, the last 10 h (Fri Oct 2) are overtime.
  const entries = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map(shift)
  const sum = (from: string, to: string) => summarizePeriod({ from, to, weekStartsOn: 0, entries, expenses: [], employers: [emp] })

  it('keeps the overtime the week really earned on the side of the edge it fell', () => {
    const oct = sum('2026-10-01', '2026-10-31')
    expect(oct.minutes).toBe(1200)
    expect(oct.overtimeMinutes).toBe(600)
    expect(oct.earnedCents).toBe(20000 + 30000)
    const sep = sum('2026-09-01', '2026-09-30')
    expect(sep.minutes).toBe(1800)
    expect(sep.overtimeMinutes).toBe(0)
    expect(sep.earnedCents).toBe(60000)
  })
})
