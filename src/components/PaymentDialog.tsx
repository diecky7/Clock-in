import { formatUSD } from '../domain/money'
import { formatDate } from '../domain/time'
import type { Payment } from '../domain/types'
import Modal from './Modal'

/** What a received row was paid with, and the way to undo that payment. */
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
  const diff = p.receivedCents - p.expectedCents
  const items = p.entryIds.length + p.expenseIds.length
  const rows: [string, string][] = [
    ['Received on', formatDate(p.date)],
    ['Paid by', p.method === 'cash' ? 'Cash' : `Zelle${account ? ` · ${account}` : ''}`],
    ['Received', formatUSD(p.receivedCents)],
    ['Expected', formatUSD(p.expectedCents)],
    ...(diff !== 0 ? [['Difference', `${diff < 0 ? '−' : '+'}${formatUSD(Math.abs(diff))}${diff < 0 && p.keepShortfall ? ' · still to receive' : ''}`] as [string, string]] : []),
    ['Covers', `${items} ${items === 1 ? 'item' : 'items'}`],
  ]
  return (
    <Modal label="Payment received" onClose={onClose}>
      <h2 className="px-2 pt-1 text-center text-xl font-semibold">Payment received</h2>
      <dl className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-bg">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-h-11 items-center justify-between gap-4 px-4 text-base">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="mt-4 min-h-12 w-full rounded-full border border-border text-base font-medium text-danger" onClick={onUndo}>
        Undo payment
      </button>
      <button type="button" className="min-h-12 w-full text-base text-muted" onClick={onClose}>
        Close
      </button>
    </Modal>
  )
}
