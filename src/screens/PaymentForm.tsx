import { useEffect, useMemo, useRef, useState } from 'react'
import AccountPicker, { findAccount } from '../components/AccountPicker'
import DateTimeField from '../components/DateTimeField'
import Modal from '../components/Modal'
import MoneyInput from '../components/MoneyInput'
import { PrimaryButton, Screen } from '../components/ui'
import * as repo from '../data/repo'
import { ALL_EMPLOYERS } from '../domain/employers'
import { formatUSD } from '../domain/money'
import { allocateOldestFirst, itemStates, itemValues } from '../domain/payments'
import { anchorFor, PERIOD_WORDS, periodEnd, periodLabel, periodStart, type PeriodKind } from '../domain/periods'
import { formatClock, formatDuration, shiftMinutes } from '../domain/time'
import { today } from '../domain/today'
import type { Account, Employer, Payment } from '../domain/types'
import { addDays, weekStartOf } from '../domain/weeks'
import { navigate } from '../router'
import { DATA_CHANGED, offerUndo } from '../undo'

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${SHORT_DAYS[new Date(y, m - 1, d).getDay()]} ${d}`
}

interface Item {
  kind: 'entry' | 'expense'
  id: string
  date: string
  employerId: string
  text: string
  sub?: string
  /** Still owed (exact cents). */
  cents: number
  /** Full value, when part of it was already received. */
  of?: number
}

/** Mark the period's entries and expenses as received, with what really came in and how. */
export default function PaymentForm({ period, from: fromParam, employer: only }: { period?: PeriodKind; from?: string; employer?: string }) {
  const kind: PeriodKind = period ?? 'week'
  const [from, setFrom] = useState<string | null>(null)
  const [employers, setEmployers] = useState<Employer[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [items, setItems] = useState<Item[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [date, setDate] = useState(today())
  const [received, setReceived] = useState<number | null>(null)
  const [mode, setMode] = useState<'full' | 'partial'>('full')
  // Full: the amount follows what's expected until it is typed over.
  const [amountTyped, setAmountTyped] = useState(false)
  // Bypass for Full when the amount differs from what's expected (less, or by mistake more).
  const [acceptDiff, setAcceptDiff] = useState(false)
  const [method, setMethod] = useState<'cash' | 'zelle' | null>(null)
  const [accountText, setAccountText] = useState('')
  const [accountId, setAccountId] = useState('')
  const [asking, setAsking] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ items?: string; amount?: string; accept?: string; method?: string; account?: string }>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let alive = true
    void (async () => {
      const [s, emps, payments] = await Promise.all([repo.getSettings(), repo.listEmployers(), repo.listPayments()])
      const start = periodStart(kind, fromParam ?? today(), s.weekStartsOn, anchorFor(emps, only ?? ALL_EMPLOYERS, s.lastEmployerId, s.biweeklyStart))
      const end = periodEnd(kind, start)
      const [entries, expenses] = await Promise.all([
        // Whole work weeks, so overtime is valued on the full week.
        repo.listEntriesBetween(weekStartOf(start, s.weekStartsOn), addDays(weekStartOf(end, s.weekStartsOn), 6)),
        repo.listExpensesBetween(start, end),
      ])
      const values = itemValues(entries, expenses, emps, s.weekStartsOn)
      const states = itemStates(values, payments)
      // Open and partly received items are offered, with what is still owed on them.
      const owed = (id: string) => states.get(id)?.remaining ?? values.get(id) ?? 0
      const partOf = (id: string) => (states.get(id)?.status === 'partial' ? { of: values.get(id) } : {})
      const mine = (id: string) => !only || only === ALL_EMPLOYERS || id === only
      const list: Item[] = [
        ...entries
          .filter((e) => e.start.slice(0, 10) >= start && e.start.slice(0, 10) <= end && mine(e.employerId) && owed(e.id) > 0)
          .map((e) => ({
            kind: 'entry' as const,
            id: e.id,
            date: e.start.slice(0, 10),
            employerId: e.employerId,
            text: `${formatClock(e.start.slice(11, 16))} – ${formatClock(e.end.slice(11, 16))}`,
            sub: `${formatDuration(shiftMinutes(e))}${e.service ? ` · ${e.service}` : ''}`,
            cents: owed(e.id),
            ...partOf(e.id),
          })),
        ...expenses
          .filter((x) => mine(x.employerId) && owed(x.id) > 0)
          .map((x) => ({ kind: 'expense' as const, id: x.id, date: x.date, employerId: x.employerId, text: x.description, cents: owed(x.id), ...partOf(x.id) })),
      ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'entry' ? -1 : 1))
      if (!alive) return
      setFrom(start)
      setEmployers(emps)
      setAccounts(s.accounts ?? [])
      setItems(list)
      // Usually the whole period is paid at once: everything starts ticked.
      setPicked(new Set(list.map((i) => i.id)))
    })()
    return () => {
      alive = false
    }
  }, [kind, fromParam, only])

  const expected = useMemo(() => Math.round((items ?? []).filter((i) => picked.has(i.id)).reduce((s, i) => s + i.cents, 0)), [items, picked])
  // In Full the amount is the expected one until typed over.
  const amount = mode === 'full' && !amountTyped ? expected : received
  const diff = amount === null ? null : amount - expected
  const short = diff !== null && diff < 0 ? -diff : 0
  const left = mode === 'partial' && amount !== null && amount < expected ? expected - amount : 0
  // The bypass is for one exact difference: any change to it asks again.
  useEffect(() => setAcceptDiff(false), [diff])
  const names = new Map(employers.map((e) => [e.id, e.name]))
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const i of items ?? []) m.set(i.employerId, [...(m.get(i.employerId) ?? []), i])
    return [...m.entries()]
  }, [items])

  function toggle(id: string) {
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const creating = useRef(false)
  async function createAccount(name: string): Promise<Account | null> {
    if (creating.current) return null
    creating.current = true
    try {
      const { account: a, created } = await repo.createAccount(name)
      setAccounts((all) => (all.some((x) => x.id === a.id) ? all : [...all, a]))
      setAccountText(a.name)
      setAccountId(a.id)
      setErrors((e) => ({ ...e, account: undefined }))
      if (created) offerUndo(`Account “${a.name}” created`, () => repo.deleteAccount(a.id))
      return a
    } finally {
      creating.current = false
    }
  }

  // An undo elsewhere (e.g. the "Account created" toast) may remove the chosen account.
  useEffect(() => {
    const refresh = () =>
      void repo.getSettings().then((s) => {
        const list = s.accounts ?? []
        setAccounts(list)
        setAccountId((id) => (list.some((a) => a.id === id) ? id : ''))
      })
    window.addEventListener(DATA_CHANGED, refresh)
    return () => window.removeEventListener(DATA_CHANGED, refresh)
  }, [])

  const busy = useRef(false)
  async function save(createdId?: string) {
    // One save at a time: a double tap must not log the payment twice.
    if (busy.current) return
    busy.current = true
    try {
      await trySave(createdId)
    } finally {
      busy.current = false
    }
  }

  async function trySave(createdId?: string) {
    // Checked against what is stored now, so a deleted account can never be saved.
    const stored = (await repo.getSettings()).accounts ?? []
    const want = createdId ?? (accountId || findAccount(stored, accountText)?.id || '')
    const acc = stored.some((a) => a.id === want) ? want : ''
    const next: typeof errors = {}
    if (picked.size === 0) next.items = 'Choose what was paid'
    if (amount === null || amount === 0) next.amount = 'Enter the amount received'
    else if (mode === 'partial' && amount >= expected) next.amount = 'That covers it all: choose Full'
    else if (mode === 'full' && short > 0 && !acceptDiff) next.accept = `Tick “Accept ${formatUSD(short)} less”, or choose Partial`
    else if (mode === 'full' && diff !== null && diff > 0 && !acceptDiff) next.accept = `Tick “Accept ${formatUSD(diff)} more” if that's right`
    if (!method) next.method = 'Choose how you were paid'
    if (method === 'zelle' && !acc) {
      if (accountText.trim()) {
        // A name that isn't an account yet: ask before creating it.
        setErrors(next)
        if (!next.items && !next.amount && !next.accept) setAsking(accountText.trim())
        return
      }
      next.account = 'Choose the account'
    }
    setErrors(next)
    if (Object.values(next).some(Boolean) || amount === null || !method || saving) return
    const chosen = (items ?? []).filter((i) => picked.has(i.id))
    // Full settles every chosen item; partial pays the oldest first until the money runs out.
    const allocations =
      mode === 'full'
        ? Object.fromEntries(chosen.map((i) => [i.id, i.cents]))
        : allocateOldestFirst(chosen.map((i) => ({ id: i.id, owed: i.cents })), amount)
    const touched = chosen.filter((i) => allocations[i.id] !== undefined)
    const payment: Payment = {
      id: crypto.randomUUID(),
      date,
      entryIds: touched.filter((i) => i.kind === 'entry').map((i) => i.id),
      expenseIds: touched.filter((i) => i.kind === 'expense').map((i) => i.id),
      expectedCents: expected,
      receivedCents: amount,
      method,
      ...(method === 'zelle' ? { accountId: acc } : {}),
      keepShortfall: false,
      kind: mode,
      allocations,
      createdAt: Date.now(),
    }
    setSaving(true)
    setSaveError('')
    try {
      await repo.savePayment(payment)
      offerUndo('Payment received', () => repo.deletePayment(payment.id))
      navigate('/')
    } catch {
      setSaveError("Couldn't save. Free some space on your iPhone and try again.")
    } finally {
      setSaving(false)
    }
  }

  const segBtn = (on: boolean) => `min-h-11 rounded-lg text-base font-medium ${on ? 'bg-accent text-accent-fg' : 'text-muted'}`

  return (
    <Screen title="Receive payment" back="/">
      {from && <p className="mt-1 text-base text-muted">{periodLabel(kind, from)}</p>}
      {items && items.length === 0 && <p className="mt-10 text-center text-muted">Nothing left to receive for {PERIOD_WORDS[kind].this}</p>}
      {items && items.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">What was paid</h2>
            <button
              type="button"
              className="min-h-11 px-2 text-base text-muted"
              onClick={() => setPicked(picked.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}
            >
              {picked.size === items.length ? 'Select none' : 'Select all'}
            </button>
          </div>
          {groups.map(([empId, list]) => (
            <section key={empId} aria-label={names.get(empId) ?? 'Employer'} className="mt-2 overflow-hidden rounded-b-2xl rounded-t-md bg-surface">
              {groups.length > 1 && <h3 className="bg-title px-4 py-1.5 text-base font-semibold text-title-fg">{names.get(empId) ?? 'Employer'}</h3>}
              <ul className="divide-y divide-border">
                {list.map((i) => (
                  <li key={i.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 text-base">
                      <input type="checkbox" className="size-5 shrink-0 accent-current" checked={picked.has(i.id)} onChange={() => toggle(i.id)} />
                      <span className="w-14 shrink-0 whitespace-nowrap text-muted">{dayLabel(i.date)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{i.text}</span>
                        {i.sub && <span className="block truncate text-sm text-muted">{i.sub}</span>}
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        {formatUSD(Math.round(i.cents))}
                        {i.of !== undefined && <span className="block text-sm text-muted">of {formatUSD(Math.round(i.of))}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {errors.items && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {errors.items}
            </p>
          )}
          <p className="mt-3 flex justify-between px-1 text-base">
            <span className="text-muted">Expected</span>
            <span className="font-semibold tabular-nums">{formatUSD(expected)}</span>
          </p>

          <div role="group" aria-label="Paid" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
            <button
              type="button"
              aria-pressed={mode === 'full'}
              className={segBtn(mode === 'full')}
              onClick={() => {
                setMode('full')
                setErrors((e) => ({ ...e, amount: undefined, accept: undefined }))
                // Nothing typed: back to the expected amount.
                if (received === null) setAmountTyped(false)
              }}
            >
              Full
            </button>
            <button
              type="button"
              aria-pressed={mode === 'partial'}
              className={segBtn(mode === 'partial')}
              onClick={() => {
                setMode('partial')
                setErrors((e) => ({ ...e, amount: undefined, accept: undefined }))
                // Partial starts empty: the amount is what really came in.
                if (!amountTyped) setReceived(null)
                setAmountTyped(true)
              }}
            >
              Partial
            </button>
          </div>

          <div className="mt-4">
            <label htmlFor="received" className="mb-1 block text-sm text-muted">
              Amount received
            </label>
            <MoneyInput
              id="received"
              cents={amount}
              onChange={(c) => {
                setAmountTyped(true)
                setReceived(c)
                setErrors((e) => ({ ...e, amount: undefined, accept: undefined }))
              }}
            />
            {errors.amount && (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.amount}
              </p>
            )}
          </div>
          {mode === 'full' && diff !== null && diff !== 0 && (
            <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 px-1 text-base">
              <input
                type="checkbox"
                className="size-5 shrink-0"
                checked={acceptDiff}
                onChange={(e) => {
                  setAcceptDiff(e.target.checked)
                  setErrors((er) => ({ ...er, accept: undefined }))
                }}
              />
              Accept {formatUSD(Math.abs(diff))} {diff < 0 ? 'less' : 'more'}
            </label>
          )}
          {errors.accept && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {errors.accept}
            </p>
          )}
          {mode === 'partial' && left > 0 && (
            <p className="mt-2 flex justify-between px-1 text-base">
              <span className="text-muted">Left to receive · oldest paid first</span>
              <span className="font-semibold tabular-nums">{formatUSD(left)}</span>
            </p>
          )}

          <DateTimeField type="date" label="Received on" value={date} onChange={(v) => v && setDate(v)} />

          <div className="mt-4">
            <span className="mb-1 block text-sm text-muted">Paid by</span>
            <div role="group" aria-label="Paid by" className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
              <button type="button" aria-pressed={method === 'cash'} className={segBtn(method === 'cash')} onClick={() => setMethod('cash')}>
                Cash
              </button>
              <button type="button" aria-pressed={method === 'zelle'} className={segBtn(method === 'zelle')} onClick={() => setMethod('zelle')}>
                Zelle
              </button>
            </div>
            {errors.method && (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.method}
              </p>
            )}
          </div>
          {method === 'zelle' && (
            <AccountPicker
              accounts={accounts}
              text={accountText}
              onText={(t) => {
                setAccountText(t)
                setErrors((e) => ({ ...e, account: undefined }))
              }}
              value={accountId}
              onPick={setAccountId}
              onCreate={(name) => void createAccount(name)}
              error={errors.account}
            />
          )}

          {saveError && (
            <p role="alert" className="mt-4 text-sm text-danger">
              {saveError}
            </p>
          )}
          <PrimaryButton className="mt-6 w-full" disabled={saving} onClick={() => void save()}>
            Save · {formatUSD(amount ?? 0)}
          </PrimaryButton>
        </>
      )}

      {asking && (
        <Modal label="Create account" onClose={() => setAsking(null)}>
          <p className="px-2 pt-1 text-center text-lg font-semibold">Create the account “{asking}”?</p>
          <p className="mt-1 px-2 text-center text-base text-muted">There is no account with this name yet.</p>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              className="min-h-12 rounded-full bg-accent px-4 font-semibold text-accent-fg"
              onClick={() => {
                const name = asking
                setAsking(null)
                void createAccount(name).then((a) => a && save(a.id))
              }}
            >
              Create and save
            </button>
            <button type="button" className="min-h-12 rounded-full px-4 text-muted" onClick={() => setAsking(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </Screen>
  )
}
