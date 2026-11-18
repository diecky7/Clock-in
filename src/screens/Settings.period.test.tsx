import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import Settings from './Settings'

beforeEach(async () => {
  await resetDbForTests()
})

it('sets and clears the default two-week period, and shows where weeks and periods end', async () => {
  const user = userEvent.setup()
  render(<Settings />)
  expect(await screen.findByText('Ends on Saturday')).toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Week starts on'), 'Monday')
  expect(await screen.findByText('Ends on Sunday')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Biweekly period starts on'), { target: { value: '2026-11-05' } })
  expect(await screen.findByText('Ends on Wed, Nov 18, 2026 · repeats every 14 days')).toBeInTheDocument()
  await waitFor(async () => expect((await repo.getSettings()).biweeklyStart).toBe('2026-11-05'))

  await user.click(screen.getByRole('button', { name: 'Clear' }))
  expect(await screen.findByText('Not set: two weeks count from Jan 2026')).toBeInTheDocument()
  await waitFor(async () => expect((await repo.getSettings()).biweeklyStart).toBeUndefined())
})
