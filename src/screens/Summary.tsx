import { useEffect, useMemo, useState } from 'react'
import { Screen, Section } from '../components/ui'
import { useWeekSwipe } from '../components/useWeekSwipe'
import * as repo from '../data/repo'
import { formatUSD } from '../domain/money'
import { formatHours } from '../domain/time'
import { today } from '../domain/today'
import { monthRange, summarizePeriod, yearRange, type PeriodSummary } from '../domain/summary'
import type { Employer, Expense, TimeEntry } from '../domain/types'
import { addDays, weekLabel, weekStartOf } from '../domain/weeks'

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Summary() {
  const [weekStartsOn, setWeekStartsOn] = useState<number | null>(null)
  const [weekStart, setWeekStart] = useState<string | null>(null)
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

  // The week drives everything: the month and year are the ones the week mostly falls in (its middle day).
  const anchor = weekStart ? addDays(weekStart, 3) : null
  const periods = useMemo(() => {
    if (!weekStart || !anchor || !data || weekStartsOn === null) return null
    const calc = (r: [string, string]): PeriodSummary => summarizePeriod({ from: r[0], to: r[1], weekStartsOn, ...data })
    return [
      { name: 'Weekly', note: '', sum: calc([weekStart, addDays(weekStart, 6)]) },
      { name: 'Monthly', note: MONTH[Number(anchor.slice(5, 7)) - 1], sum: calc(monthRange(anchor)) },
      { name: 'Yearly', note: anchor.slice(0, 4), sum: calc(yearRange(anchor)) },
    ]
  }, [weekStart, anchor, data, weekStartsOn])

  const swipe = useWeekSwipe((dir) => setWeekStart((w) => (w ? addDays(w, dir * 7) : w)))
  const iconBtn = 'grid size-11 place-items-center rounded-full text-2xl'

  const cards: [string, (s: PeriodSummary) => string][] = [
    ['Total', (s) => formatUSD(s.totalCents)],
    ['Hours', (s) => `${formatHours(s.minutes)} h`],
    ['Overtime', (s) => `${formatHours(s.overtimeMinutes)} h`],
    ['Earnings', (s) => formatUSD(s.earnedCents)],
    ['Expenses', (s) => formatUSD(s.expensesCents)],
  ]

  return (
    <Screen title="Summary" back="/" swipe={swipe}>
      {weekStart && periods && (
        <>
          <nav aria-label="Week" className="flex items-center justify-between">
            <button type="button" aria-label="Previous week" className={iconBtn} onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ‹
            </button>
            <span className="text-base font-medium">{weekLabel(weekStart)}</span>
            <button type="button" aria-label="Next week" className={iconBtn} onClick={() => setWeekStart(addDays(weekStart, 7))}>
              ›
            </button>
          </nav>

          {cards.map(([title, fmt]) => (
            <Section key={title} title={title} compact>
              <dl className="divide-y divide-border">
                {periods.map((p) => (
                  <div key={p.name} className="flex min-h-9 items-center justify-between gap-3 px-4 text-base">
                    <dt>
                      {p.name}
                      {p.note && <span className="text-muted"> · {p.note}</span>}
                    </dt>
                    <dd className="tabular-nums">{fmt(p.sum)}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          ))}
        </>
      )}
    </Screen>
  )
}
