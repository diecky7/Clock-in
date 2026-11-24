import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import { itemStates, itemValues, toReceiveCents } from '../domain/payments'
import { summarizePeriod } from '../domain/summary'
import Home from '../screens/Home'
import UndoToast from './UndoToast'
import { dismissUndo, runUndo } from '../undo'
import MarkReceivedDialog from './MarkReceivedDialog'

beforeEach(async () => {
  await resetDbForTests()
  dismissUndo()
})

const shift = (id: string, employerId: string, d: string, from: string, to: string, rateCents: number, extra = {}) =>
  repo.saveEntry({ id, employerId, start: `${d}T${from}`, end: `${d}T${to}`, breakMin: 30, rateCents, ...extra })

/** Like the owner's data: Sunday weeks, overtime weeks, a side job, an archived employer, expenses, earlier payments. */
async function seed() {
  await repo.saveEmployer({ id: 'shark', name: 'Shark construction', overtimeEnabled: true, archived: false, rates: [{ from: '2026-01-01', cents: 2600 }] })
  await repo.saveEmployer({ id: 'old', name: 'Old boss', overtimeEnabled: true, archived: true, rates: [{ from: '2026-01-01', cents: 2500 }] })
  await repo.saveSettings({ ...(await repo.getSettings()), weekStartsOn: 0, biweeklyStart: '2026-11-08', homeEmployer: 'all', homePeriod: 'week' })
  // Oct 18 – Nov 21, Mon–Sat 9.5 h a day: 57 h a week, so overtime every week.
  const days: string[] = []
  for (let t = Date.UTC(2026, 9, 19); t <= Date.UTC(2026, 10, 21); t += 86400000) {
    const d = new Date(t)
    if (d.getUTCDay() !== 0) days.push(d.toISOString().slice(0, 10))
  }
  for (const d of days) await shift(`s-${d}`, 'shark', d, '07:00', '17:00', 2600)
  await shift('old-1', 'old', '2026-10-20', '17:30', '19:30', 2500)
  await shift('side-1', 'side-job', '2026-11-07', '08:00', '12:00', 4500, { service: 'Paint door' })
  await shift('side-2', 'side-job', '2026-11-14', '08:00', '12:00', 4500)
  await repo.saveExpense({ id: 'x-oct', employerId: 'shark', date: '2026-10-28', description: 'Rollers', amountCents: 4250, photoIds: [] })
  await repo.saveExpense({ id: 'x-nov', employerId: 'shark', date: '2026-11-10', description: 'Tape', amountCents: 1299, photoIds: [] })
  // Already received before: one full week, and one shift paid in part.
  await repo.savePayment({ id: 'p-full', date: '2026-10-30', entryIds: ['s-2026-10-19', 's-2026-10-20'], expenseIds: [], expectedCents: 49400,
    receivedCents: 49400, method: 'cash', keepShortfall: false, kind: 'full', allocations: { 's-2026-10-19': 24700, 's-2026-10-20': 24700 }, createdAt: 1 })
  await repo.savePayment({ id: 'p-part', date: '2026-11-02', entryIds: ['s-2026-11-02'], expenseIds: [], expectedCents: 24700,
    receivedCents: 10000, method: 'cash', keepShortfall: false, kind: 'partial', allocations: { 's-2026-11-02': 10000 }, createdAt: 2 })
}

async function owedBetween(from: string, to: string) {
  const [entries, expenses, employers, payments, s] = await Promise.all([
    repo.listEntriesBetween('2026-01-01', '2026-12-31'), repo.listExpensesBetween('2026-01-01', '2026-12-31'),
    repo.listEmployers(), repo.listPayments(), repo.getSettings(),
  ])
  const values = itemValues(entries, expenses, employers, s.weekStartsOn)
  const ids = [...entries.filter((e) => e.start.slice(0, 10) >= from && e.start.slice(0, 10) <= to), ...expenses.filter((x) => x.date >= from && x.date <= to)].map((i) => i.id)
  const total = summarizePeriod({ from, to, weekStartsOn: 0, entries, expenses, employers })
  return { owed: toReceiveCents(ids, itemStates(values, payments)), total: total.totalCents }
}

it('marks everything before Nov 8 as received and nothing from Nov 8 on; totals never change; undo puts it back', async () => {
  await seed()
  const before = await owedBetween('2026-10-01', '2026-11-07')
  const after = await owedBetween('2026-11-08', '2026-11-30')
  expect(before.owed).toBeGreaterThan(0)

  const user = userEvent.setup()
  render(<><MarkReceivedDialog onClose={() => undefined} /><UndoToast /></>)
  // Default: the latest two weeks with data start Nov 8 (the biweekly default).
  expect(await screen.findByText('Sun, Nov 8, 2026')).toBeInTheDocument()
  const summary = await screen.findByText(/will count as received\./)
  // 18 Shark days − 2 fully paid + old boss + side job = 18 entries; 1 expense.
  expect(summary).toHaveTextContent('18 entries and 1 expense before Sun, Nov 8')
  expect(summary).toHaveTextContent(`worth $${(before.owed / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
  await user.click(screen.getByRole('button', { name: 'Mark as received' }))
  await waitFor(async () => expect(await repo.listPayments()).toHaveLength(3))

  expect((await owedBetween('2026-10-01', '2026-11-07')).owed).toBe(0)
  expect(await owedBetween('2026-11-08', '2026-11-30')).toEqual(after)
  // What was earned is untouched; only what is owed changed.
  expect((await owedBetween('2026-10-01', '2026-11-07')).total).toBe(before.total)

  expect(await runUndo()).toBe(true)
  expect(await owedBetween('2026-10-01', '2026-11-07')).toEqual(before)
})

it('a double tap saves it once', async () => {
  await seed()
  render(<MarkReceivedDialog onClose={() => undefined} />)
  await screen.findByText(/will count as received\./)
  const btn = screen.getByRole('button', { name: 'Mark as received' })
  btn.click()
  btn.click()
  await waitFor(async () => expect(await repo.listPayments()).toHaveLength(3))
  await new Promise((r) => setTimeout(r, 200))
  expect(await repo.listPayments()).toHaveLength(3)
})

it('Home after marking: old weeks all ✓, the week of Nov 9 untouched', async () => {
  await seed()
  const u = await repo.unpaidBefore('2026-11-08')
  const cents = Math.round(Object.values(u.itemCents).reduce((a, b) => a + b, 0))
  await repo.savePayment({ id: 'm', date: '2026-11-24', entryIds: u.entries.map((e) => e.id), expenseIds: u.expenses.map((x) => x.id),
    expectedCents: cents, receivedCents: cents, method: 'marked', keepShortfall: false, kind: 'full', allocations: u.itemCents, createdAt: 3 })

  const first = render(<Home initialDate="2026-11-04" />)
  expect(await screen.findByText('All received')).toBeInTheDocument()
  const rows = within(screen.getByRole('list', { name: 'This week' })).getAllByRole('button')
  expect(rows.every((r) => r.textContent?.endsWith('Received'))).toBe(true)
  first.unmount()

  render(<Home initialDate="2026-11-10" />)
  expect(await screen.findByText(/^To receive \$/)).toBeInTheDocument()
  const now = within(screen.getByRole('list', { name: 'This week' })).getAllByRole('button')
  expect(now.some((r) => r.textContent?.includes('eceived'))).toBe(false)
})
