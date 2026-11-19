import { useEffect, useState } from 'react'
import * as repo from '../data/repo'
import { formatUSD } from '../domain/money'
import { allocationsOf } from '../domain/payments'
import { formatDate } from '../domain/time'
import type { Payment } from '../domain/types'
import ItemRows, { type ListedItem } from './ItemRows'
import Modal from './Modal'

/** What a received row was paid with, what each item got, and the way to undo that payment. */
export default function PaymentDialog({
  payment: p,
  account,
  values,
  position,
  onMove,
  onClose,
  onUndo,
}: {
  payment: Payment
  account?: string
  /** Current exact values of the items in view (for older payments without stored allocations). */
  values: Map<string, number>
  /** When the row had more than one payment: which one this is (0 = newest). */
  position?: { index: number; count: number }
  onMove?: (dir: -1 | 1) => void
  onClose: () => void
  onUndo: () => void
}) {
  const [items, setItems] = useState<ListedItem[] | null>(null)
  const alloc = allocationsOf(p, values)
  const partial = p.kind === 'partial' || (p.kind === undefined && p.keepShortfall && p.receivedCents < p.expectedCents)

  useEffect(() => {
    let alive = true
    void Promise.all([
      Promise.all(p.entryIds.map((id) => repo.getEntry(id))),
      Promise.all(p.expenseIds.map((id) => repo.getExpense(id))),
    ]).then(([entries, expenses]) => {
      if (!alive) return
      // What each item got from this payment; "of" its full value when that was only part of it.
      const shown = (id: string, full: number | undefined): Pick<ListedItem, 'cents' | 'of'> => {
        const got = alloc[id]
        return got !== undefined && full !== undefined && got < full - 0.5 ? { cents: got, of: full } : { cents: got ?? full }
      }
      // Items deleted since then are simply left out.
      setItems([
        ...entries.flatMap((e) => (e ? [{ kind: 'entry' as const, item: e, ...shown(e.id, values.get(e.id) ?? p.itemCents?.[e.id]) }] : [])),
        ...expenses.flatMap((x) => (x ? [{ kind: 'expense' as const, item: x, ...shown(x.id, x.amountCents) }] : [])),
      ])
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p])

  const diff = p.receivedCents - p.expectedCents
  const marked = p.method === 'marked'
  const rows: [string, string][] = marked
    ? [['Marked on', formatDate(p.date)], ['Amount', formatUSD(p.expectedCents)]]
    : [
        ['Received on', formatDate(p.date)],
        ['Paid by', p.method === 'cash' ? 'Cash' : `Zelle${account ? ` · ${account}` : ''}`],
        ['Paid', partial ? 'Partial' : 'Full'],
        ['Received', formatUSD(p.receivedCents)],
        ['Expected', formatUSD(p.expectedCents)],
        ...(partial
          ? [['Left after this', formatUSD(Math.max(0, -diff))] as [string, string]]
          : diff !== 0
            ? [['Difference', diff < 0 ? `−${formatUSD(-diff)} accepted` : `+${formatUSD(diff)}`] as [string, string]]
            : []),
      ]
  return (
    <Modal label="Payment received" onClose={onClose}>
      <h2 className="px-2 pt-1 text-center text-xl font-semibold">{marked ? 'Marked as received' : 'Payment received'}</h2>
      {position && position.count > 1 && onMove && (
        <div className="mt-1 flex items-center justify-between">
          <button type="button" className="min-h-11 px-3 text-base text-muted disabled:opacity-30" disabled={position.index === 0} onClick={() => onMove(-1)}>
            ‹ Newer
          </button>
          <span className="text-sm text-muted">
            {position.index + 1} of {position.count}
          </span>
          <button
            type="button"
            className="min-h-11 px-3 text-base text-muted disabled:opacity-30"
            disabled={position.index === position.count - 1}
            onClick={() => onMove(1)}
          >
            Older ›
          </button>
        </div>
      )}
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
