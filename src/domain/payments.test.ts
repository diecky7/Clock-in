import { describe, expect, it } from 'vitest'
import { itemValues, toReceiveCents } from './payments'
import type { Employer, Expense, Payment, TimeEntry } from './types'

const emp = { id: 'e', name: 'A', overtimeEnabled: true, archived: false, rates: [] } as Employer
const shift = (d: string, h = 10): TimeEntry =>
  ({ id: d, employerId: 'e', start: `${d}T07:00`, end: `${d}T${String(7 + h).padStart(2, '0')}:00`, breakMin: 0, rateCents: 2000 }) as TimeEntry
const pay = (p: Partial<Payment>): Payment => ({
  id: 'p', date: '2026-10-10', entryIds: [], expenseIds: [], expectedCents: 0, receivedCents: 0, method: 'cash', keepShortfall: false, createdAt: 1, ...p,
})

describe('payments', () => {
  // Mon–Fri 10 h at $20 = 50 h: Friday is all overtime ($300).
  const entries = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'].map((d) => shift(d))
  const expense = { id: 'x', employerId: 'e', date: '2026-10-01', amountCents: 1500, description: 'paint', photoIds: [] } as Expense
  const values = itemValues(entries, [expense], [emp], 0)
  const all = [...entries.map((e) => e.id), 'x']

  it('values each shift with the overtime it really earned', () => {
    expect(values.get('2026-09-28')).toBe(20000)
    expect(values.get('2026-10-02')).toBe(30000)
    expect(values.get('x')).toBe(1500)
  })

  it('an item edited after it was paid owes what it grew by', () => {
    const p = pay({ entryIds: ['2026-09-28'], expectedCents: 20000, receivedCents: 20000, itemCents: { '2026-09-28': 20000 } })
    const grown = new Map(values).set('2026-09-28', 26000)
    expect(toReceiveCents(['2026-09-28'], grown, [p])).toBe(6000)
    expect(toReceiveCents(['2026-09-28'], new Map(values).set('2026-09-28', 15000), [p])).toBe(0)
  })

  it('owes everything unpaid, nothing once paid, and a kept shortfall', () => {
    expect(toReceiveCents(all, values, [])).toBe(111500)
    const full = pay({ entryIds: entries.map((e) => e.id), expenseIds: ['x'], expectedCents: 111500, receivedCents: 111500 })
    expect(toReceiveCents(all, values, [full])).toBe(0)
    const short = { ...full, receivedCents: 101500 }
    expect(toReceiveCents(all, values, [short])).toBe(0) // shortfall not kept
    expect(toReceiveCents(all, values, [{ ...short, keepShortfall: true }])).toBe(10000)
    // Only October's part of the payment is in view: its share of the shortfall.
    const oct = ['2026-10-01', '2026-10-02', 'x']
    expect(toReceiveCents(oct, values, [{ ...short, keepShortfall: true }])).toBe(Math.round((10000 * 51500) / 111500))
  })
})
