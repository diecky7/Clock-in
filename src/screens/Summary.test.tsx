import { render, screen, within } from '@testing-library/react'
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
  it('shows one total; the Week/Month/Year filter widens it and the week arrows move it', async () => {
    const d = today()
    await repo.saveEmployer({ id: 'e', name: 'A', overtimeEnabled: false, archived: false, rates: [{ from: '2000-01-01', cents: 2000 }] })
    await repo.saveEntry({ id: 't', employerId: 'e', start: `${d}T08:00`, end: `${d}T16:00`, breakMin: 0, rateCents: 2000 })
    const user = userEvent.setup()
    render(<Summary />)
    const totals = async () => within(await screen.findByRole('region', { name: 'Totals' }))
    expect((await totals()).getByText('$160.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Year' }))
    expect((await totals()).getByText('$160.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Week' }))
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect((await totals()).getByText('$0.00')).toBeInTheDocument()
  })
})
