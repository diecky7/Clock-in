import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChartIcon, GearIcon, RefreshIcon, PinIcon, PlusIcon, ReceiptIcon, ShareIcon } from '../components/icons'
import { LongPressMenu, useLongPress, type MenuTarget } from '../components/LongPressMenu'
import VersionFooter from '../components/VersionFooter'
import { updateApp } from '../pwa-update'
import PersistenceNote from '../components/PersistenceNote'
import { useWeekSwipe } from '../components/useWeekSwipe'
import NewChoiceSheet from '../components/NewChoiceSheet'
import * as repo from '../data/repo'
import { formatUSD } from '../domain/money'
import { computeWeek } from '../domain/pay'
import { formatDuration, shiftMinutes } from '../domain/time'
import { today } from '../domain/today'
import type { Employer, Expense, TimeEntry } from '../domain/types'
import { addDays, weekStartOf } from '../domain/weeks'
import { biweekAnchorFor, PERIOD_WORDS, periodEnd, periodLabel, periodStart, shiftPeriod, type PeriodKind } from '../domain/periods'
import { summarizePeriod } from '../domain/summary'
import PeriodPicker from '../components/PeriodPicker'
import { navigate } from '../router'

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${SHORT_DAYS[new Date(y, m - 1, d).getDay()]} ${d}`
}

type Row =
  | { kind: 'entry'; id: string; date: string; sort: string; employer: string; hours: string }
  | { kind: 'expense'; id: string; date: string; sort: string; description: string; amount: string }

function RowButton({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const press = useLongPress(onOpen, 500)
  return (
    <button
      type="button"
      {...press}
      onClick={(e) => {
        // detail === 0 means keyboard / VoiceOver activation: no finger to hold.
        if (e.detail === 0) onOpen()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onOpen()
      }}
      className="flex min-h-14 w-full select-none items-center gap-3 px-4 text-left [-webkit-touch-callout:none]"
    >
      <span className="w-14 shrink-0 text-muted">{dayLabel(row.date)}</span>
      {row.kind === 'entry' ? (
        <>
          <span className="flex-1 truncate">{row.employer}</span>
          <span className="tabular-nums">{row.hours}</span>
        </>
      ) : (
        <>
          <span className="flex flex-1 items-center gap-2 truncate">
            <ReceiptIcon />
            <span className="truncate">{row.description}</span>
          </span>
          <span className="tabular-nums">{row.amount}</span>
        </>
      )}
    </button>
  )
}

export default function Home({ initialDate }: { initialDate?: string }) {
  const [kind, setKind] = useState<PeriodKind>('week')
  const [from, setFrom] = useState<string | null>(null)
  const [weekStartsOn, setWeekStartsOn] = useState(0)
  const [anchor, setAnchor] = useState<string | undefined>(undefined)
  const [employers, setEmployers] = useState<Employer[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [menu, setMenu] = useState<MenuTarget | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let alive = true
    void Promise.all([repo.getSettings(), repo.listEmployers()]).then(([s, emps]) => {
      if (!alive) return
      const k = s.homePeriod ?? 'week'
      const a = biweekAnchorFor(emps, s.lastEmployerId)
      setKind(k)
      setWeekStartsOn(s.weekStartsOn)
      setAnchor(a)
      setFrom(periodStart(k, initialDate ?? today(), s.weekStartsOn, a))
    })
    return () => {
      alive = false
    }
  }, [initialDate])

  const to = from ? periodEnd(kind, from) : null
  const key = from ? `${kind}:${from}` : null

  const load = useCallback(
    async (start: string, end: string, k: string) => {
      // Whole work weeks around the period, so overtime is judged on the full week.
      const wFrom = weekStartOf(start, weekStartsOn)
      const wTo = addDays(weekStartOf(end, weekStartsOn), 6)
      const [emps, ents, exps] = await Promise.all([
        repo.listEmployers(),
        repo.listEntriesBetween(wFrom, wTo),
        repo.listExpensesBetween(start, end),
      ])
      setEmployers(emps)
      setEntries(ents)
      setExpenses(exps)
      setLoadedFor(k)
    },
    [weekStartsOn],
  )

  useEffect(() => {
    if (!from || !to || !key) return
    let alive = true
    void load(from, to, key).catch(() => {
      if (alive) setLoadedFor(key)
    })
    return () => {
      alive = false
    }
  }, [from, to, key, load])

  const swipe = useWeekSwipe((dir) => setFrom((f) => (f ? shiftPeriod(kind, f, dir) : f)))

  function changeKind(k: PeriodKind) {
    if (k === kind || !from) return
    // Keep the dates in view: the new period is the one holding the first day of the old one.
    setKind(k)
    setFrom(periodStart(k, from, weekStartsOn, anchor))
    void repo.getSettings().then((s) => repo.saveSettings({ ...s, homePeriod: k }))
  }

  const summary = useMemo(
    () =>
      from && to
        ? kind === 'week'
          ? (({ totalMinutes, regularCents, overtimeCents, expensesCents, totalCents }) => ({
              minutes: totalMinutes,
              earnedCents: regularCents + overtimeCents,
              expensesCents,
              totalCents,
            }))(computeWeek({ weekStart: from, entries, expenses, employers }))
          : summarizePeriod({ from, to, weekStartsOn, entries, expenses, employers })
        : null,
    [kind, from, to, weekStartsOn, entries, expenses, employers],
  )

  // Shifts loaded for the whole weeks around the period; list only the ones inside it.
  const shown = useMemo(
    () => (from && to ? entries.filter((e) => e.start.slice(0, 10) >= from && e.start.slice(0, 10) <= to) : []),
    [entries, from, to],
  )

  const rows = useMemo<Row[]>(() => {
    const names = new Map(employers.map((e) => [e.id, e.name]))
    const list: Row[] = [
      ...shown.map<Row>((e) => ({
        kind: 'entry',
        id: e.id,
        date: e.start.slice(0, 10),
        sort: e.start,
        employer: names.get(e.employerId) ?? 'Employer',
        hours: formatDuration(shiftMinutes(e)),
      })),
      ...expenses.map<Row>((x) => ({
        kind: 'expense',
        id: x.id,
        date: x.date,
        sort: `${x.date}T99:99`,
        description: x.description,
        amount: formatUSD(x.amountCents),
      })),
    ]
    // Most recent first.
    return list.sort((a, b) => b.sort.localeCompare(a.sort))
  }, [shown, expenses, employers])

  if (!from || !to || !summary) return <main aria-label="Time clock" />

  const settled = loadedFor === key
  const words = PERIOD_WORDS[kind]
  const hoursPayCents = summary.earnedCents
  const hours = formatDuration(summary.minutes)
  const detail =
    summary.expensesCents > 0
      ? `${hours} · ${formatUSD(hoursPayCents)} + ${formatUSD(summary.expensesCents)} expenses`
      : hours

  async function remove() {
    if (!menu || !from || !to || !key) return
    if (menu.kind === 'entry') await repo.deleteEntry(menu.id)
    else await repo.deleteExpense(menu.id)
    setMenu(null)
    setConfirming(false)
    await load(from, to, key)
  }

  const closeMenu = () => {
    setMenu(null)
    setConfirming(false)
  }
  const iconBtn = 'grid size-11 place-items-center rounded-full'

  return (
    <main aria-label="Time clock" {...swipe.bind}
      className="relative mx-auto min-h-dvh max-w-md overflow-x-clip px-4 pb-28">
      <h1 className="sr-only">Time clock</h1>
      <header className="flex min-h-14 items-center justify-between">
        <div className="flex">
          <button type="button" aria-label="Settings" className={iconBtn} onClick={() => navigate('/settings')}>
            <GearIcon />
          </button>
          <button type="button" aria-label="Update app" className={`${iconBtn} text-muted`} onClick={() => void updateApp()}>
            <RefreshIcon />
          </button>
        </div>
        <div className="flex">
          <button type="button" aria-label="Summary" className={iconBtn} onClick={() => navigate('/summary')}>
            <ChartIcon />
          </button>
          <button type="button" aria-label="Places" className={iconBtn} onClick={() => navigate('/places')}>
            <PinIcon />
          </button>
          <button type="button" aria-label="Export" className={iconBtn} onClick={() => navigate(`/export?period=${kind}&from=${from}`)}>
            <ShareIcon />
          </button>
        </div>
      </header>
      <PersistenceNote />

      <div style={swipe.style} className="min-h-[60dvh]">
      <nav aria-label="Period" className="mt-2 flex items-center justify-between">
        <button type="button" aria-label={`Previous ${words.unit}`} className={`${iconBtn} text-2xl`} onClick={() => setFrom(shiftPeriod(kind, from, -1))}>
          ‹
        </button>
        <PeriodPicker kind={kind} label={periodLabel(kind, from)} onChange={changeKind} />
        <button type="button" aria-label={`Next ${words.unit}`} className={`${iconBtn} text-2xl`} onClick={() => setFrom(shiftPeriod(kind, from, 1))}>
          ›
        </button>
      </nav>

      <section aria-label="Balance" className="mt-10 text-center">
        <p className="text-6xl font-semibold tabular-nums tracking-tight">{formatUSD(summary.totalCents)}</p>
        <p className="mt-2 text-base text-muted">{detail}</p>
      </section>

      <div className="mt-10">
        {!settled ? null : rows.length === 0 ? (
          <p className="py-8 text-center text-muted">Nothing logged {words.this}</p>
        ) : (
          <ul aria-label={words.this.replace(/^t/, 'T')} className="divide-y divide-border">
            {rows.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <RowButton
                  row={r}
                  onOpen={() => {
                    setConfirming(false)
                    setMenu({ kind: r.kind, id: r.id })
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
      <VersionFooter />

      <button
        type="button"
        aria-label="New"
        onClick={() => setChoosing(true)}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 grid size-16 place-items-center rounded-full bg-accent text-accent-fg shadow-lg"
      >
        <PlusIcon />
      </button>

      {choosing && <NewChoiceSheet onClose={() => setChoosing(false)} />}
      {menu && (
        <LongPressMenu
          target={menu}
          confirming={confirming}
          onClose={closeMenu}
          onEdit={() => navigate(menu.kind === 'entry' ? `/entry/${menu.id}` : `/expense/${menu.id}`)}
          onAskDelete={() => setConfirming(true)}
          onConfirmDelete={() => void remove()}
        />
      )}
    </main>
  )
}
