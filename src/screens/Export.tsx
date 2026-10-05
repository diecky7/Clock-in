import { useEffect, useMemo, useState } from 'react'
import { PrimaryButton, Screen, Section, Switch } from '../components/ui'
import * as repo from '../data/repo'
import { computeWeek } from '../domain/pay'
import { today } from '../domain/today'
import type { Employer } from '../domain/types'
import { addDays, weekLabel, weekStartOf } from '../domain/weeks'
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

export default function Export({ week }: { week?: string }) {
  const [weekStart, setWeekStart] = useState<string | null>(week ?? null)
  const [employers, setEmployers] = useState<Employer[]>([])
  const [summary, setSummary] = useState<WeekSummary | null>(null)
  // Nothing is remembered: every visit starts with everything on.
  const [options, setOptions] = useState<ReportOptions>({ ...defaultOptions })
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void (async () => {
      const ws = week ?? weekStartOf(today(), (await repo.getSettings()).weekStartsOn)
      const to = addDays(ws, 6)
      const [emps, entries, expenses] = await Promise.all([
        repo.listEmployers(),
        repo.listEntriesBetween(ws, to),
        repo.listExpensesBetween(ws, to),
      ])
      if (!alive) return
      setWeekStart(ws)
      setEmployers(emps)
      setSummary(computeWeek({ weekStart: ws, entries, expenses, employers: emps }))
    })()
    return () => {
      alive = false
    }
  }, [week])

  const names = useMemo(() => new Map(employers.map((e) => [e.id, e.name])), [employers])
  const rows = summary?.byEmployer ?? []
  const selected = rows.filter((r) => !excluded.has(r.employerId))

  async function share() {
    if (!weekStart || selected.length === 0 || busy) return
    setBusy(true)
    setError('')
    try {
      const models = selected.flatMap((w) => {
        const employer = employers.find((e) => e.id === w.employerId)
        return employer ? [buildReportModel(w, employer, weekStart, options)] : []
      })
      const bytes = await renderPdf(models, repo.getPhoto)
      const file = new File([bytes as BlobPart], `time-report-${weekStart}.pdf`, { type: 'application/pdf' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') setError("Couldn't create the PDF. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const row = 'flex min-h-14 items-center justify-between gap-3 border-t border-border px-4 first:border-t-0'

  return (
    <Screen title="Export week" back="/">
      {weekStart && <p className="text-lg font-medium">{weekLabel(weekStart)}</p>}

      {summary && rows.length === 0 ? (
        <p className="mt-8 text-center text-muted">Nothing to export for this week</p>
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

      {TOGGLES.map((g) => (
        <Section key={g.group} title={g.group === 'Amounts' ? 'Show · Amounts' : 'Show · Details'}>
          {g.items.map((t) => (
            <div key={t.key} className={row}>
              <span>{t.label}</span>
              <Switch label={t.label} checked={options[t.key]} onChange={(v) => setOptions((o) => ({ ...o, [t.key]: v }))} />
            </div>
          ))}
        </Section>
      ))}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-8">
        <PrimaryButton type="button" disabled={busy || selected.length === 0} onClick={() => void share()}>
          {busy ? 'Creating PDF…' : 'Share PDF'}
        </PrimaryButton>
      </div>
    </Screen>
  )
}
