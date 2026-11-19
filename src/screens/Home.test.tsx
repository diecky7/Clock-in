import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import type { Employer, Expense, TimeEntry } from '../domain/types'
import Home from './Home'
import UndoToast from '../components/UndoToast'
import { dismissUndo } from '../undo'

const acme: Employer = { id: 'e1', name: 'Acme', overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 3000 }] }

function shift(id: string, day: string, out: string, rateCents: number): TimeEntry {
  return { id, employerId: 'e1', start: `2026-10-${day}T07:00`, end: `2026-10-${day}T${out}`, breakMin: 0, rateCents }
}
const expense: Expense = { id: 'x1', employerId: 'e1', date: '2026-10-07', description: 'Paint rollers', amountCents: 17550, photoIds: [] }

async function seed(withExpense = true) {
  await repo.saveEmployer(acme)
  // 17.25 h at $30 + 21.25 h at $34 = 38.5 h, $1,240.00
  for (const e of [
    shift('t1', '05', '15:00', 3000),
    shift('t2', '06', '16:15', 3000),
    shift('t3', '07', '15:00', 3400),
    shift('t4', '08', '15:00', 3400),
    shift('t5', '09', '12:15', 3400),
  ])
    await repo.saveEntry(e)
  if (withExpense) await repo.saveExpense(expense)
}

beforeEach(async () => {
  await resetDbForTests()
  window.location.hash = ''
  dismissUndo()
})

describe('Home', () => {
  it('shows balance and the hours + expenses detail line', async () => {
    await seed()
    render(<Home initialDate="2026-10-07" />)
    expect(await screen.findByText('$1,415.50')).toBeInTheDocument()
    expect(screen.getByText('38h 30m · $1,240.00 + $175.50 expenses')).toBeInTheDocument()
    expect(screen.getByText('Oct 4 – 10')).toBeInTheDocument()
  })

  it('detail line is hours only without expenses', async () => {
    await seed(false)
    render(<Home initialDate="2026-10-07" />)
    expect(await screen.findByText('$1,240.00')).toBeInTheDocument()
    expect(screen.getByText('38h 30m')).toBeInTheDocument()
  })

  it('week buttons change the label; a future empty week shows empty state', async () => {
    await seed()
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-07" />)
    await screen.findByText('$1,415.50')
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(await screen.findByText('Oct 11 – 17')).toBeInTheDocument()
    expect(await screen.findByText('$0.00')).toBeInTheDocument()
    expect(screen.getByText('Nothing logged this week')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(await screen.findByText('$1,415.50')).toBeInTheDocument()
  })

  it('lists entries and expenses as rows', async () => {
    await seed()
    render(<Home initialDate="2026-10-07" />)
    const list = await screen.findByRole('list', { name: 'This week' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(6)
    expect(within(list).getByText('Paint rollers')).toBeInTheDocument()
    expect(within(list).getByText('$175.50')).toBeInTheDocument()
  })

  it('lists the most recent first', async () => {
    await seed(false)
    render(<Home initialDate="2026-10-07" />)
    const list = await screen.findByRole('list', { name: 'This week' })
    const days = within(list).getAllByRole('listitem').map((li) => li.querySelector('span')?.textContent)
    expect(days).toEqual(['Fri 9', 'Thu 8', 'Wed 7', 'Tue 6', 'Mon 5'])
  })

  it('dragging more than half of the screen width changes the week; less springs back', async () => {
    await seed()
    render(<Home initialDate="2026-10-07" />)
    await screen.findByRole('list', { name: 'This week' })
    const zone = screen.getByRole('main', { name: 'Time clock' })
    const drag = (from: number, to: number) => {
      fireEvent.pointerDown(zone, { pointerId: 1, isPrimary: true, clientX: from, clientY: 300 })
      fireEvent.pointerMove(zone, { pointerId: 1, isPrimary: true, clientX: to, clientY: 300 })
      fireEvent.pointerUp(zone, { pointerId: 1, isPrimary: true, clientX: to, clientY: 300 })
    }
    drag(600, 150) // 450 px of a 1024 px page: not enough
    await new Promise((r) => setTimeout(r, 300))
    expect(screen.getByText('Oct 4 – 10')).toBeInTheDocument()
    drag(900, 300) // left, over half the width: next week
    expect(await screen.findByText('Oct 11 – 17')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 500))
    drag(50, 700) // right: back
    expect(await screen.findByText('Oct 4 – 10')).toBeInTheDocument()
  })

  it('the date bar switches to two weeks or a month, and remembers it', async () => {
    await seed()
    await repo.saveEntry(shift('t9', '20', '15:00', 3400)) // Oct 20, a later week
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-07" />)
    await screen.findByText('$1,415.50')
    await user.click(screen.getByRole('button', { name: 'Oct 4 – 10, change period' }))
    await user.click(screen.getByRole('button', { name: /Monthly/ }))
    expect(await screen.findByRole('button', { name: 'October 2026, change period' })).toBeInTheDocument()
    expect(await screen.findByText('$1,687.50')).toBeInTheDocument() // + 8 h at $34
    expect(within(screen.getByRole('list', { name: 'This month' })).getAllByRole('listitem')).toHaveLength(7)
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await screen.findByText('Nothing logged this month')).toBeInTheDocument()
    expect((await repo.getSettings()).homePeriod).toBe('month')

    await user.click(screen.getByRole('button', { name: 'September 2026, change period' }))
    await user.click(screen.getByRole('button', { name: /Biweekly/ }))
    expect(await screen.findByRole('button', { name: 'Aug 23 – Sep 5, change period' })).toBeInTheDocument()
  })

  it('two weeks follow the employer pay period start', async () => {
    await repo.saveEmployer({ ...acme, biweeklyStart: '2026-10-01' })
    await repo.saveSettings({ ...(await repo.getSettings()), homePeriod: 'biweek' })
    render(<Home initialDate="2026-10-07" />)
    expect(await screen.findByRole('button', { name: 'Oct 1 – 14, change period' })).toBeInTheDocument()
  })

  it('the employer menu shows one employer or all, opens on the last used, and remembers the choice', async () => {
    await seed()
    await repo.saveEmployer({ ...acme, id: 'e2', name: 'Bay', rates: [{ from: '2026-01-01', cents: 2000 }] })
    await repo.saveEntry({ id: 'b1', employerId: 'e2', start: '2026-10-06T07:00', end: '2026-10-06T12:00', breakMin: 0, rateCents: 2000 })
    await repo.rememberEmployer('e2')
    const user = userEvent.setup()
    const { unmount } = render(<Home initialDate="2026-10-07" />)
    // Opens on Bay, the one used last: only its 5 h at $20.
    expect(await screen.findByRole('button', { name: 'Employer: Bay, change' })).toBeInTheDocument()
    expect(await screen.findByText('$100.00')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'This week' })).getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Employer: Bay, change' }))
    await user.click(screen.getByRole('button', { name: 'All employers' }))
    expect(await screen.findByText('$1,515.50')).toBeInTheDocument() // $1,415.50 + $100
    await waitFor(async () => expect((await repo.getSettings()).homeEmployer).toBe('all'))

    await user.click(screen.getByRole('button', { name: 'Employer: All employers, change' }))
    await user.click(screen.getByRole('button', { name: 'Acme' }))
    expect(await screen.findByText('$1,415.50')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(window.location.hash).toBe('#/export?period=week&from=2026-10-04&employer=e1')
    unmount()

    render(<Home initialDate="2026-10-07" />)
    expect(await screen.findByRole('button', { name: 'Employer: Acme, change' })).toBeInTheDocument()
  })

  it('the default two-week period from Settings is used, and an employer with its own date keeps it', async () => {
    await seed()
    await repo.saveEmployer({ ...acme, id: 'e2', name: 'Bay', biweeklyStart: '2026-10-08' })
    await repo.saveSettings({ ...(await repo.getSettings()), homePeriod: 'biweek', homeEmployer: 'e1', biweeklyStart: '2026-10-01' })
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-20" />)
    expect(await screen.findByRole('button', { name: 'Oct 15 – 28, change period' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Employer:/ }))
    await user.click(screen.getByRole('button', { name: 'All employers' }))
    expect(await screen.findByRole('button', { name: 'Oct 15 – 28, change period' })).toBeInTheDocument()
  })

  it('holding a row opens Edit/Delete; Delete asks to confirm and removes the row', async () => {
    await seed(false)
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-07" />)
    const list = await screen.findByRole('list', { name: 'This week' })
    const row = within(list).getAllByRole('button').at(-1)!
    fireEvent.pointerDown(row)
    await new Promise((r) => setTimeout(r, 560))
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete this entry?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'This week' })).getAllByRole('listitem')).toHaveLength(4))
    expect(await repo.getEntry('t1')).toBeUndefined()
  })

  it('shows what is still to receive, marks received rows, and a received row opens its payment to undo it', async () => {
    await seed()
    // t1 ($240) and the expense ($175.50) received; $20 short, kept as owed.
    await repo.savePayment({ id: 'p1', date: '2026-10-09', entryIds: ['t1'], expenseIds: ['x1'], expectedCents: 41550, receivedCents: 39550,
      method: 'zelle', accountId: 'a1', keepShortfall: true, createdAt: 1 })
    await repo.saveSettings({ ...(await repo.getSettings()), accounts: [{ id: 'a1', name: 'Santander' }] })
    const user = userEvent.setup()
    render(<><Home initialDate="2026-10-07" /><UndoToast /></>)
    expect(await screen.findByText('$1,415.50')).toBeInTheDocument() // the total is unchanged
    expect(await screen.findByText('To receive $1,020.00')).toBeInTheDocument() // $1,415.50 − $415.50 + $20.00
    const list = screen.getByRole('list', { name: 'This week' })
    // An older payment that kept the rest as owed reads as partial.
    const received = within(list).getAllByRole('button').filter((b) => b.textContent?.includes('Partly received'))
    expect(received).toHaveLength(2)

    await user.click(received[0])
    const dialog = await screen.findByRole('dialog', { name: 'Payment received' })
    expect(dialog).toHaveTextContent('Zelle · Santander')
    expect(dialog).toHaveTextContent('Left after this$20.00')
    await user.click(within(dialog).getByRole('button', { name: 'Undo payment' }))
    expect(await screen.findByText('To receive $1,415.50')).toBeInTheDocument()
    expect(await repo.listPayments()).toEqual([])

    // The toast puts it back.
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('To receive $1,020.00')).toBeInTheDocument()
    expect(await repo.listPayments()).toHaveLength(1)
  })

  it('holding a received row opens only the menu, which offers View payment', async () => {
    await seed(false)
    await repo.savePayment({ id: 'p1', date: '2026-10-09', entryIds: ['t1'], expenseIds: [], expectedCents: 24000, receivedCents: 24000,
      method: 'cash', keepShortfall: false, createdAt: 1 })
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-07" />)
    const list = await screen.findByRole('list', { name: 'This week' })
    const row = within(list).getAllByRole('button').find((b) => b.textContent?.includes('Received'))!
    fireEvent.pointerDown(row)
    await new Promise((r) => setTimeout(r, 560))
    fireEvent.pointerUp(row)
    fireEvent.click(row, { detail: 1 })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'View payment' }))
    expect(await screen.findByRole('dialog', { name: 'Payment received' })).toBeInTheDocument()
  })

  it('tapping an open row lists what is still open; a received payment lists what it paid for', async () => {
    await seed()
    await repo.savePayment({ id: 'p1', date: '2026-10-09', entryIds: ['t1'], expenseIds: [], expectedCents: 24000, receivedCents: 24000,
      method: 'cash', keepShortfall: false, itemCents: { t1: 24000 }, createdAt: 1 })
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-07" />)
    const list = await screen.findByRole('list', { name: 'This week' })
    const buttons = within(list).getAllByRole('button')
    await user.click(buttons.find((b) => !b.textContent?.includes('Received'))!)
    const open = await screen.findByRole('dialog', { name: 'Still to receive' })
    expect(within(open).getByText('$1,175.50')).toBeInTheDocument()
    expect(within(within(open).getByRole('list', { name: 'Open' })).getAllByRole('listitem')).toHaveLength(5) // 4 shifts + expense
    await user.click(within(open).getByRole('button', { name: 'Close' }))

    await user.click(buttons.find((b) => b.textContent?.includes('Received'))!)
    const paidFor = await screen.findByRole('list', { name: 'Paid for' })
    expect(within(paidFor).getAllByRole('listitem')).toHaveLength(1)
    expect(paidFor).toHaveTextContent('7:00 AM – 3:00 PM')
    expect(paidFor).toHaveTextContent('$240.00')
  })

  it('a partial payment marks the oldest rows: ✓ paid, ◐ partly, and the payment shows what each got', async () => {
    await seed(false)
    // $300 over Mon ($240) and Tue ($277.50): Mon paid, Tue gets $60.
    await repo.savePayment({ id: 'p1', date: '2026-10-09', entryIds: ['t1', 't2'], expenseIds: [], expectedCents: 51750, receivedCents: 30000,
      method: 'cash', keepShortfall: false, kind: 'partial', allocations: { t1: 24000, t2: 6000 }, createdAt: 1 })
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-07" />)
    expect(await screen.findByText('To receive $940.00')).toBeInTheDocument() // $1,240 − $300
    const list = screen.getByRole('list', { name: 'This week' })
    const rows = within(list).getAllByRole('button')
    expect(rows.filter((b) => b.textContent?.endsWith('Received'))).toHaveLength(1)
    const partly = rows.find((b) => b.textContent?.includes('Partly received'))!
    await user.click(partly)
    const paidFor = await screen.findByRole('list', { name: 'Paid for' })
    expect(paidFor).toHaveTextContent('$60.00of $277.50')
  })

  it('a row paid in two goes shows both payments', async () => {
    await seed(false)
    await repo.savePayment({ id: 'a', date: '2026-10-08', entryIds: ['t1'], expenseIds: [], expectedCents: 24000, receivedCents: 10000,
      method: 'cash', keepShortfall: false, kind: 'partial', allocations: { t1: 10000 }, createdAt: 1 })
    await repo.savePayment({ id: 'b', date: '2026-10-09', entryIds: ['t1'], expenseIds: [], expectedCents: 14000, receivedCents: 14000,
      method: 'cash', keepShortfall: false, kind: 'full', allocations: { t1: 14000 }, createdAt: 2 })
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-07" />)
    const list = await screen.findByRole('list', { name: 'This week' })
    await user.click(within(list).getAllByRole('button').find((b) => b.textContent?.endsWith('Received'))!)
    const dialog = await screen.findByRole('dialog', { name: 'Payment received' })
    expect(dialog).toHaveTextContent('1 of 2')
    expect(dialog).toHaveTextContent('Received$140.00')
    await user.click(within(dialog).getByRole('button', { name: 'Older ›' }))
    expect(await screen.findByText('2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Payment received' })).toHaveTextContent('Received$100.00')
  })

  it('deleting a row can be undone from the toast', async () => {
    await seed(false)
    const user = userEvent.setup()
    render(<><Home initialDate="2026-10-07" /><UndoToast /></>)
    const list = await screen.findByRole('list', { name: 'This week' })
    fireEvent.pointerDown(within(list).getAllByRole('button').at(-1)!)
    await new Promise((r) => setTimeout(r, 560))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Entry deleted')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'This week' })).getAllByRole('listitem')).toHaveLength(5))
    expect(await repo.getEntry('t1')).toBeDefined()
  })

  it('a short press does not open the menu', async () => {
    await seed(false)
    render(<Home initialDate="2026-10-07" />)
    const list = await screen.findByRole('list', { name: 'This week' })
    const row = within(list).getAllByRole('button')[0]
    fireEvent.pointerDown(row)
    fireEvent.pointerUp(row)
    await new Promise((r) => setTimeout(r, 560))
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('Edit navigates to the entry route', async () => {
    await seed(false)
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-07" />)
    const row = within(await screen.findByRole('list', { name: 'This week' })).getAllByRole('button').at(-1)!
    fireEvent.pointerDown(row)
    await new Promise((r) => setTimeout(r, 560))
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(window.location.hash).toBe('#/entry/t1')
  })

  it('+ opens a choice that navigates to the entry or expense form', async () => {
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-07" />)
    await user.click(await screen.findByRole('button', { name: 'New' }))
    await user.click(screen.getByRole('button', { name: 'Time entry' }))
    expect(window.location.hash).toBe('#/entry/new')
    await user.click(screen.getByRole('button', { name: 'New' }))
    await user.click(screen.getByRole('button', { name: 'Expense' }))
    expect(window.location.hash).toBe('#/expense/new')
  })

  it('header has Settings and Export buttons', async () => {
    const user = userEvent.setup()
    render(<Home initialDate="2026-10-07" />)
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    expect(window.location.hash).toBe('#/settings')
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(window.location.hash).toBe('#/export?period=week&from=2026-10-04')
  })
})

describe('Home with Side job', () => {
  it('lists side-job entries with the service and totals them', async () => {
    await repo.saveEntry({ id: 's1', employerId: 'side-job', start: '2026-10-06T08:00', end: '2026-10-06T12:00', breakMin: 0, rateCents: 4500, service: 'Fence repair' })
    await repo.saveSettings({ ...(await repo.getSettings()), homeEmployer: 'side-job' })
    render(<Home initialDate="2026-10-07" />)
    expect(await screen.findByText('$180.00')).toBeInTheDocument()
    expect(screen.getByText('8:00 AM – 12:00 PM')).toBeInTheDocument()
    expect(screen.getByText('Fence repair')).toBeInTheDocument()
  })

  it('under All employers the row says Side job and the service', async () => {
    await seed(false)
    await repo.saveEntry({ id: 's1', employerId: 'side-job', start: '2026-10-06T18:00', end: '2026-10-06T19:00', breakMin: 0, rateCents: 4500, service: 'Gutter' })
    await repo.saveSettings({ ...(await repo.getSettings()), homeEmployer: 'all' })
    render(<Home initialDate="2026-10-07" />)
    expect(await screen.findByText('Gutter')).toBeInTheDocument()
    expect(screen.getByText('Side job')).toBeInTheDocument()
  })
})

describe('Home employer menu with Side job', () => {
  it('is hidden without real employers unless Side job was chosen, and Side job never becomes the default', async () => {
    await repo.saveEntry({ id: 's1', employerId: 'side-job', start: '2026-10-06T08:00', end: '2026-10-06T12:00', breakMin: 0, rateCents: 4500 })
    const { unmount } = render(<Home initialDate="2026-10-07" />)
    await screen.findByText('$180.00')
    expect(screen.queryByRole('button', { name: /^Employer:/ })).not.toBeInTheDocument()
    unmount()
    await repo.saveSettings({ ...(await repo.getSettings()), homeEmployer: 'side-job' })
    render(<Home initialDate="2026-10-07" />)
    expect(await screen.findByRole('button', { name: /^Employer: Side job/ })).toBeInTheDocument()
  })
})
