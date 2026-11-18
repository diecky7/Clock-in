import { computeWeek } from './pay'
import type { Employer, Expense, Payment, TimeEntry } from './types'
import { weekStartOf } from './weeks'

/**
 * What each entry and expense is worth, in exact (unrounded) cents. Overtime is judged on the whole work week,
 * so pass every entry of the weeks involved.
 */
export function itemValues(entries: TimeEntry[], expenses: Expense[], employers: Employer[], weekStartsOn: number): Map<string, number> {
  const out = new Map<string, number>()
  for (const ws of new Set(entries.map((e) => weekStartOf(e.start.slice(0, 10), weekStartsOn)))) {
    const w = computeWeek({ weekStart: ws, entries, expenses: [], employers })
    for (const g of w.byEmployer) for (const s of g.splits) out.set(s.entryId, s.regularExact + s.overtimeExact)
  }
  for (const x of expenses) out.set(x.id, x.amountCents)
  return out
}

/** The payment each entry or expense belongs to. */
export function paidBy(payments: Payment[]): Map<string, Payment> {
  const out = new Map<string, Payment>()
  for (const p of payments) for (const id of [...p.entryIds, ...p.expenseIds]) out.set(id, p)
  return out
}

/**
 * Still owed for the given items: everything not paid yet, plus the part of a short payment that was kept as owed
 * (shared out by how much of that payment's items are in this list), plus what a paid item grew by if edited later.
 */
export function toReceiveCents(itemIds: string[], values: Map<string, number>, payments: Payment[]): number {
  const by = paidBy(payments)
  let owed = 0
  const inList = new Map<Payment, number>()
  for (const id of itemIds) {
    const v = values.get(id) ?? 0
    const p = by.get(id)
    if (!p) {
      owed += v
      continue
    }
    // Edited after it was paid: what it grew by is still owed.
    const was = p.itemCents?.[id]
    if (was !== undefined && v > was) owed += v - was
    if (p.keepShortfall) inList.set(p, (inList.get(p) ?? 0) + Math.min(v, was ?? v))
  }
  for (const [p, v] of inList) {
    const short = p.expectedCents - p.receivedCents
    if (short > 0 && p.expectedCents > 0) owed += (short * v) / p.expectedCents
  }
  return Math.max(0, Math.round(owed))
}
