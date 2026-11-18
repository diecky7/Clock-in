import { useEffect, useState } from 'react'
import * as repo from '../data/repo'
import { formatUSD } from '../domain/money'
import { formatDate } from '../domain/time'
import type { Payment } from '../domain/types'
import ItemRows, { type ListedItem } from './ItemRows'
import Modal from './Modal'

/** What a received row was paid with, the items it covered, and the way to undo that payment. */
export default function PaymentDialog({
  payment: p,
  account,
  onClose,
  onUndo,
}: {
  payment: Payment
  account?: string
  onClose: () => void
  onUndo: () => void
}) {
  const [items, setItems] = useState<ListedItem[] | null>(null)
  useEffect(() => {
    let alive = true
    void Promise.all([
      Promise.all(p.entryIds.map((id) => repo.getEntry(id))),
      Promise.all(p.expenseIds.map((id) => repo.getExpense(id))),
    ]).then(([entries, expenses]) => {
      if (!alive) return
      // Items deleted since then are simply left out.
      setItems([
        ...entries.flatMap((e) => (e ? [{ kind: 'entry' as const, item: e, cents: p.itemCents?.[e.id] }] : [])),
        ...expenses.flatMap((x) => (x ? [{ kind: 'expense' as const, item: x, cents: p.itemCents?.[x.id] ?? x.amountCents }] : [])),
      ])
    })
    return () => {
      alive = false
    }
  }, [p])

  const diff = p.receivedCents - p.expectedCents
  const marked = p.method === 'marked'
  const rows: [string, string][] = marked
    ? [['Marked on', formatDate(p.date)], ['Amount', formatUSD(p.expectedCents)]]
    : [
        ['Received on', formatDate(p.date)],
        ['Paid by', p.method === 'cash' ? 'Cash' : `Zelle${account ? ` · ${account}` : ''}`],
        ['Received', formatUSD(p.receivedCents)],
        ['Expected', formatUSD(p.expectedCents)],
        ...(diff !== 0
          ? [['Difference', `${diff < 0 ? '−' : '+'}${formatUSD(Math.abs(diff))}${diff < 0 && p.keepShortfall ? ' · still to receive' : ''}`] as [string, string]]
          : []),
      ]
  return (
    <Modal label="Payment received" onClose={onClose}>
      <h2 className="px-2 pt-1 text-center text-xl font-semibold">{marked ? 'Marked as received' : 'Payment received'}</h2>
      <dl className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-bg">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-h-11 items-center justify-between gap-4 px-4 text-base">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {items && items.length > 0 && (
        <>
          <h3 className="mt-4 px-1 text-sm text-muted">Paid for</h3>
          <div className="mt-1">
            <ItemRows items={items} label="Paid for" />
          </div>
        </>
      )}
      <button type="button" className="mt-4 min-h-12 w-full rounded-full border border-border text-base font-medium text-danger" onClick={onUndo}>
        Undo payment
      </button>
      <button type="button" className="min-h-12 w-full text-base text-muted" onClick={onClose}>
        Close
      </button>
    </Modal>
  )
}
