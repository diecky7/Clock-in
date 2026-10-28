import { useEffect, useMemo, useRef, useState } from 'react'
import { PrimaryButton, Screen, Section, Switch } from '../components/ui'
import { shareOrDownload } from '../data/shareFile'
import * as repo from '../data/repo'
import { computeRange, computeWeek } from '../domain/pay'
import { today } from '../domain/today'
import type { Employer } from '../domain/types'
import { addDays, weekStartOf } from '../domain/weeks'
import { biweekAnchorFor, PERIOD_KINDS, PERIOD_WORDS, periodEnd, periodLabel, periodStart, shiftPeriod, type PeriodKind } from '../domain/periods'
import { defaultOptions, type ReportOptions } from '../export/options'
import { renderPdf } from '../export/pdf'
import { buildReportModel } from '../export/report'
import type { WeekSummary } from '../domain/pay'

const TOGGLES: { group: string; items: { key: keyof ReportOptions; label: string }[] }[] = [
  {
    group: 'Amounts',
    items: [
      { key: 'regularPay', label: 'Regular pay' },
      { key: 'overtimePay', label: 'Overtime pay' },
      { key: 'expenses', label: 'Expenses' },
      { key: 'hourlyRate', label: 'Hourly rate' },
    ],
  },
  {
    group: 'Details',
    items: [
      { key: 'addresses', label: 'Addresses' },
      { key: 'timesAndBreak', label: 'Times and break' },
    ],
  },
]

export default function Export({
  week,
  period,
  from: fromParam,
  employer: only,
}: {
  week?: string
  period?: PeriodKind
  from?: string
  /** Open with just this employer ticked (the one chosen on the home screen). */
  employer?: string
}) {
  const [kind, setKind] = useState<PeriodKind>(period ?? 'week')
  const [from, setFrom] = useState<string | null>(null)
  const [cfg, setCfg] = useState<{ weekStartsOn: number; anchor?: string } | null>(null)
  const [employers, setEmployers] = useState<Employer[]>([])
  const [summary, setSummary] = useState<WeekSummary | null>(null)
  // Nothing is remembered: every visit starts with everything on.
  const [options, setOptions] = useState<ReportOptions>({ ...defaultOptions })
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const preset = useRef(false)

  useEffect(() => {
    let alive = true
    void Promise.all([repo.getSettings(), repo.listEmployers()]).then(([s, emps]) => {
      if (!alive) return
      const anchor = biweekAnchorFor(emps, s.lastEmployerId)
      setCfg({ weekStartsOn: s.weekStartsOn, anchor })
      setFrom(periodStart(period ?? 'week', fromParam ?? week ?? today(), s.weekStartsOn, anchor))
    })
    return () => {
      alive = false
    }
  }, [week, period, fromParam])

  const to = from ? periodEnd(kind, from) : null

  useEffect(() => {
    if (!from || !to || !cfg) return
    let alive = true
    setSummary(null)
    void (async () => {
      // Whole work weeks around the period, so overtime is judged on the full week.
      const [emps, entries, expenses] = await Promise.all([
        repo.listEmployers(),
        repo.listEntriesBetween(weekStartOf(from, cfg.weekStartsOn), addDays(weekStartOf(to, cfg.weekStartsOn), 6)),
        repo.listExpensesBetween(from, to),
      ])
      if (!alive) return
      setEmployers(emps)
      if (only && !preset.current) {
        preset.current = true
        setExcluded(new Set(emps.filter((e) => e.id !== only).map((e) => e.id)))
      }
      setSummary(
        kind === 'week'
          ? computeWeek({ weekStart: from, entries, expenses, employers: emps })
          : computeRange({ from, to, weekStartsOn: cfg.weekStartsOn, entries, expenses, employers: emps }),
      )
    })()
    return () => {
      alive = false
    }
  }, [kind, from, to, cfg, only])

  function changeKind(k: PeriodKind) {
    if (k === kind || !from || !cfg) return
    setKind(k)
    setFrom(periodStart(k, from, cfg.weekStartsOn, cfg.anchor))
    setError('')
  }

  const names = useMemo(() => new Map(employers.map((e) => [e.id, e.name])), [employers])
  const rows = summary?.byEmployer ?? []
  const selected = rows.filter((r) => !excluded.has(r.employerId))

  // How many of each thing the selected employers have in this period. A toggle with nothing to show is off and locked.
  const counts = useMemo(() => {
    const shifts = selected.flatMap((r) => r.entries)
    const splits = selected.flatMap((r) => r.splits)
    const c: Record<keyof ReportOptions, number> = {
      regularPay: splits.filter((s) => s.regularMinutes > 0).length,
      overtimePay: splits.filter((s) => s.overtimeMinutes > 0).length,
      expenses: selected.reduce((n, r) => n + r.expenses.length, 0),
      hourlyRate: shifts.length,
      addresses: shifts.filter((e) => e.place?.label).length,
      timesAndBreak: shifts.length,
    }
    return c
  }, [selected])
  const on = (k: keyof ReportOptions) => options[k] && counts[k] > 0
  const effective: ReportOptions = {
    regularPay: on('regularPay'),
    overtimePay: on('overtimePay'),
    expenses: on('expenses'),
    hourlyRate: on('hourlyRate'),
    addresses: on('addresses'),
    timesAndBreak: on('timesAndBreak'),
  }

  async function share() {
    if (!from || busy) return
    if (selected.length === 0) {
      setError('Select at least one employer')
      return
    }
    setBusy(true)
    setError('')
    try {
      const models = selected.flatMap((w) => {
        const employer = employers.find((e) => e.id === w.employerId)
        return employer ? [buildReportModel(w, employer, from, effective, periodLabel(kind, from))] : []
      })
      const bytes = await renderPdf(models, repo.getPhoto)
      const file = new File([bytes as BlobPart], `time-report-${kind === 'week' ? '' : `${kind}-`}${from}.pdf`, { type: 'application/pdf' })
      await shareOrDownload(file)
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') setError("Couldn't create the PDF. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const row = 'flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 first:border-t-0'

  return (
    <Screen title="Export" back="/">
      {from && (
        <>
          <div role="group" aria-label="Report period" className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
            {PERIOD_KINDS.map((p) => (
              <button
                key={p.kind}
                type="button"
                aria-pressed={kind === p.kind}
                onClick={() => changeKind(p.kind)}
                className={`min-h-10 rounded-lg text-base font-medium ${kind === p.kind ? 'bg-accent text-accent-fg' : 'text-muted'}`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <nav aria-label="Period" className="mt-2 flex items-center justify-between">
            <button type="button" aria-label={`Previous ${PERIOD_WORDS[kind].unit}`} className="grid size-11 place-items-center rounded-full text-2xl" onClick={() => setFrom(shiftPeriod(kind, from, -1))}>
              ‹
            </button>
            <span className="text-lg font-medium">{periodLabel(kind, from)}</span>
            <button type="button" aria-label={`Next ${PERIOD_WORDS[kind].unit}`} className="grid size-11 place-items-center rounded-full text-2xl" onClick={() => setFrom(shiftPeriod(kind, from, 1))}>
              ›
            </button>
          </nav>
        </>
      )}

      {summary && rows.length === 0 ? (
        <p className="mt-8 text-center text-muted">Nothing to export for {PERIOD_WORDS[kind].this}</p>
      ) : (
        <Section title="Employers">
          {rows.map((r) => {
            const name = names.get(r.employerId) ?? 'Employer'
            return (
              <label key={r.employerId} className={`${row} cursor-pointer`}>
                <span>{name}</span>
                <input
                  type="checkbox"
                  aria-label={name}
                  className="size-6 accent-[var(--accent)]"
                  checked={!excluded.has(r.employerId)}
                  onChange={(e) =>
                    setExcluded((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.delete(r.employerId)
                      else next.add(r.employerId)
                      return next
                    })
                  }
                />
              </label>
            )
          })}
        </Section>
      )}

      {summary &&
        TOGGLES.map((g) => (
        <Section key={g.group} title={g.group === 'Amounts' ? 'Show · Amounts' : 'Show · Details'}>
          {g.items.map((t) => (
            <div key={t.key} className={row}>
              <span>
                {t.label} <span className="text-sm text-muted">({counts[t.key]})</span>
              </span>
              <Switch
                label={t.label}
                checked={effective[t.key]}
                disabled={counts[t.key] === 0}
                onChange={(v) => setOptions((o) => ({ ...o, [t.key]: v }))}
              />
            </div>
          ))}
        </Section>
      ))}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      {rows.length > 0 && (
        <div className="mt-8">
          <PrimaryButton type="button" disabled={busy} onClick={() => void share()}>
            {busy ? 'Creating PDF…' : 'Share PDF'}
          </PrimaryButton>
        </div>
      )}
    </Screen>
  )
}
