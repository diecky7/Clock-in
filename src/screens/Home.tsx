import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChartIcon, GearIcon, PinIcon, PlusIcon, ReceiptIcon, ShareIcon } from '../components/icons'
import { RowMenu, type MenuTarget } from '../components/RowMenu'
import PersistenceNote from '../components/PersistenceNote'
import { useWeekSwipe } from '../components/useWeekSwipe'
import NewChoiceSheet from '../components/NewChoiceSheet'
import * as repo from '../data/repo'
import { formatUSD } from '../domain/money'
import { computeWeek } from '../domain/pay'
import { formatClock, formatDuration, shiftMinutes } from '../domain/time'
import { today } from '../domain/today'
import type { Account, Employer, Expense, Payment, TimeEntry } from '../domain/types'
import { itemStates, itemValues, toReceiveCents } from '../domain/payments'
import PaymentDialog from '../components/PaymentDialog'
import OpenDialog from '../components/OpenDialog'
import type { ListedItem } from '../components/ItemRows'
import { addDays, weekStartOf } from '../domain/weeks'
import { anchorFor, PERIOD_WORDS, periodEnd, periodLabel, periodStart, shiftPeriod, type PeriodKind } from '../domain/periods'
import { summarizePeriod } from '../domain/summary'
import PeriodPicker from '../components/PeriodPicker'
import DatePicker from '../components/DatePicker'
import Dropdown from '../components/Dropdown'
import { ALL_EMPLOYERS, SIDE_JOB_ID, activeEmployers, homeEmployerFor, isSideJob } from '../domain/employers'
import { navigate } from '../router'
import { DATA_CHANGED, offerUndo } from '../undo'

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${SHORT_DAYS[new Date(y, m - 1, d).getDay()]} ${d}`
}

type Row =
  | { kind: 'entry'; id: string; date: string; sort: string; employer: string; service?: string; hours: string; paid: PayStatus; left?: string }
  | { kind: 'expense'; id: string; date: string; sort: string; description: string; amount: string; paid: PayStatus; left?: string }

type PayStatus = 'open' | 'partial' | 'paid'

/** ✓ received, ◐ partly received; a blank of the same width keeps the numbers lined up. */
function Paid({ on, left }: { on: PayStatus; left?: string }) {
  return (
    <span className="grid w-5 shrink-0 place-items-center text-muted">
      {on === 'paid' && (
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5 6.5 11.5l6-7.5" />
        </svg>
      )}
      {on === 'partial' && (
        // Half-filled circle: part of it received.
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 1.75a6.25 6.25 0 0 0 0 12.5z" fill="currentColor" />
        </svg>
      )}
      <span className="sr-only">{on === 'paid' ? 'Received' : on === 'partial' ? `Partly received${left ? `, ${left} left` : ''}` : 'Not received'}</span>
    </span>
  )
}

/** One line of the list. Tapping it opens what can be done with it; received rows fade so what is owed stands out. */
function RowButton({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const dim = row.paid === 'paid' ? 'text-muted' : ''
  const left = row.left ? <span className="block truncate text-sm font-medium">{row.left} left</span> : null
  return (
    <button
      type="button"
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault()
        onOpen()
      }}
      className="flex min-h-14 w-full select-none items-center gap-3 px-4 text-left [-webkit-touch-callout:none]"
    >
      <span className="w-16 shrink-0 whitespace-nowrap text-muted">{dayLabel(row.date)}</span>
      {row.kind === 'entry' ? (
        <>
          <span className={`min-w-0 flex-1 ${dim}`}>
            <span className="block truncate">{row.employer}</span>
            {row.service && <span className="block truncate text-sm text-muted">{row.service}</span>}
            {left}
          </span>
          <span className={`tabular-nums ${dim}`}>{row.hours}</span>
          <Paid on={row.paid} left={row.left} />
        </>
      ) : (
        <>
          <span className={`min-w-0 flex-1 ${dim}`}>
            <span className="flex items-center gap-2">
              <ReceiptIcon />
              <span className="truncate">{row.description}</span>
            </span>
            {left}
          </span>
          <span className={`tabular-nums ${dim}`}>{row.amount}</span>
          <Paid on={row.paid} left={row.left} />
        </>
      )}
    </button>
  )
}

export default function Home({ initialDate }: { initialDate?: string }) {
  const [kind, setKind] = useState<PeriodKind>('week')
  const [from, setFrom] = useState<string | null>(null)
  const [weekStartsOn, setWeekStartsOn] = useState(0)
  const [who, setWho] = useState<string>(ALL_EMPLOYERS)
  const [lastEmployerId, setLastEmployerId] = useState<string | undefined>(undefined)
  const [defaultStart, setDefaultStart] = useState<string | undefined>(undefined)
  const [employers, setEmployers] = useState<Employer[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  // Every payment that touched the row tapped (newest first) and which one is shown.
  const [viewing, setViewing] = useState<{ list: Payment[]; i: number } | null>(null)
  const [showOpen, setShowOpen] = useState(false)
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
      setDefaultStart(s.biweeklyStart)
      setFrom(periodStart(k, initialDate ?? today(), s.weekStartsOn, anchorFor(emps, w, s.lastEmployerId, s.biweeklyStart)))
    })
    return () => {
      alive = false
    }
  }, [initialDate])

  const anchor = anchorFor(employers, who, lastEmployerId, defaultStart)
  const to = from ? periodEnd(kind, from) : null
  const key = from ? `${kind}:${from}` : null

  const load = useCallback(
    async (start: string, end: string, k: string) => {
      // Whole work weeks around the period, so overtime is judged on the full week.
      const wFrom = weekStartOf(start, weekStartsOn)
      const wTo = addDays(weekStartOf(end, weekStartsOn), 6)
      const [emps, ents, exps, pays, s] = await Promise.all([
        repo.listEmployers(),
        repo.listEntriesBetween(wFrom, wTo),
        repo.listExpensesBetween(start, end),
        repo.listPayments(),
        repo.getSettings(),
      ])
      setEmployers(emps)
      setEntries(ents)
      setExpenses(exps)
      setPayments(pays)
      setAccounts(s.accounts ?? [])
      setLoadedFor(k)
    },
    [weekStartsOn],
  )

  useEffect(() => {
    if (!from || !to || !key) return
    let alive = true
    const run = () =>
      void load(from, to, key).catch(() => {
        if (alive) setLoadedFor(key)
      })
    run()
    window.addEventListener(DATA_CHANGED, run)
    return () => {
      alive = false
      window.removeEventListener(DATA_CHANGED, run)
    }
  }, [from, to, key, load])

  const swipe = useWeekSwipe((dir) => setFrom((f) => (f ? shiftPeriod(kind, f, dir) : f)))

  function changeEmployer(w: string) {
    if (w === who) return
    setWho(w)
    if (from && kind === 'biweek') setFrom(periodStart('biweek', from, weekStartsOn, anchorFor(employers, w, lastEmployerId, defaultStart)))
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

  const values = useMemo(() => itemValues(entries, mine.expenses, employers, weekStartsOn), [entries, mine, employers, weekStartsOn])
  const states = useMemo(() => itemStates(values, payments), [values, payments])
  const status = (id: string): PayStatus => states.get(id)?.status ?? 'open'
  // What is still owed on a partly received item.
  const leftOn = (id: string) => {
    const st = states.get(id)
    return st?.status === 'partial' ? { left: formatUSD(Math.round(st.remaining)) } : {}
  }
  const toReceive = useMemo(
    () => toReceiveCents([...shown.map((e) => e.id), ...mine.expenses.map((x) => x.id)], states),
    [states, shown, mine],
  )
  // Everything still owed in the period: open items and the rest of partly received ones.
  const open = useMemo<ListedItem[]>(() => {
    const owed = (id: string) => states.get(id)?.remaining ?? 0
    const part = (id: string) => (states.get(id)?.status === 'partial' ? { of: values.get(id) } : {})
    return [
      ...shown.filter((e) => owed(e.id) > 0).map((e) => ({ kind: 'entry' as const, item: e, cents: owed(e.id), ...part(e.id) })),
      ...mine.expenses.filter((x) => owed(x.id) > 0).map((x) => ({ kind: 'expense' as const, item: x, cents: owed(x.id), ...part(x.id) })),
    ]
  }, [shown, mine, states, values])
  const paymentsOf = (id: string) => states.get(id)?.payments ?? []
  const viewPayments = (id: string) => {
    const list = paymentsOf(id)
    setViewing(list.length ? { list, i: 0 } : null)
  }

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
        ...(e.service ? { service: e.service } : {}),
        hours: formatDuration(shiftMinutes(e)),
        paid: status(e.id),
        ...leftOn(e.id),
      })),
      ...mine.expenses.map<Row>((x) => ({
        kind: 'expense',
        id: x.id,
        date: x.date,
        sort: `${x.date}T99:99`,
        description: x.description,
        amount: formatUSD(x.amountCents),
        paid: status(x.id),
        ...leftOn(x.id),
      })),
    ]
    // Most recent first.
    return list.sort((a, b) => b.sort.localeCompare(a.sort))
  }, [shown, mine, employers, who, states])

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
    if (menu.kind === 'entry') {
      const before = await repo.getEntry(menu.id)
      await repo.deleteEntry(menu.id)
      if (before) offerUndo('Entry deleted', () => repo.saveEntry(before))
    } else {
      const before = await repo.snapshotExpense(menu.id)
      await repo.deleteExpense(menu.id)
      offerUndo('Expense deleted', () => repo.restoreExpense(before))
    }
    setMenu(null)
    setConfirming(false)
    await load(from, to, key)
  }

  // The row the menu is about: what it is and where it stands, so the sheet never leaves you guessing.
  const menuRow = menu ? rows.find((r) => r.kind === menu.kind && r.id === menu.id) : undefined
  const menuSummary = menuRow && {
    title: `${dayLabel(menuRow.date)} · ${menuRow.kind === 'entry' ? menuRow.employer : menuRow.description} · ${menuRow.kind === 'entry' ? menuRow.hours : menuRow.amount}`,
    status: menuRow.paid === 'paid' ? 'Received' : menuRow.paid === 'partial' ? `Partly received · ${menuRow.left ?? ''} left` : 'Not received yet',
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

      <div style={swipe.style} className="min-h-[60dvh]">
      <div className="mt-4 flex justify-center">
        <DatePicker kind={kind} from={from} current={periodStart(kind, initialDate ?? today(), weekStartsOn, anchor)} onChange={setFrom} />
      </div>
      <section aria-label="Balance" className="mt-2 text-center">
        <p className="text-6xl font-semibold tabular-nums tracking-tight">{formatUSD(summary.totalCents)}</p>
        <p className="mt-2 text-base text-muted">{detail}</p>
        {settled && rows.length > 0 &&
          (toReceive > 0 ? (
            <button type="button" onClick={() => setShowOpen(true)} className="mx-auto mt-1 flex min-h-11 items-center gap-1 rounded-full px-3 text-base font-medium">
              To receive {formatUSD(toReceive)}
              <span aria-hidden className="text-muted">›</span>
            </button>
          ) : (
            <p className="mt-1 text-sm text-muted">All received</p>
          ))}
      </section>

      <div className="mt-10 flex items-center gap-2">
        {(activeEmployers(employers).some((e) => !isSideJob(e.id)) || who === SIDE_JOB_ID) && (
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
              buttonLabel={<span className="truncate">{who === ALL_EMPLOYERS ? 'All employers' : whoName}</span>}
            />
          </div>
        )}
        <div className="shrink-0">
          <PeriodPicker kind={kind} onChange={changeKind} />
        </div>
      </div>

      <div className="mt-2">
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

      <button
        type="button"
        aria-label="New"
        onClick={() => setChoosing(true)}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 grid size-16 place-items-center rounded-full bg-accent text-accent-fg shadow-lg"
      >
        <PlusIcon />
      </button>

      {choosing && (
        <NewChoiceSheet
          onClose={() => setChoosing(false)}
          paymentPath={`/payment/new?period=${kind}&from=${from}${who === ALL_EMPLOYERS ? '' : `&employer=${who}`}`}
        />
      )}
      {showOpen && (
        <OpenDialog
          items={open}
          toReceiveCents={toReceive}
          periodLabel={periodLabel(kind, from)}
          onClose={() => setShowOpen(false)}
          onReceive={() => {
            setShowOpen(false)
            navigate(`/payment/new?period=${kind}&from=${from}${who === ALL_EMPLOYERS ? '' : `&employer=${who}`}`)
          }}
        />
      )}
      {viewing && (
        <PaymentDialog
          key={viewing.list[viewing.i].id}
          payment={viewing.list[viewing.i]}
          account={accounts.find((a) => a.id === viewing.list[viewing.i].accountId)?.name}
          values={values}
          position={{ index: viewing.i, count: viewing.list.length }}
          onMove={(d) => setViewing((v) => (v ? { ...v, i: Math.min(v.list.length - 1, Math.max(0, v.i + d)) } : v))}
          onClose={() => setViewing(null)}
          onUndo={() => {
            const p = viewing.list[viewing.i]
            setViewing(null)
            void repo.deletePayment(p.id).then(() => {
              offerUndo('Payment undone', () => repo.savePayment(p))
              return load(from, to, key!)
            })
          }}
        />
      )}
      {menu && (
        <RowMenu
          target={menu}
          summary={menuSummary}
          confirming={confirming}
          onClose={closeMenu}
          onEdit={() => navigate(menu.kind === 'entry' ? `/entry/${menu.id}` : `/expense/${menu.id}`)}
          onAskDelete={() => setConfirming(true)}
          onViewPayment={
            paymentsOf(menu.id).length
              ? () => {
                  viewPayments(menu.id)
                  setMenu(null)
                }
              : undefined
          }
          onConfirmDelete={() => void remove()}
        />
      )}
    </main>
  )
}
