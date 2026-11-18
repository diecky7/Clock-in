import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import { dismissUndo } from '../undo'
import MarkReceivedDialog from './MarkReceivedDialog'

beforeEach(async () => {
  await resetDbForTests()
  dismissUndo()
})

it('starts at the latest two weeks with data and marks everything before it as received', async () => {
  await repo.saveEmployer({ id: 'e', name: 'A', overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 3000 }] })
  await repo.saveSettings({ ...(await repo.getSettings()), biweeklyStart: '2026-11-01' })
  for (const d of ['2026-10-20', '2026-10-30', '2026-11-03', '2026-11-16'])
    await repo.saveEntry({ id: d, employerId: 'e', start: `${d}T07:00`, end: `${d}T15:00`, breakMin: 0, rateCents: 3000 })
  await repo.saveExpense({ id: 'x', employerId: 'e', date: '2026-10-21', description: 'Tape', amountCents: 1500, photoIds: [] })
  const user = userEvent.setup()
  render(<MarkReceivedDialog onClose={() => undefined} />)
  // Latest data is Nov 16 → its two weeks start Nov 15; Oct 20, Oct 30, Nov 3 and the expense are before it.
  expect(await screen.findByText('Sun, Nov 15, 2026')).toBeInTheDocument()
  expect(await screen.findByText(/3 entries and 1 expense before .* worth \$735\.00, will count as received\./)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mark as received' }))
  await waitFor(async () => expect(await repo.listPayments()).toHaveLength(1))
  const [p] = await repo.listPayments()
  expect(p).toMatchObject({ method: 'marked', expectedCents: 73500, receivedCents: 73500, expenseIds: ['x'] })
  expect([...p.entryIds].sort()).toEqual(['2026-10-20', '2026-10-30', '2026-11-03'])
})
