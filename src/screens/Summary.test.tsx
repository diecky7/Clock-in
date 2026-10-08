import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import { today } from '../domain/today'
import Summary from './Summary'

beforeEach(async () => {
  await resetDbForTests()
})

describe('Summary', () => {
  it('has a card per figure with weekly, monthly and yearly rows; the week arrows move them', async () => {
    const d = today()
    await repo.saveEmployer({ id: 'e', name: 'A', overtimeEnabled: false, archived: false, rates: [{ from: '2000-01-01', cents: 2000 }] })
    await repo.saveEntry({ id: 't', employerId: 'e', start: `${d}T08:00`, end: `${d}T16:00`, breakMin: 0, rateCents: 2000 })
    const user = userEvent.setup()
    render(<Summary />)
    const total = within(await screen.findByRole('region', { name: 'Total' }))
    expect(total.getByText('Weekly')).toBeInTheDocument()
    expect(total.getByText(/Monthly/)).toBeInTheDocument()
    expect(total.getByText(/Yearly/)).toBeInTheDocument()
    expect(total.getAllByText('$160.00')).toHaveLength(3)
    for (const name of ['Hours', 'Overtime', 'Earnings', 'Expenses']) expect(screen.getByRole('region', { name })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    // The empty week reads $0.00 (the month and year may or may not change, depending on today's date).
    await waitFor(() => expect(total.getByText('Weekly').parentElement).toHaveTextContent('$0.00'))
  })

  it('dragging across more than half the screen changes the week', async () => {
    render(<Summary />)
    const start = (await screen.findByRole('navigation', { name: 'Week' })).textContent
    const zone = screen.getByRole('main', { name: 'Summary' })
    fireEvent.pointerDown(zone, { pointerId: 1, isPrimary: true, clientX: 1000, clientY: 300 })
    fireEvent.pointerMove(zone, { pointerId: 1, isPrimary: true, clientX: 200, clientY: 300 })
    fireEvent.pointerUp(zone, { pointerId: 1, isPrimary: true, clientX: 200, clientY: 300 })
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Week' }).textContent).not.toBe(start))
  })
})
