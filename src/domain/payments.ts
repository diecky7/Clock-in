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

/** Under half a cent left counts as nothing: values are exact and may carry fractions. */
const EPS = 0.5

/**
 * Exact cents a payment applied to each of its items. Payments made before allocations were stored are read as:
 * fully settling each item at its value then; or, when the rest was kept as owed, the received amount shared out
 * in proportion.
 */
export function allocationsOf(p: Payment, values: Map<string, number>): Record<string, number> {
  if (p.allocations) return p.allocations
  const ids = [...p.entryIds, ...p.expenseIds]
  const worth = (id: string) => p.itemCents?.[id] ?? values.get(id) ?? 0
  const short = p.keepShortfall && p.receivedCents < p.expectedCents && p.expectedCents > 0
  const share = short ? p.receivedCents / p.expectedCents : 1
  return Object.fromEntries(ids.map((id) => [id, worth(id) * share]))
}

export interface ItemState {
  /** Exact cents received for it so far. */
  received: number
  /** Exact cents still owed (never below zero). */
  remaining: number
  status: 'open' | 'partial' | 'paid'
  /** Payments that touched it, newest first. */
  payments: Payment[]
}

/** Where each item stands: open, partly received or received. Items with no payment are simply open. */
export function itemStates(values: Map<string, number>, payments: Payment[]): Map<string, ItemState> {
  const out = new Map<string, ItemState>()
  for (const [id, v] of values) out.set(id, { received: 0, remaining: v, status: v > EPS ? 'open' : 'paid', payments: [] })
  const newest = [...payments].sort((a, b) => b.createdAt - a.createdAt)
  for (const p of newest)
    for (const [id, cents] of Object.entries(allocationsOf(p, values))) {
      const st = out.get(id)
      if (!st) continue // outside the loaded period, or deleted
      st.received += cents
      st.payments.push(p)
    }
  for (const [id, st] of out) {
    const v = values.get(id) ?? 0
    st.remaining = Math.max(0, v - st.received)
    // Nothing owed but never paid (worth $0): no mark at all.
    st.status = st.remaining <= EPS ? (st.payments.length ? 'paid' : 'open') : st.received > EPS ? 'partial' : 'open'
    if (st.remaining <= EPS) st.remaining = 0
  }
  return out
}

/** Still owed for the given items, in whole cents. */
export function toReceiveCents(itemIds: string[], states: Map<string, ItemState>): number {
  return Math.round(itemIds.reduce((s, id) => s + (states.get(id)?.remaining ?? 0), 0))
}

/**
 * Splits money over items, oldest first: each gets what it still owes until the money runs out.
 * `items` must already be in date order.
 */
export function allocateOldestFirst(items: { id: string; owed: number }[], cents: number): Record<string, number> {
  // Money is typed in whole cents against amounts shown rounded, so compare whole cents: an item shown as $180.42
  // is fully paid by $180.42, with no fraction of a cent spilling onto the next one.
  const out: Record<string, number> = {}
  let left = cents
  for (const i of items) {
    if (left <= EPS) break
    const due = Math.round(i.owed)
    if (left >= due) {
      out[i.id] = i.owed
      left -= due
    } else {
      out[i.id] = left
      left = 0
    }
  }
  return out
}
