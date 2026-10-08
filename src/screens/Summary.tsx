import { useEffect, useMemo, useState } from 'react'
import { Screen } from '../components/ui'
import { useWeekSwipe } from '../components/useWeekSwipe'
import * as repo from '../data/repo'
import { formatUSD } from '../domain/money'
import { formatHours } from '../domain/time'
import { today } from '../domain/today'
import { monthRange, summarizePeriod, yearRange } from '../domain/summary'
import type { Employer, Expense, TimeEntry } from '../domain/types'
import { addDays, weekLabel, weekStartOf } from '../domain/weeks'

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const VIEWS = ['Week', 'Month', 'Year'] as const
type View = (typeof VIEWS)[number]

export default function Summary() {
  const [weekStartsOn, setWeekStartsOn] = useState<number | null>(null)
  const [weekStart, setWeekStart] = useState<string | null>(null)
  const [view, setView] = useState<View>('Week')
  const [data, setData] = useState<{ employers: Employer[]; entries: TimeEntry[]; expenses: Expense[] } | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const s = await repo.getSettings()
      const [employers, entries, expenses] = await Promise.all([
        repo.listEmployers(),
        repo.listEntriesBetween('0000-01-01', '9999-12-31'),
        repo.listExpensesBetween('0000-01-01', '9999-12-31'),
      ])
      if (!alive) return
      setData({ employers, entries, expenses })
      setWeekStartsOn(s.weekStartsOn)
      setWeekStart(weekStartOf(today(), s.weekStartsOn))
    })().catch(() => alive && setData({ employers: [], entries: [], expenses: [] }))
    return () => {
      alive = false
    }
  }, [])

  // The week drives everything: the month and year are the ones the week mostly falls in (its Thursday-ish middle day).
  const anchor = weekStart ? addDays(weekStart, 3) : null
  const { range, label } = useMemo(() => {
    if (!weekStart || !anchor) return { range: null, label: '' }
    if (view === 'Week') return { range: [weekStart, addDays(weekStart, 6)] as [string, string], label: weekLabel(weekStart) }
    if (view === 'Month') return { range: monthRange(anchor), label: `${MONTH[Number(anchor.slice(5, 7)) - 1]} ${anchor.slice(0, 4)}` }
    return { range: yearRange(anchor), label: anchor.slice(0, 4) }
  }, [weekStart, anchor, view])

  const sum = useMemo(
    () => (data && range && weekStartsOn !== null ? summarizePeriod({ from: range[0], to: range[1], weekStartsOn, ...data }) : null),
    [data, range, weekStartsOn],
  )

  const swipe = useWeekSwipe((dir) => setWeekStart((w) => (w ? addDays(w, dir * 7) : w)))
  const iconBtn = 'grid size-11 place-items-center rounded-full text-2xl'
  return (
    <Screen title="Summary" back="/" swipe={swipe}>
      {weekStart && sum && (
        <>
          <nav aria-label="Week" className="mt-2 flex items-center justify-between">
            <button type="button" aria-label="Previous week" className={iconBtn} onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ‹
            </button>
            <span className="text-base font-medium">{weekLabel(weekStart)}</span>
            <button type="button" aria-label="Next week" className={iconBtn} onClick={() => setWeekStart(addDays(weekStart, 7))}>
              ›
            </button>
          </nav>

          <div role="group" aria-label="Show" className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`min-h-10 rounded-lg text-sm font-medium ${view === v ? 'bg-accent text-accent-fg' : 'text-muted'}`}
              >
                {v}
              </button>
            ))}
          </div>

          <section aria-label="Totals" className="mt-8 text-center">
            <p className="h-5 text-base text-muted">{view === 'Week' ? '' : label}</p>
            <p className="mt-1 text-6xl font-semibold tabular-nums tracking-tight">{formatUSD(sum.totalCents)}</p>
          </section>
          <dl className="mt-6 divide-y divide-border overflow-hidden rounded-2xl bg-surface">
            {(
              [
                ['Hours', `${formatHours(sum.minutes)} h`],
                ['Overtime', `${formatHours(sum.overtimeMinutes)} h`],
                ['Earnings', formatUSD(sum.earnedCents)],
                ['Expenses', formatUSD(sum.expensesCents)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between px-4 py-3 text-base">
                <dt className="text-muted">{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Screen>
  )
}
