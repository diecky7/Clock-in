import { useEffect, useMemo, useRef, useState } from 'react'
import AccountPicker, { findAccount } from '../components/AccountPicker'
import DateTimeField from '../components/DateTimeField'
import Modal from '../components/Modal'
import MoneyInput from '../components/MoneyInput'
import { PrimaryButton, Screen } from '../components/ui'
import * as repo from '../data/repo'
import { ALL_EMPLOYERS } from '../domain/employers'
import { formatUSD } from '../domain/money'
import { itemValues, paidBy } from '../domain/payments'
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
  cents: number
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
  const [keepShortfall, setKeepShortfall] = useState(false)
  const [method, setMethod] = useState<'cash' | 'zelle' | null>(null)
  const [accountText, setAccountText] = useState('')
  const [accountId, setAccountId] = useState('')
  const [asking, setAsking] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ items?: string; amount?: string; method?: string; account?: string }>({})
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
      const paid = paidBy(payments)
      const mine = (id: string) => !only || only === ALL_EMPLOYERS || id === only
      const list: Item[] = [
        ...entries
          .filter((e) => e.start.slice(0, 10) >= start && e.start.slice(0, 10) <= end && mine(e.employerId) && !paid.has(e.id))
          .map((e) => ({
            kind: 'entry' as const,
            id: e.id,
            date: e.start.slice(0, 10),
            employerId: e.employerId,
            text: `${formatClock(e.start.slice(11, 16))} – ${formatClock(e.end.slice(11, 16))}`,
            sub: `${formatDuration(shiftMinutes(e))}${e.service ? ` · ${e.service}` : ''}`,
            cents: values.get(e.id) ?? 0,
          })),
        ...expenses
          .filter((x) => mine(x.employerId) && !paid.has(x.id))
          .map((x) => ({ kind: 'expense' as const, id: x.id, date: x.date, employerId: x.employerId, text: x.description, cents: x.amountCents })),
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
  const diff = received === null ? null : received - expected
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
    if (received === null) next.amount = 'Enter the amount received'
    if (!method) next.method = 'Choose how you were paid'
    if (method === 'zelle' && !acc) {
      if (accountText.trim()) {
        // A name that isn't an account yet: ask before creating it.
        setErrors(next)
        if (!next.items && !next.amount) setAsking(accountText.trim())
        return
      }
      next.account = 'Choose the account'
    }
    setErrors(next)
    if (Object.values(next).some(Boolean) || received === null || !method || saving) return
    const chosen = (items ?? []).filter((i) => picked.has(i.id))
    const payment: Payment = {
      id: crypto.randomUUID(),
      date,
      entryIds: chosen.filter((i) => i.kind === 'entry').map((i) => i.id),
      expenseIds: chosen.filter((i) => i.kind === 'expense').map((i) => i.id),
      expectedCents: expected,
      receivedCents: received,
      method,
      ...(method === 'zelle' ? { accountId: acc } : {}),
      keepShortfall: received < expected && keepShortfall,
      itemCents: Object.fromEntries(chosen.map((i) => [i.id, i.cents])),
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
                      <span className="shrink-0 tabular-nums">{formatUSD(Math.round(i.cents))}</span>
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

          <div className="mt-4">
            <label htmlFor="received" className="mb-1 block text-sm text-muted">
              Amount received
            </label>
            <MoneyInput id="received" cents={received} onChange={setReceived} />
            {errors.amount && (
              <p role="alert" className="mt-1 text-sm text-danger">
                {errors.amount}
              </p>
            )}
          </div>
          {diff !== null && diff !== 0 && (
            <p className={`mt-2 flex justify-between px-1 text-base ${diff < 0 ? 'text-danger' : ''}`}>
              <span>Difference</span>
              <span className="tabular-nums">
                {diff < 0 ? '−' : '+'}
                {formatUSD(Math.abs(diff))}
              </span>
            </p>
          )}
          {diff !== null && diff < 0 && (
            <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-3 px-1 text-base">
              <input type="checkbox" className="size-5 shrink-0" checked={keepShortfall} onChange={(e) => setKeepShortfall(e.target.checked)} />
              Keep {formatUSD(-diff)} as still to receive
            </label>
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
            Save · {received === null ? formatUSD(expected) : formatUSD(received)}
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
