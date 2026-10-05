import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import type { Employer } from '../domain/types'
import ExpenseForm from './ExpenseForm'

vi.mock('../data/images', () => ({
  resizeImage: vi.fn(async (f: Blob) => f),
  requestPersistence: vi.fn(async () => true),
}))

const acme: Employer = { id: 'e1', name: 'Acme', overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 3200 }] }
const jpeg = (name: string) => new File([name], `${name}.jpg`, { type: 'image/jpeg' })

beforeEach(async () => {
  await resetDbForTests()
  window.location.hash = ''
  Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined })
})

async function setup(id?: string) {
  await repo.saveEmployer(acme)
  render(<ExpenseForm id={id} initialDate="2026-10-07" />)
  await screen.findByRole('radio', { name: 'Acme' })
}

describe('ExpenseForm', () => {
  it('requires an amount', async () => {
    const user = userEvent.setup()
    await setup()
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    expect(screen.getByText('Enter an amount')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Amount'), 'abc')
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    expect(screen.getByText('Enter an amount')).toBeInTheDocument()
    expect(await repo.listExpensesBetween('2026-01-01', '2026-12-31')).toEqual([])
  })

  it('saves amount, employer, date and photo ids; the button shows the amount', async () => {
    const user = userEvent.setup()
    await setup()
    await user.type(screen.getByLabelText('Description'), 'Paint rollers')
    await user.type(screen.getByLabelText('Amount'), '175.50')
    await user.upload(screen.getByLabelText('Choose from library'), jpeg('a'))
    await screen.findByRole('button', { name: 'Remove photo 1' })
    await user.click(screen.getByRole('button', { name: 'Save · $175.50' }))
    await waitFor(async () => expect(await repo.listExpensesBetween('2026-10-07', '2026-10-07')).toHaveLength(1))
    const [x] = await repo.listExpensesBetween('2026-10-07', '2026-10-07')
    expect(x).toMatchObject({ employerId: 'e1', description: 'Paint rollers', amountCents: 17550, date: '2026-10-07' })
    expect(x.photoIds).toHaveLength(1)
    expect(await repo.getPhoto(x.photoIds[0])).toBeDefined()
    expect(window.location.hash).toBe('#/')
  })

  it('stores "Expense" when the description is empty', async () => {
    const user = userEvent.setup()
    await setup()
    await user.type(screen.getByLabelText('Amount'), '10')
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect(await repo.listExpensesBetween('2026-10-07', '2026-10-07')).toHaveLength(1))
    expect((await repo.listExpensesBetween('2026-10-07', '2026-10-07'))[0].description).toBe('Expense')
  })

  it('refuses a fourth photo', async () => {
    const user = userEvent.setup()
    await setup()
    await user.upload(screen.getByLabelText('Choose from library'), [jpeg('a'), jpeg('b'), jpeg('c')])
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Remove photo/ })).toHaveLength(3))
    await user.upload(screen.getByLabelText('Choose from library'), jpeg('d'))
    expect(await screen.findByText('Up to 3 photos')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Remove photo/ })).toHaveLength(3)
  })

  it('shows a message and keeps the form when the photo cannot be stored', async () => {
    const user = userEvent.setup()
    await setup()
    vi.spyOn(repo, 'putPhoto').mockRejectedValueOnce(new Error('quota'))
    await user.upload(screen.getByLabelText('Take photo'), jpeg('a'))
    expect(await screen.findByText("Couldn't save the photo. Free some space and try again.")).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toBeInTheDocument()
  })

  it('edit mode loads values; removing a photo and saving deletes its blob', async () => {
    const user = userEvent.setup()
    const p1 = await repo.putPhoto(new Blob(['1'], { type: 'image/jpeg' }))
    const p2 = await repo.putPhoto(new Blob(['2'], { type: 'image/jpeg' }))
    await repo.saveExpense({ id: 'x1', employerId: 'e1', date: '2026-10-06', description: 'Tape', amountCents: 899, photoIds: [p1, p2] })
    await setup('x1')
    expect(await screen.findByDisplayValue('Tape')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveValue('8.99')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-06')
    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }))
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect(await repo.getPhoto(p1)).toBeUndefined())
    expect(await repo.getPhoto(p2)).toBeDefined()
    expect((await repo.getExpense('x1'))?.photoIds).toEqual([p2])
  })
})
