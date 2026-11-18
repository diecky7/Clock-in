import { formatUSD } from '../domain/money'
import { formatClock, formatDuration, shiftMinutes } from '../domain/time'
import type { Expense, TimeEntry } from '../domain/types'
import { ReceiptIcon } from './icons'

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${SHORT_DAYS[new Date(y, m - 1, d).getDay()]} ${d}`
}

export type ListedItem = { kind: 'entry'; item: TimeEntry; cents?: number } | { kind: 'expense'; item: Expense; cents?: number }

/** Compact rows like the home screen's: day, what it was, and its value. Newest first. */
export default function ItemRows({ items, label }: { items: ListedItem[]; label: string }) {
  const sorted = [...items].sort((a, b) => key(b).localeCompare(key(a)))
  return (
    <ul aria-label={label} className="max-h-[40dvh] divide-y divide-border overflow-y-auto rounded-2xl bg-bg">
      {sorted.map((i) => (
        <li key={i.item.id} className="flex min-h-12 items-center gap-3 px-4 py-1.5 text-base">
          <span className="w-14 shrink-0 whitespace-nowrap text-muted">{dayLabel(i.kind === 'entry' ? i.item.start.slice(0, 10) : i.item.date)}</span>
          {i.kind === 'entry' ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {formatClock(i.item.start.slice(11, 16))} – {formatClock(i.item.end.slice(11, 16))}
              </span>
              <span className="block truncate text-sm text-muted">
                {formatDuration(shiftMinutes(i.item))}
                {i.item.service ? ` · ${i.item.service}` : ''}
              </span>
            </span>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <ReceiptIcon />
              <span className="truncate">{i.item.description}</span>
            </span>
          )}
          {i.cents !== undefined && <span className="shrink-0 tabular-nums">{formatUSD(Math.round(i.cents))}</span>}
        </li>
      ))}
    </ul>
  )
}

const key = (i: ListedItem) => (i.kind === 'entry' ? i.item.start : `${i.item.date}T99:99`)
