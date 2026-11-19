import { describe, expect, it } from 'vitest'
import { allocateOldestFirst, itemStates, itemValues, toReceiveCents } from './payments'
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

  it('a full payment settles its items, even when less was accepted', () => {
    const ids = ['2026-09-28', '2026-09-29']
    const p = pay({ kind: 'full', entryIds: ids, expectedCents: 40000, receivedCents: 39000, allocations: { '2026-09-28': 20000, '2026-09-29': 20000 } })
    const st = itemStates(values, [p])
    expect(st.get('2026-09-28')?.status).toBe('paid')
    expect(toReceiveCents(all, st)).toBe(111500 - 40000)
  })

  it('a partial payment fills the oldest first and leaves the rest owed', () => {
    const owed = all.slice(0, 3).map((id) => ({ id, owed: values.get(id)! }))
    const alloc = allocateOldestFirst(owed, 30000)
    expect(alloc).toEqual({ '2026-09-28': 20000, '2026-09-29': 10000 })
    const st = itemStates(values, [pay({ kind: 'partial', entryIds: Object.keys(alloc), expectedCents: 60000, receivedCents: 30000, allocations: alloc })])
    expect(st.get('2026-09-28')?.status).toBe('paid')
    expect(st.get('2026-09-29')).toMatchObject({ status: 'partial', received: 10000, remaining: 10000 })
    expect(st.get('2026-09-30')?.status).toBe('open')
    expect(toReceiveCents(all, st)).toBe(111500 - 30000)
  })

  it('partial money in whole cents never spills a fraction onto the next item', () => {
    const owed = [{ id: 'a', owed: 18041.67 }, { id: 'b', owed: 18041.67 }, { id: 'c', owed: 18041.67 }]
    expect(allocateOldestFirst(owed, 18042)).toEqual({ a: 18041.67 })
    expect(allocateOldestFirst(owed, 36084)).toEqual({ a: 18041.67, b: 18041.67 })
    expect(allocateOldestFirst(owed, 20000)).toEqual({ a: 18041.67, b: 1958 })
  })

  it('two payments add up on the same item', () => {
    const p1 = pay({ id: 'a', kind: 'partial', entryIds: ['2026-09-28'], allocations: { '2026-09-28': 5000 }, createdAt: 1 })
    const p2 = pay({ id: 'b', kind: 'full', entryIds: ['2026-09-28'], allocations: { '2026-09-28': 15000 }, createdAt: 2 })
    const st = itemStates(values, [p1, p2]).get('2026-09-28')!
    expect(st.status).toBe('paid')
    expect(st.payments.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('an item edited after it was paid owes what it grew by', () => {
    const p = pay({ entryIds: ['2026-09-28'], expectedCents: 20000, receivedCents: 20000, allocations: { '2026-09-28': 20000 } })
    const grown = new Map(values).set('2026-09-28', 26000)
    expect(itemStates(grown, [p]).get('2026-09-28')).toMatchObject({ status: 'partial', remaining: 6000 })
  })

  it('reads older payments: full at their value then, or kept shortfall shared in proportion', () => {
    const old = pay({ entryIds: ['2026-09-28'], expenseIds: ['x'], expectedCents: 21500, receivedCents: 20000, itemCents: { '2026-09-28': 20000, x: 1500 } })
    expect(toReceiveCents(['2026-09-28', 'x'], itemStates(values, [old]))).toBe(0)
    const kept = { ...old, keepShortfall: true }
    expect(toReceiveCents(['2026-09-28', 'x'], itemStates(values, [kept]))).toBe(1500)
  })
})
