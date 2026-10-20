import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import EmployerEdit from './EmployerEdit'

beforeEach(async () => {
  await resetDbForTests()
})

describe('EmployerEdit', () => {
  it('saves and clears the biweekly pay period start', async () => {
    await repo.saveEmployer({ id: 'e', name: 'Shark', overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 2600 }] })
    const user = userEvent.setup()
    const { unmount } = render(<EmployerEdit id="e" />)
    const field = await screen.findByLabelText('Biweekly pay period starts on')
    fireEvent.change(field, { target: { value: '2026-10-15' } })
    expect(screen.getByText('Thu, Oct 15, 2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await repo.listEmployers())[0].biweeklyStart).toBe('2026-10-15'))
    unmount()

    render(<EmployerEdit id="e" />)
    await screen.findByText('Thu, Oct 15, 2026')
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await repo.listEmployers())[0].biweeklyStart).toBeUndefined())
  })
})
