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
import { formatClock, formatDuration, shiftMinutes } from '../domain/time'
import { today } from '../domain/today'
import type { Employer, Expense, TimeEntry } from '../domain/types'
import { addDays, weekStartOf } from '../domain/weeks'
import { biweekAnchorFor, PERIOD_WORDS, periodEnd, periodLabel, periodStart, shiftPeriod, type PeriodKind } from '../domain/periods'
import { summarizePeriod } from '../domain/summary'
import PeriodPicker from '../components/PeriodPicker'
import Dropdown from '../components/Dropdown'
import { ALL_EMPLOYERS, activeEmployers, homeEmployerFor } from '../domain/employers'
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
      <span className="w-16 shrink-0 whitespace-nowrap text-muted">{dayLabel(row.date)}</span>
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

/** Two-week pay periods: the chosen employer's own, or for all employers the usual pick. */
function anchorFor(employers: Employer[], who: string, lastEmployerId?: string): string | undefined {
  if (who === ALL_EMPLOYERS) return biweekAnchorFor(employers, lastEmployerId)
  return employers.find((e) => e.id === who)?.biweeklyStart || undefined
}

export default function Home({ initialDate }: { initialDate?: string }) {
  const [kind, setKind] = useState<PeriodKind>('week')
  const [from, setFrom] = useState<string | null>(null)
  const [weekStartsOn, setWeekStartsOn] = useState(0)
  const [who, setWho] = useState<string>(ALL_EMPLOYERS)
  const [lastEmployerId, setLastEmployerId] = useState<string | undefined>(undefined)
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
      const w = homeEmployerFor(emps, s)
      setKind(k)
      setWeekStartsOn(s.weekStartsOn)
      setEmployers(emps)
      setWho(w)
      setLastEmployerId(s.lastEmployerId)
      setFrom(periodStart(k, initialDate ?? today(), s.weekStartsOn, anchorFor(emps, w, s.lastEmployerId)))
    })
    return () => {
      alive = false
    }
  }, [initialDate])

  const anchor = anchorFor(employers, who, lastEmployerId)
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

  function changeEmployer(w: string) {
    if (w === who) return
    setWho(w)
    if (from && kind === 'biweek') setFrom(periodStart('biweek', from, weekStartsOn, anchorFor(employers, w, lastEmployerId)))
    void repo.getSettings().then((s) => repo.saveSettings({ ...s, homeEmployer: w }))
  }

  function changeKind(k: PeriodKind) {
    if (k === kind || !from) return
    // Keep the dates in view: the new period is the one holding the first day of the old one.
    setKind(k)
    setFrom(periodStart(k, from, weekStartsOn, anchor))
    void repo.getSettings().then((s) => repo.saveSettings({ ...s, homePeriod: k }))
  }

  const mine = useMemo(
    () => (who === ALL_EMPLOYERS ? { entries, expenses } : { entries: entries.filter((e) => e.employerId === who), expenses: expenses.filter((x) => x.employerId === who) }),
    [who, entries, expenses],
  )

  const summary = useMemo(
    () =>
      from && to
        ? kind === 'week'
          ? (({ totalMinutes, regularCents, overtimeCents, expensesCents, totalCents }) => ({
              minutes: totalMinutes,
              earnedCents: regularCents + overtimeCents,
              expensesCents,
              totalCents,
            }))(computeWeek({ weekStart: from, entries: mine.entries, expenses: mine.expenses, employers }))
          : summarizePeriod({ from, to, weekStartsOn, entries: mine.entries, expenses: mine.expenses, employers })
        : null,
    [kind, from, to, weekStartsOn, mine, employers],
  )

  // Shifts loaded for the whole weeks around the period; list only the ones inside it.
  const shown = useMemo(
    () => (from && to ? mine.entries.filter((e) => e.start.slice(0, 10) >= from && e.start.slice(0, 10) <= to) : []),
    [mine, from, to],
  )

  const rows = useMemo<Row[]>(() => {
    const names = new Map(employers.map((e) => [e.id, e.name]))
    const list: Row[] = [
      ...shown.map<Row>((e) => ({
        kind: 'entry',
        id: e.id,
        date: e.start.slice(0, 10),
        sort: e.start,
        // One employer chosen: its name would repeat on every row, so show the shift times instead.
        employer: who === ALL_EMPLOYERS ? (names.get(e.employerId) ?? 'Employer') : `${formatClock(e.start.slice(11, 16))} – ${formatClock(e.end.slice(11, 16))}`,
        hours: formatDuration(shiftMinutes(e)),
      })),
      ...mine.expenses.map<Row>((x) => ({
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
  }, [shown, mine, employers, who])

  if (!from || !to || !summary) return <main aria-label="Time clock" />
  const whoName = who === ALL_EMPLOYERS ? 'All employers' : (employers.find((e) => e.id === who)?.name ?? 'Employer')

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
  const pill = 'bg-surface px-3.5 text-base font-semibold'

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
          <button type="button" aria-label="Export" className={iconBtn} onClick={() => navigate(`/export?period=${kind}&from=${from}${who === ALL_EMPLOYERS ? '' : `&employer=${who}`}`)}>
            <ShareIcon />
          </button>
        </div>
      </header>
      <PersistenceNote />

      <div className="mt-2 flex items-center gap-2">
        {activeEmployers(employers).length > 0 && (
          <div className="min-w-0 shrink">
            <Dropdown
              value={who}
              options={[
                { value: ALL_EMPLOYERS, label: 'All employers' },
                ...activeEmployers(employers).map((e) => ({ value: e.id, label: e.name })),
              ]}
              onChange={changeEmployer}
              ariaLabel={`Employer: ${whoName}, change`}
              menuLabel="Employer"
              className={pill}
              buttonLabel={<span className="truncate">{who === ALL_EMPLOYERS ? 'All' : whoName}</span>}
            />
          </div>
        )}
        <div className="shrink-0">
          <PeriodPicker kind={kind} label={periodLabel(kind, from)} onChange={changeKind} className={pill} />
        </div>
        <nav aria-label="Period" className="ml-auto flex shrink-0 rounded-full bg-surface">
          <button type="button" aria-label={`Previous ${words.unit}`} className="grid size-11 place-items-center rounded-full text-2xl" onClick={() => setFrom(shiftPeriod(kind, from, -1))}>
            ‹
          </button>
          <button type="button" aria-label={`Next ${words.unit}`} className="grid size-11 place-items-center rounded-full text-2xl" onClick={() => setFrom(shiftPeriod(kind, from, 1))}>
            ›
          </button>
        </nav>
      </div>

      <div style={swipe.style} className="min-h-[60dvh]">
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
