import { describe, it, expect } from 'vitest'
import { computeWeek } from './pay'
import type { Employer, TimeEntry, Expense } from './types'

const WS = '2026-10-05' // Monday
const emp = (id: string, o: Partial<Employer> = {}): Employer => ({
  id, name: id, overtimeEnabled: true, archived: false, rates: [], ...o,
})
let n = 0
function entry(employerId: string, start: string, end: string, rateCents = 3200, breakMin = 0): TimeEntry {
  return { id: `e${n++}`, employerId, start, end, breakMin, rateCents }
}
const exp = (employerId: string, date: string, amountCents: number): Expense => ({
  id: `x${n++}`, employerId, date, description: 'x', amountCents, photoIds: [],
})
// helper: N shifts of given hours on consecutive days from WS (hours split into <=12h shifts)
function hoursEntries(employerId: string, minutes: number, rateCents = 3200): TimeEntry[] {
  const out: TimeEntry[] = []
  let left = minutes
  let day = 5
  while (left > 0) {
    const m = Math.min(left, 600)
    const h = Math.floor(m / 60), mm = m % 60
    const end = `2026-10-${String(day).padStart(2, '0')}T${String(8 + h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    out.push(entry(employerId, `2026-10-${String(day).padStart(2, '0')}T08:00`, end, rateCents))
    left -= m
    day++
  }
  return out
}

describe('computeWeek', () => {
  it('rounds once per employer per kind (no per-entry drift)', () => {
    const days = ['05', '06', '07', '08', '09']
    const entries = days.map(d => entry('A', `2026-10-${d}T07:00`, `2026-10-${d}T16:07`, 3333, 30))
    const r = computeWeek({ weekStart: WS, entries, expenses: [], employers: [emp('A')] })
    expect(r.regularMinutes).toBe(2400)
    expect(r.overtimeMinutes).toBe(185)
    expect(r.regularCents).toBe(133320)
    expect(r.overtimeCents).toBe(15415)
    expect(r.totalCents).toBe(133320 + 15415)
  })
  it('(a) 38.5h no overtime', () => {
    const r = computeWeek({ weekStart: WS, entries: hoursEntries('A', 2310), expenses: [], employers: [emp('A')] })
    expect(r.overtimeMinutes).toBe(0)
    expect(r.regularCents).toBe(123200)
  })
  it('(b) 51.5h overtime on', () => {
    const r = computeWeek({ weekStart: WS, entries: hoursEntries('A', 3090), expenses: [], employers: [emp('A')] })
    expect(r.regularMinutes).toBe(2400)
    expect(r.overtimeMinutes).toBe(690)
    expect(r.regularCents).toBe(128000)
    expect(r.overtimeCents).toBe(55200)
    expect(r.totalCents).toBe(183200)
  })
  it('(c) overtime off', () => {
    const r = computeWeek({ weekStart: WS, entries: hoursEntries('A', 3090), expenses: [], employers: [emp('A', { overtimeEnabled: false })] })
    expect(r.overtimeCents).toBe(0)
    expect(r.overtimeMinutes).toBe(0)
    expect(r.regularCents).toBe(164800)
  })
  it('(d) two employers at 30h each: no overtime', () => {
    const r = computeWeek({
      weekStart: WS,
      entries: [...hoursEntries('A', 1800), ...hoursEntries('B', 1800)],
      expenses: [], employers: [emp('A'), emp('B')],
    })
    expect(r.overtimeMinutes).toBe(0)
    expect(r.totalMinutes).toBe(3600)
    expect(r.byEmployer).toHaveLength(2)
    r.byEmployer.forEach(b => expect(b.overtimeMinutes).toBe(0))
  })
  it('(e) overtime uses rateCents of the entry it falls in', () => {
    const entries = [
      ...hoursEntries('A', 2400, 3000),
      entry('A', '2026-10-11T08:00', '2026-10-11T10:00', 4000),
    ]
    const r = computeWeek({ weekStart: WS, entries, expenses: [], employers: [emp('A')] })
    expect(r.overtimeMinutes).toBe(120)
    expect(r.regularCents).toBe(120000)
    expect(r.overtimeCents).toBe(12000) // 2h * 40 * 1.5
  })
  it('(f) Saturday 22:00 to Sunday 06:00 belongs to Saturday week', () => {
    const e = entry('A', '2026-10-10T22:00', '2026-10-11T06:00')
    const r = computeWeek({ weekStart: WS, entries: [e], expenses: [], employers: [emp('A')] })
    expect(r.totalMinutes).toBe(480)
    const next = computeWeek({ weekStart: '2026-10-12', entries: [e], expenses: [], employers: [emp('A')] })
    expect(next.totalMinutes).toBe(0)
  })
  it('(g) expenses summed, in total, not multiplied; outside week ignored', () => {
    const r = computeWeek({
      weekStart: WS,
      entries: hoursEntries('A', 3090),
      expenses: [exp('A', '2026-10-06', 1000), exp('A', '2026-10-09', 550), exp('A', '2026-10-12', 9999)],
      employers: [emp('A')],
    })
    expect(r.expensesCents).toBe(1550)
    expect(r.byEmployer[0].expensesCents).toBe(1550)
    expect(r.totalCents).toBe(128000 + 55200 + 1550)
  })
  it('(h) archived employer still computed', () => {
    const r = computeWeek({ weekStart: WS, entries: hoursEntries('A', 600), expenses: [], employers: [emp('A', { archived: true })] })
    expect(r.regularCents).toBe(32000)
  })
  it('splits a shift straddling 2400 and rounds per segment', () => {
    const entries = [...hoursEntries('A', 2300), entry('A', '2026-10-11T08:00', '2026-10-11T10:00', 3333)]
    const r = computeWeek({ weekStart: WS, entries, expenses: [], employers: [emp('A')] })
    expect(r.overtimeMinutes).toBe(20)
    const base = Math.round(2300 * 3200 / 60) + Math.round(100 * 3333 / 60)
    expect(r.regularCents).toBe(base)
    expect(r.overtimeCents).toBe(Math.round(20 * 3333 * 1.5 / 60))
  })
  it('sorts entries by start and tolerates unknown employers', () => {
    const e2 = entry('Z', '2026-10-07T08:00', '2026-10-07T09:00')
    const e1 = entry('Z', '2026-10-06T08:00', '2026-10-06T09:00')
    const r = computeWeek({ weekStart: WS, entries: [e2, e1], expenses: [exp('Q', '2026-10-06', 100)], employers: [] })
    expect(r.byEmployer.map(b => b.employerId).sort()).toEqual(['Q', 'Z'])
    const z = r.byEmployer.find(b => b.employerId === 'Z')!
    expect(z.entries.map(x => x.id)).toEqual([e1.id, e2.id])
    expect(z.overtimeMinutes).toBe(0)
    expect(r.expensesCents).toBe(100)
  })
})
