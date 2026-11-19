import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import type { Employer } from '../domain/types'
import { dismissUndo } from '../undo'
import PaymentForm from './PaymentForm'

const acme: Employer = { id: 'e1', name: 'Acme', overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 3000 }] }
const bay: Employer = { ...acme, id: 'e2', name: 'Bay' }

async function seed() {
  await repo.saveEmployer(acme)
  await repo.saveEmployer(bay)
  // Week Oct 4 – 10: two Acme shifts of 8 h at $30 ($240 each), one Bay shift, one Acme expense, and one shift the week after.
  await repo.saveEntry({ id: 't1', employerId: 'e1', start: '2026-10-05T07:00', end: '2026-10-05T15:00', breakMin: 0, rateCents: 3000 })
  await repo.saveEntry({ id: 't2', employerId: 'e1', start: '2026-10-06T07:00', end: '2026-10-06T15:00', breakMin: 0, rateCents: 3000 })
  await repo.saveEntry({ id: 'b1', employerId: 'e2', start: '2026-10-06T07:00', end: '2026-10-06T11:00', breakMin: 0, rateCents: 3000 })
  await repo.saveEntry({ id: 't3', employerId: 'e1', start: '2026-10-12T07:00', end: '2026-10-12T15:00', breakMin: 0, rateCents: 3000 })
  await repo.saveExpense({ id: 'x1', employerId: 'e1', date: '2026-10-07', description: 'Tape', amountCents: 1500, photoIds: [] })
  await repo.saveSettings({ ...(await repo.getSettings()), accounts: [{ id: 'a1', name: 'Santander' }, { id: 'a2', name: 'Bank of America' }] })
}

beforeEach(async () => {
  await resetDbForTests()
  dismissUndo()
})

describe('PaymentForm', () => {
  it('lists only the week and employer chosen, all ticked; Full fills in the expected amount', async () => {
    await seed()
    const user = userEvent.setup()
    render(<PaymentForm period="week" from="2026-10-04" employer="e1" />)
    const boxes = await screen.findAllByRole('checkbox')
    expect(boxes).toHaveLength(3) // t1, t2, x1 — not Bay, not next week
    expect(screen.getByLabelText('Amount received')).toHaveValue('$495.00')
    await user.click(boxes[1]) // un-tick Tue
    expect(screen.getByLabelText('Amount received')).toHaveValue('$255.00')
    await user.click(screen.getByRole('button', { name: 'Cash' }))
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect(await repo.listPayments()).toHaveLength(1))
    const [p] = await repo.listPayments()
    expect(p).toMatchObject({ kind: 'full', entryIds: ['t1'], expenseIds: ['x1'], expectedCents: 25500, receivedCents: 25500, method: 'cash', allocations: { t1: 24000, x1: 1500 } })
  })

  it('Full with less needs the Accept box; then everything is settled', async () => {
    await seed()
    const user = userEvent.setup()
    render(<PaymentForm period="week" from="2026-10-04" employer="e1" />)
    await screen.findAllByRole('checkbox')
    const amount = screen.getByLabelText('Amount received')
    await user.clear(amount)
    await user.type(amount, '49000')
    await user.click(screen.getByRole('button', { name: 'Cash' }))
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    expect(screen.getByText('Tick “Accept $5.00 less”, or choose Partial')).toBeInTheDocument()
    expect(await repo.listPayments()).toHaveLength(0)
    await user.click(screen.getByRole('checkbox', { name: 'Accept $5.00 less' }))
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect(await repo.listPayments()).toHaveLength(1))
    expect((await repo.listPayments())[0]).toMatchObject({ kind: 'full', receivedCents: 49000, allocations: { t1: 24000, t2: 24000, x1: 1500 } })
  })

  it('Partial pays the oldest first, and the rest comes back next time', async () => {
    await seed()
    const user = userEvent.setup()
    const first = render(<PaymentForm period="week" from="2026-10-04" employer="e1" />)
    await screen.findAllByRole('checkbox')
    await user.click(screen.getByRole('button', { name: 'Partial' }))
    expect(screen.getByLabelText('Amount received')).toHaveValue('')
    await user.type(screen.getByLabelText('Amount received'), '30000')
    expect(screen.getByText('$195.00')).toBeInTheDocument() // left to receive
    await user.click(screen.getByRole('button', { name: 'Cash' }))
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect(await repo.listPayments()).toHaveLength(1))
    // Mon $240 paid, Tue gets $60 of $240, the expense (Wed) nothing.
    expect((await repo.listPayments())[0]).toMatchObject({ kind: 'partial', entryIds: ['t1', 't2'], expenseIds: [], allocations: { t1: 24000, t2: 6000 } })
    first.unmount()

    render(<PaymentForm period="week" from="2026-10-04" employer="e1" />)
    expect(await screen.findAllByRole('checkbox')).toHaveLength(2) // Tue (rest) and the expense
    expect(screen.getByText('$180.00')).toBeInTheDocument()
    expect(screen.getByText('of $240.00')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount received')).toHaveValue('$195.00')
  })

  it('Full → Partial → Full brings the expected amount back; more than expected also needs a tick', async () => {
    await seed()
    const user = userEvent.setup()
    render(<PaymentForm period="week" from="2026-10-04" employer="e1" />)
    await screen.findAllByRole('checkbox')
    await user.click(screen.getByRole('button', { name: 'Partial' }))
    await user.click(screen.getByRole('button', { name: 'Full' }))
    const amount = screen.getByLabelText('Amount received')
    expect(amount).toHaveValue('$495.00')
    await user.type(amount, '0') // one digit too many: $4,950.00
    await user.click(screen.getByRole('button', { name: 'Cash' }))
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    expect(screen.getByText('Tick “Accept $4,455.00 more” if that\'s right')).toBeInTheDocument()
    expect(await repo.listPayments()).toHaveLength(0)
  })

  it('Partial cannot be the whole amount', async () => {
    await seed()
    const user = userEvent.setup()
    render(<PaymentForm period="week" from="2026-10-04" employer="e1" />)
    await screen.findAllByRole('checkbox')
    await user.click(screen.getByRole('button', { name: 'Partial' }))
    await user.type(screen.getByLabelText('Amount received'), '49500')
    await user.click(screen.getByRole('button', { name: 'Cash' }))
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    expect(screen.getByText('That covers it all: choose Full')).toBeInTheDocument()
  })

  it('Zelle needs a real account; a new name asks before creating it', async () => {
    await seed()
    const user = userEvent.setup()
    render(<PaymentForm period="week" from="2026-10-04" employer="e1" />)
    await screen.findAllByRole('checkbox')
    await user.click(screen.getByRole('button', { name: 'Zelle' }))
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    expect(screen.getByText('Choose the account')).toBeInTheDocument()

    const field = screen.getByRole('combobox')
    await user.type(field, 'san')
    const list = screen.getByRole('listbox', { name: 'Accounts' })
    expect(within(list).getByRole('option', { name: 'Santander' })).toBeInTheDocument()
    expect(within(list).queryByRole('option', { name: 'Bank of America' })).not.toBeInTheDocument()

    await user.clear(field)
    await user.type(field, 'Citizens')
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    const ask = await screen.findByRole('dialog', { name: 'Create account' })
    expect(ask).toHaveTextContent('Create the account “Citizens”?')
    await user.click(within(ask).getByRole('button', { name: 'Create and save' }))
    await waitFor(async () => expect(await repo.listPayments()).toHaveLength(1))
    const s = await repo.getSettings()
    const citizens = s.accounts!.find((a) => a.name === 'Citizens')!
    expect((await repo.listPayments())[0]).toMatchObject({ method: 'zelle', accountId: citizens.id, receivedCents: 49500 })
  })

  it('a typed existing name (any case) is that account, never a new one', async () => {
    await seed()
    const user = userEvent.setup()
    render(<PaymentForm period="week" from="2026-10-04" employer="e1" />)
    await screen.findAllByRole('checkbox')
    await user.click(screen.getByRole('button', { name: 'Zelle' }))
    await user.type(screen.getByRole('combobox'), 'bank of america')
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect(await repo.listPayments()).toHaveLength(1))
    expect((await repo.listPayments())[0].accountId).toBe('a2')
    expect((await repo.getSettings()).accounts).toHaveLength(2)
  })

  it('items already received are not offered again', async () => {
    await seed()
    await repo.savePayment({ id: 'p', date: '2026-10-09', entryIds: ['t1'], expenseIds: [], expectedCents: 24000, receivedCents: 24000, method: 'cash', keepShortfall: false, kind: 'full', allocations: { t1: 24000 }, createdAt: 1 })
    render(<PaymentForm period="week" from="2026-10-04" employer="e1" />)
    expect(await screen.findAllByRole('checkbox')).toHaveLength(2)
  })

  it('shows the same two weeks as Home for the chosen employer', async () => {
    await seed()
    await repo.saveEmployer({ ...acme, biweeklyStart: '2026-10-11' })
    await repo.saveSettings({ ...(await repo.getSettings()), biweeklyStart: '2026-10-04' })
    render(<PaymentForm period="biweek" from="2026-10-11" employer="e1" />)
    expect(await screen.findByText('Oct 11 – 24')).toBeInTheDocument()
    expect(await screen.findAllByRole('checkbox')).toHaveLength(1) // only t3 (Oct 12)
  })

  it('two quick creates of the same name make one account', async () => {
    const [a, b] = await Promise.all([repo.createAccount('Chase'), repo.createAccount('chase')])
    expect(a.account.id).toBe(b.account.id)
    expect((await repo.getSettings()).accounts).toHaveLength(1)
  })
})
