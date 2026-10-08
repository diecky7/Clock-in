import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import type { Employer, Expense, TimeEntry } from '../domain/types'
import Home from './Home'

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
})

describe('Home', () => {
  it('shows balance and the hours + expenses detail line', async () => {
    await seed()
    render(<Home initialDate="2026-10-07" />)
    expect(await screen.findByText('$1,415.50')).toBeInTheDocument()
    expect(screen.getByText('38.5 h · $1,240.00 + $175.50 expenses')).toBeInTheDocument()
    expect(screen.getByText('Oct 4 – 10')).toBeInTheDocument()
  })

  it('detail line is hours only without expenses', async () => {
    await seed(false)
    render(<Home initialDate="2026-10-07" />)
    expect(await screen.findByText('$1,240.00')).toBeInTheDocument()
    expect(screen.getByText('38.5 h')).toBeInTheDocument()
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
    const days = within(list).getAllByRole('listitem').map((li) => li.textContent?.match(/^\w+ \d+/)?.[0])
    expect(days).toEqual(['Fri 9', 'Thu 8', 'Wed 7', 'Tue 6', 'Mon 5'])
  })

  it('dragging more than 30% of the width changes the week; less springs back', async () => {
    await seed()
    render(<Home initialDate="2026-10-07" />)
    const list = await screen.findByRole('list', { name: 'This week' })
    const zone = list.closest('div')!.parentElement as HTMLElement
    const drag = (from: number, to: number) => {
      fireEvent.pointerDown(zone, { pointerId: 1, isPrimary: true, clientX: from, clientY: 300 })
      fireEvent.pointerMove(zone, { pointerId: 1, isPrimary: true, clientX: to, clientY: 300 })
      fireEvent.pointerUp(zone, { pointerId: 1, isPrimary: true, clientX: to, clientY: 300 })
    }
    drag(300, 150) // 150 px of a 1024 px page: not enough
    await new Promise((r) => setTimeout(r, 300))
    expect(screen.getByText('Oct 4 – 10')).toBeInTheDocument()
    drag(800, 300) // left, far enough: next week
    expect(await screen.findByText('Oct 11 – 17')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 500))
    drag(100, 700) // right: back
    expect(await screen.findByText('Oct 4 – 10')).toBeInTheDocument()
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
    expect(window.location.hash).toBe('#/export?week=2026-10-04')
  })
})
