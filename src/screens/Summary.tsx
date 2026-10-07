import { useEffect, useState } from 'react'
import { Screen } from '../components/ui'
import * as repo from '../data/repo'
import { formatUSD } from '../domain/money'
import { addDays } from '../domain/weeks'
import { formatHours } from '../domain/time'
import { today } from '../domain/today'
import { monthRange, summarizePeriod, yearRange, type PeriodSummary } from '../domain/summary'
import { weekStartOf } from '../domain/weeks'

interface Period {
  title: string
  range: string
  sum: PeriodSummary
}

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Summary() {
  const [periods, setPeriods] = useState<Period[] | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      const now = today()
      const settings = await repo.getSettings()
      const ws = weekStartOf(now, settings.weekStartsOn)
      const ranges: [string, string, string][] = [
        ['This week', `${ws} – ${addDays(ws, 6)}`, ws],
        ['This month', `${MONTH[Number(now.slice(5, 7)) - 1]} ${now.slice(0, 4)}`, ''],
        ['This year', now.slice(0, 4), ''],
      ]
      const bounds: [string, string][] = [[ws, addDays(ws, 6)], monthRange(now), yearRange(now)]
      const from = bounds.reduce((a, b) => (a < b[0] ? a : b[0]), bounds[0][0])
      const to = bounds.reduce((a, b) => (a > b[1] ? a : b[1]), bounds[0][1])
      const [employers, entries, expenses] = await Promise.all([
        repo.listEmployers(),
        repo.listEntriesBetween(from, to),
        repo.listExpensesBetween(from, to),
      ])
      const list = ranges.map(([title, range], i) => ({
        title,
        range: i === 0 ? `${bounds[0][0]} to ${bounds[0][1]}` : range,
        sum: summarizePeriod({ from: bounds[i][0], to: bounds[i][1], weekStartsOn: settings.weekStartsOn, entries, expenses, employers }),
      }))
      if (alive) setPeriods(list)
    })().catch(() => alive && setPeriods([]))
    return () => {
      alive = false
    }
  }, [])

  return (
    <Screen title="Summary" back="/">
      {periods?.map((p) => (
        <section key={p.title} aria-label={p.title} className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
            {p.title} <span className="normal-case tracking-normal">· {p.range}</span>
          </h2>
          <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{formatUSD(p.sum.totalCents)}</p>
          <dl className="mt-2 divide-y divide-border overflow-hidden rounded-2xl bg-surface">
            {(
              [
                ['Hours', `${formatHours(p.sum.minutes)} h`],
                ['Overtime', `${formatHours(p.sum.overtimeMinutes)} h`],
                ['Earnings', formatUSD(p.sum.earnedCents)],
                ['Expenses', formatUSD(p.sum.expensesCents)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between px-3 py-2.5 text-sm">
                <dt className="text-muted">{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Screen>
  )
}
