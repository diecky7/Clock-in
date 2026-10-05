import { describe, it, expect } from 'vitest'
import { addDays, weekStartOf, weekDates, weekLabel } from './weeks'
describe('weeks', () => {
  it('addDays', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
    expect(addDays('2026-10-05', -5)).toBe('2026-09-30')
  })
  it('weekStartOf', () => {
    expect(weekStartOf('2026-10-07', 0)).toBe('2026-10-04')
    expect(weekStartOf('2026-10-07', 1)).toBe('2026-10-05')
    expect(weekStartOf('2026-10-04', 0)).toBe('2026-10-04')
  })
  it('weekDates', () => {
    expect(weekDates('2026-10-25')).toEqual(['2026-10-25','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31'])
  })
  it('weekLabel', () => {
    expect(weekLabel('2026-10-04')).toBe('Oct 4 – 10')
    expect(weekLabel('2026-10-26')).toBe('Oct 26 – Nov 1')
  })
})
