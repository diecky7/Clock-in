import { formatUSD } from '../domain/money'
import ItemRows, { type ListedItem } from './ItemRows'
import Modal from './Modal'

/** What is still open in the period on screen, with a shortcut to receive it. */
export default function OpenDialog({
  items,
  toReceiveCents,
  otherCents,
  periodLabel,
  onReceive,
  onClose,
}: {
  items: ListedItem[]
  toReceiveCents: number
  /** Owed on items already paid: kept shortfalls and items that grew after payment. */
  otherCents: number
  periodLabel: string
  onReceive: () => void
  onClose: () => void
}) {
  const other = otherCents
  return (
    <Modal label="Still to receive" onClose={onClose}>
      <h2 className="px-2 pt-1 text-center text-xl font-semibold">Still to receive</h2>
      <p className="mt-1 text-center text-base text-muted">{periodLabel}</p>
      <p className="mt-3 text-center text-3xl font-semibold tabular-nums">{formatUSD(toReceiveCents)}</p>
      {items.length > 0 && (
        <div className="mt-4">
          <ItemRows items={items} label="Open" />
        </div>
      )}
      {other > 0 && (
        <p className="mt-2 flex justify-between px-1 text-base">
          <span className="text-muted">Short on earlier payments</span>
          <span className="tabular-nums">{formatUSD(other)}</span>
        </p>
      )}
      {items.length > 0 && (
        <button type="button" className="mt-4 min-h-12 w-full rounded-full bg-accent text-base font-semibold text-accent-fg" onClick={onReceive}>
          Receive payment
        </button>
      )}
      <button type="button" className="min-h-12 w-full text-base text-muted" onClick={onClose}>
        Close
      </button>
    </Modal>
  )
}
