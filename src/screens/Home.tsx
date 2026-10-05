import { useCallback, useEffect, useMemo, useState } from 'react'
import { GearIcon, PlusIcon, ReceiptIcon, ShareIcon } from '../components/icons'
import { LongPressMenu, useLongPress, type MenuTarget } from '../components/LongPressMenu'
import NewChoiceSheet from '../components/NewChoiceSheet'
import * as repo from '../data/repo'
import { formatUSD } from '../domain/money'
import { computeWeek } from '../domain/pay'
import { formatHours, shiftMinutes } from '../domain/time'
import { today } from '../domain/today'
import type { Employer, Expense, TimeEntry } from '../domain/types'
import { addDays, weekLabel, weekStartOf } from '../domain/weeks'
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
          <span className="tabular-nums">{row.hours} h</span>
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
  const [weekStart, setWeekStart] = useState<string | null>(null)
  const [employers, setEmployers] = useState<Employer[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [menu, setMenu] = useState<MenuTarget | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let alive = true
    void repo.getSettings().then((s) => {
      if (alive) setWeekStart(weekStartOf(initialDate ?? today(), s.weekStartsOn))
    })
    return () => {
      alive = false
    }
  }, [initialDate])

  const load = useCallback(async (ws: string) => {
    const to = addDays(ws, 6)
    const [emps, ents, exps] = await Promise.all([
      repo.listEmployers(),
      repo.listEntriesBetween(ws, to),
      repo.listExpensesBetween(ws, to),
    ])
    setEmployers(emps)
    setEntries(ents)
    setExpenses(exps)
    setLoadedFor(ws)
  }, [])

  useEffect(() => {
    if (!weekStart) return
    let alive = true
    void load(weekStart).catch(() => {
      if (alive) setLoadedFor(weekStart)
    })
    return () => {
      alive = false
    }
  }, [weekStart, load])

  const summary = useMemo(
    () => (weekStart ? computeWeek({ weekStart, entries, expenses, employers }) : null),
    [weekStart, entries, expenses, employers],
  )

  const rows = useMemo<Row[]>(() => {
    const names = new Map(employers.map((e) => [e.id, e.name]))
    const list: Row[] = [
      ...entries.map<Row>((e) => ({
        kind: 'entry',
        id: e.id,
        date: e.start.slice(0, 10),
        sort: e.start,
        employer: names.get(e.employerId) ?? 'Employer',
        hours: formatHours(shiftMinutes(e)),
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
    return list.sort((a, b) => a.sort.localeCompare(b.sort))
  }, [entries, expenses, employers])

  if (!weekStart || !summary) return <main aria-label="Time clock" />

  const settled = loadedFor === weekStart
  const hoursPayCents = summary.regularCents + summary.overtimeCents
  const hours = `${formatHours(summary.totalMinutes)} h`
  const detail =
    summary.expensesCents > 0
      ? `${hours} · ${formatUSD(hoursPayCents)} + ${formatUSD(summary.expensesCents)} expenses`
      : hours

  async function remove() {
    if (!menu || !weekStart) return
    if (menu.kind === 'entry') await repo.deleteEntry(menu.id)
    else await repo.deleteExpense(menu.id)
    setMenu(null)
    setConfirming(false)
    await load(weekStart)
  }

  const closeMenu = () => {
    setMenu(null)
    setConfirming(false)
  }
  const iconBtn = 'grid size-11 place-items-center rounded-full'

  return (
    <main aria-label="Time clock" className="mx-auto min-h-dvh max-w-md px-4 pb-28">
      <header className="flex min-h-14 items-center justify-between">
        <button type="button" aria-label="Settings" className={iconBtn} onClick={() => navigate('/settings')}>
          <GearIcon />
        </button>
        <button type="button" aria-label="Export" className={iconBtn} onClick={() => navigate('/export')}>
          <ShareIcon />
        </button>
      </header>

      <nav aria-label="Week" className="mt-2 flex items-center justify-between">
        <button type="button" aria-label="Previous week" className={`${iconBtn} text-2xl`} onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ‹
        </button>
        <span className="text-base font-medium">{weekLabel(weekStart)}</span>
        <button type="button" aria-label="Next week" className={`${iconBtn} text-2xl`} onClick={() => setWeekStart(addDays(weekStart, 7))}>
          ›
        </button>
      </nav>

      <section aria-label="Balance" className="mt-10 text-center">
        <p className="text-6xl font-semibold tabular-nums tracking-tight">{formatUSD(summary.totalCents)}</p>
        <p className="mt-2 text-base text-muted">{detail}</p>
      </section>

      <div className="mt-10">
        {!settled ? null : rows.length === 0 ? (
          <p className="py-8 text-center text-muted">Nothing logged this week</p>
        ) : (
          <ul aria-label="This week" className="divide-y divide-border">
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
