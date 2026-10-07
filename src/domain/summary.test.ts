import { describe, expect, it } from 'vitest'
import { monthRange, summarizePeriod, yearRange } from './summary'
import type { Employer, TimeEntry } from './types'

const emp = { id: 'e', name: 'A', overtimeEnabled: true } as Employer
const entry = (date: string): TimeEntry =>
  ({ id: date, employerId: 'e', start: `${date}T08:00`, end: `${date}T16:00`, breakMin: 0, rateCents: 2000 }) as TimeEntry

describe('summary', () => {
  it('sums hours, pay and expenses inside the range only', () => {
    const s = summarizePeriod({
      from: '2026-10-01', to: '2026-10-31', weekStartsOn: 1, employers: [emp],
      entries: [entry('2026-10-05'), entry('2026-10-06'), entry('2026-09-30')],
      expenses: [{ id: 'x', employerId: 'e', date: '2026-10-05', amountCents: 500, description: 'gas' } as never],
    })
    expect(s.minutes).toBe(960)
    expect(s.earnedCents).toBe(32000)
    expect(s.expensesCents).toBe(500)
    expect(s.totalCents).toBe(32500)
  })
  it('ranges', () => {
    expect(monthRange('2026-02-10')).toEqual(['2026-02-01', '2026-02-28'])
    expect(yearRange('2026-10-07')).toEqual(['2026-01-01', '2026-12-31'])
  })
})
