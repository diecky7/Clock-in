import { describe, it, expect } from 'vitest'
import { shiftMinutes, validateShift, formatDateTime, formatHours } from './time'
describe('time', () => {
  it('shiftMinutes', () => {
    expect(shiftMinutes({ start: '2026-10-05T07:00', end: '2026-10-05T15:30', breakMin: 30 })).toBe(480)
    expect(shiftMinutes({ start: '2026-10-05T22:00', end: '2026-10-06T06:00', breakMin: 0 })).toBe(480)
    expect(shiftMinutes({ start: '2026-11-01T00:00', end: '2026-11-01T08:00', breakMin: 0 })).toBe(540)
  })
  it('validateShift', () => {
    expect(validateShift({ start: '2026-10-05T08:00', end: '2026-10-05T08:00', breakMin: 0 })).toBe('OUT_BEFORE_IN')
    expect(validateShift({ start: '2026-10-05T09:00', end: '2026-10-05T08:00', breakMin: 0 })).toBe('OUT_BEFORE_IN')
    expect(validateShift({ start: '2026-10-05T08:00', end: '2026-10-05T09:00', breakMin: 60 })).toBe('BREAK_TOO_LONG')
    expect(validateShift({ start: '2026-10-05T08:00', end: '2026-10-05T09:00', breakMin: 59 })).toBeNull()
  })
  it('formatDateTime', () => {
    expect(formatDateTime('2026-10-05T07:00')).toBe('Mon, Oct 5 · 7:00 AM')
    expect(formatDateTime('2026-10-05T00:05')).toBe('Mon, Oct 5 · 12:05 AM')
    expect(formatDateTime('2026-10-05T12:00')).toBe('Mon, Oct 5 · 12:00 PM')
    expect(formatDateTime('2026-10-05T23:30')).toBe('Mon, Oct 5 · 11:30 PM')
  })
  it('formatHours', () => {
    expect(formatHours(480)).toBe('8.0')
    expect(formatHours(510)).toBe('8.5')
    expect(formatHours(495)).toBe('8.25')
  })
})
