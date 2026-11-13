import { describe, expect, it } from 'vitest'
import { buildReportModel } from './report'
import { defaultOptions } from './options'
import { computeWeek } from '../domain/pay'
import { SIDE_JOB } from '../domain/employers'
import type { Employer, Expense, TimeEntry } from '../domain/types'

const emp: Employer = {
  id: 'e1', name: 'Acme Painting', overtimeEnabled: true, archived: false,
  rates: [{ from: '2026-01-01', cents: 3000 }],
}
const weekStart = '2026-10-05' // Monday

function entry(id: string, day: string, from: string, to: string, extra: Partial<TimeEntry> = {}): TimeEntry {
  return { id, employerId: 'e1', start: `${day}T${from}`, end: `${day}T${to}`, breakMin: 0, rateCents: 3000, ...extra }
}
const entries: TimeEntry[] = [
  entry('a', '2026-10-05', '07:00', '17:00', { breakMin: 30, place: { lat: 1, lon: 1, label: '12 Main St' } }),
  entry('b', '2026-10-06', '07:00', '17:00'),
  entry('c', '2026-10-07', '07:00', '17:00'),
  entry('d', '2026-10-08', '07:00', '17:00'),
  entry('e', '2026-10-09', '07:00', '17:00'),
]
const expenses: Expense[] = [
  { id: 'x1', employerId: 'e1', date: '2026-10-07', description: 'Brushes', amountCents: 2500, photoIds: ['p1', 'p2'] },
  { id: 'x2', employerId: 'e1', date: '2026-10-08', description: 'Tape', amountCents: 1000, photoIds: ['p3'] },
]
function week() {
  return computeWeek({ weekStart, entries, expenses, employers: [emp] }).byEmployer[0]
}
const build = (o = {}) => buildReportModel(week(), emp, weekStart, { ...defaultOptions, ...o })

describe('buildReportModel', () => {
  it('prints a long saved address in short form', () => {
    const long = [{ ...entries[0], place: { lat: 1, lon: 1, label: '12 Main Street, Framingham, Massachusetts' } }, ...entries.slice(1)]
    const w = computeWeek({ weekStart, entries: long, expenses, employers: [emp] }).byEmployer[0]
    const m = buildReportModel(w, emp, weekStart, { ...defaultOptions })
    expect(m.days[0].detail).toContain('12 Main St, Framingham, MA')
    expect(m.days[0].detail).not.toContain('Massachusetts')
  })

  it('all on: value lines and total', () => {
    const w = week()
    const m = build()
    expect(m.valueLines.map(l => l.label)).toEqual(['Regular pay', 'Overtime pay', 'Expenses'])
    expect(m.totalCents).toBe(w.regularCents + w.overtimeCents + w.expensesCents)
    expect(m.hoursTotal).toBe('49h 30m')
    expect(m.employerName).toBe('Acme Painting')
    expect(m.weekLabel).toBe('Oct 5 – 11')
    expect(m.rateLabel).toBe('$30.00/h')
  })
  it('overtimePay off keeps hours but excludes the line and amount', () => {
    const w = week()
    const m = build({ overtimePay: false })
    expect(m.valueLines.map(l => l.label)).toEqual(['Regular pay', 'Expenses'])
    expect(m.totalCents).toBe(w.regularCents + w.expensesCents)
    expect(m.hoursTotal).toBe('49h 30m')
  })
  it('all value options off: no lines, null total', () => {
    const m = build({ regularPay: false, overtimePay: false, expenses: false })
    expect(m.valueLines).toEqual([])
    expect(m.totalCents).toBeNull()
  })
  it('expenses off: no items or receipts', () => {
    const m = build({ expenses: false })
    expect(m.expenseItems).toEqual([])
    expect(m.receipts).toEqual([])
  })
  it('expenses on: items and one receipt per photo', () => {
    const m = build()
    expect(m.expenseItems).toEqual([{ description: 'Brushes', cents: 2500 }, { description: 'Tape', cents: 1000 }])
    expect(m.receipts.map(r => [r.photoId, r.index, r.count])).toEqual([['p1', 1, 3], ['p2', 2, 3], ['p3', 3, 3]])
    expect(m.receipts[0]).toMatchObject({ description: 'Brushes', employerName: 'Acme Painting', dateLabel: 'Wed, Oct 7', amountCents: 2500 })
  })
  it('hourlyRate off: no rateLabel; differing rates give a range', () => {
    expect(build({ hourlyRate: false }).rateLabel).toBeUndefined()
    const w = week()
    w.entries[1] = { ...w.entries[1], rateCents: 3400 }
    expect(buildReportModel(w, emp, weekStart, defaultOptions).rateLabel).toBe('$30.00–$34.00/h')
  })
  it('day rows: times, break, address', () => {
    const d = build().days[0]
    expect(d.label).toBe('Mon, Oct 5')
    expect(d.hours).toBe('9h 30m')
    expect(d.times).toBe('7:00 AM – 5:00 PM')
    expect(d.detail).toBe('30 min break · 12 Main St')
    expect(build().days[1].detail).toBeUndefined()
    expect(build().days).toHaveLength(5)
  })
  it('addresses / timesAndBreak off remove those parts', () => {
    expect(build({ addresses: false }).days[0].detail).toBe('30 min break')
    const d = build({ timesAndBreak: false }).days[0]
    expect(d.detail).toBe('12 Main St')
    expect(d.times).toBeUndefined()
    expect(build({ timesAndBreak: false, addresses: false }).days[0].detail).toBeUndefined()
  })
  it('rate falls back to rateOn with no entries', () => {
    const m = buildReportModel({ ...week(), entries: [] }, emp, weekStart, defaultOptions)
    expect(m.rateLabel).toBe('$30.00/h')
  })
})

describe('buildReportModel for Side job', () => {
  const side = (id: string, day: string, hours: number, rateCents: number, service?: string): TimeEntry => ({
    id, employerId: 'side-job', start: `${day}T08:00`, end: `${day}T${String(8 + hours).padStart(2, '0')}:00`, breakMin: 0, rateCents,
    ...(service ? { service } : {}),
  })
  const rows = [side('s1', '2026-10-05', 4, 2000, 'Fence repair'), side('s2', '2026-10-06', 8, 3500), side('s3', '2026-10-07', 12, 3000, 'Deck')]
  const w = computeWeek({ weekStart, entries: rows, expenses: [], employers: [SIDE_JOB] }).byEmployer[0]

  it('totals each entry at its own rate, no overtime past 40 h', () => {
    const m = buildReportModel(w, SIDE_JOB, weekStart, defaultOptions)
    expect(m.employerName).toBe('Side job')
    expect(m.hoursTotal).toBe('24h 00m')
    expect(m.valueLines).toEqual([{ label: 'Regular pay', detail: '24h 00m', cents: 4 * 2000 + 8 * 3500 + 12 * 3000 }])
    expect(m.totalCents).toBe(8000 + 28000 + 36000)
    expect(m.rateLabel).toBeUndefined() // rows carry their own rate
  })

  it('every row carries its own rate and service', () => {
    const m = buildReportModel(w, SIDE_JOB, weekStart, defaultOptions)
    expect(m.days.map((d) => d.detail)).toEqual(['$20.00/h · Fence repair', '$35.00/h', '$30.00/h · Deck'])
  })

  it('rate off: the rows keep the service only', () => {
    const m = buildReportModel(w, SIDE_JOB, weekStart, { ...defaultOptions, hourlyRate: false })
    expect(m.days.map((d) => d.detail)).toEqual(['Fence repair', undefined, 'Deck'])
    expect(m.rateLabel).toBeUndefined()
  })

  it('regular employers do not get per-row rates', () => {
    expect(build().days[1].detail).toBeUndefined()
  })
})

describe('buildReportModel edge cases', () => {
  it('no Regular pay line and no $0.00/h for a section with no hours', () => {
    const w = { ...week(), entries: [], minutes: 0, regularMinutes: 0, regularCents: 0 }
    const none = { ...emp, rates: [] }
    const m = buildReportModel(w, none, weekStart, defaultOptions)
    expect(m.valueLines.find((l) => l.label === 'Regular pay')).toBeUndefined()
    expect(m.rateLabel).toBeUndefined()
  })
})
