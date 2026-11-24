import { useEffect, useRef, useState } from 'react'
import * as repo from '../data/repo'
import { ALL_EMPLOYERS } from '../domain/employers'
import { formatUSD } from '../domain/money'
import { anchorFor, periodStart } from '../domain/periods'
import { formatDay } from '../domain/time'
import { today } from '../domain/today'
import { offerUndo } from '../undo'
import DateTimeField from './DateTimeField'
import Modal from './Modal'

/**
 * Settles older work in one go: everything before the chosen day becomes "received". The day starts on the first
 * day of the latest two-week period that has data, so that period stays open.
 */
export default function MarkReceivedDialog({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState('')
  const [preview, setPreview] = useState<{ entries: number; expenses: number; cents: number } | null>(null)
  const [busy, setBusy] = useState(false)
  // A ref, not just state: two quick taps in the same moment must not save it twice.
  const running = useRef(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [last, s, emps] = await Promise.all([repo.latestDataDate(), repo.getSettings(), repo.listEmployers()])
      if (!alive) return
      setDate(last ? periodStart('biweek', last, s.weekStartsOn, anchorFor(emps, ALL_EMPLOYERS, s.lastEmployerId, s.biweeklyStart)) : today())
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!date) return
    let alive = true
    setPreview(null)
    void repo.unpaidBefore(date).then((u) => {
      if (alive)
        setPreview({ entries: u.entries.length, expenses: u.expenses.length, cents: Math.round(Object.values(u.itemCents).reduce((a, b) => a + b, 0)) })
    })
    return () => {
      alive = false
    }
  }, [date])

  async function mark() {
    if (running.current || !date) return
    running.current = true
    setBusy(true)
    try {
      const u = await repo.unpaidBefore(date)
      if (u.entries.length + u.expenses.length === 0) return onClose()
      const cents = Math.round(Object.values(u.itemCents).reduce((a, b) => a + b, 0))
      const payment = {
        id: crypto.randomUUID(),
        date: today(),
        entryIds: u.entries.map((e) => e.id),
        expenseIds: u.expenses.map((x) => x.id),
        expectedCents: cents,
        receivedCents: cents,
        method: 'marked' as const,
        keepShortfall: false,
        kind: 'full' as const,
        allocations: u.itemCents,
        createdAt: Date.now(),
      }
      await repo.savePayment(payment)
      offerUndo('Marked as received', () => repo.deletePayment(payment.id))
      onClose()
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  const n = preview ? preview.entries + preview.expenses : 0
  return (
    <Modal label="Mark older work as received" onClose={onClose}>
      <h2 className="px-2 pt-1 text-center text-xl font-semibold">Mark older work as received</h2>
      <DateTimeField type="date" label="Everything before" value={date} onChange={(v) => v && setDate(v)} />
      <p className="mt-3 px-1 text-base text-muted">
        {!preview
          ? '…'
          : n === 0
            ? 'Nothing open before this day.'
            : `${preview.entries} ${preview.entries === 1 ? 'entry' : 'entries'}${preview.expenses ? ` and ${preview.expenses} ${preview.expenses === 1 ? 'expense' : 'expenses'}` : ''} before ${formatDay(date)}, worth ${formatUSD(preview.cents)}, will count as received.`}
      </p>
      <button
        type="button"
        disabled={!preview || n === 0 || busy}
        className="mt-4 min-h-12 w-full rounded-full bg-accent text-base font-semibold text-accent-fg disabled:opacity-50"
        onClick={() => void mark()}
      >
        Mark as received
      </button>
      <button type="button" className="min-h-12 w-full text-base text-muted" onClick={onClose}>
        Cancel
      </button>
    </Modal>
  )
}
