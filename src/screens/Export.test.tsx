import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import type { Employer } from '../domain/types'
import { renderPdf } from '../export/pdf'
import Export from './Export'

vi.mock('../export/pdf', () => ({
  renderPdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
}))

const emp = (id: string, name: string): Employer => ({ id, name, overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 3000 }] })

async function seed() {
  await repo.saveEmployer(emp('e1', 'Acme'))
  await repo.saveEmployer(emp('e2', 'Bolt'))
  await repo.saveEmployer(emp('e3', 'Idle Co'))
  for (const [i, e] of ['e1', 'e2'].entries())
    await repo.saveEntry({ id: `t${i}`, employerId: e, start: '2026-10-05T07:00', end: '2026-10-05T15:00', breakMin: 0, rateCents: 3000 })
  await repo.saveExpense({ id: 'x1', employerId: 'e1', date: '2026-10-06', description: 'Tape', amountCents: 500, photoIds: [] })
}

beforeEach(async () => {
  await resetDbForTests()
  vi.mocked(renderPdf).mockClear()
  Object.assign(URL, { createObjectURL: () => 'blob:pdf', revokeObjectURL: () => undefined })
})
afterEach(() => vi.unstubAllGlobals())

describe('Export', () => {
  it('lists the employers that worked that week and starts with everything on', async () => {
    await seed()
    render(<Export week="2026-10-04" />)
    expect(await screen.findByText('Oct 4 – 10')).toBeInTheDocument()
    expect(await screen.findByRole('checkbox', { name: 'Acme' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Bolt' })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Idle Co' })).not.toBeInTheDocument()
    for (const name of ['Regular pay', 'Overtime pay', 'Expenses', 'Hourly rate', 'Addresses', 'Times and break'])
      expect(screen.getByRole('switch', { name })).toHaveAttribute('aria-checked', 'true')
  })

  it('remembers nothing between visits', async () => {
    await seed()
    const user = userEvent.setup()
    const first = render(<Export week="2026-10-04" />)
    await user.click(await screen.findByRole('switch', { name: 'Addresses' }))
    await user.click(screen.getByRole('checkbox', { name: 'Bolt' }))
    expect(screen.getByRole('switch', { name: 'Addresses' })).toHaveAttribute('aria-checked', 'false')
    first.unmount()
    render(<Export week="2026-10-04" />)
    expect(await screen.findByRole('switch', { name: 'Addresses' })).toHaveAttribute('aria-checked', 'true')
    expect(await screen.findByRole('checkbox', { name: 'Bolt' })).toBeChecked()
  })

  it('Share PDF renders both selected employers and shares a .pdf file', async () => {
    await seed()
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    const user = userEvent.setup()
    render(<Export week="2026-10-04" />)
    await user.click(await screen.findByRole('button', { name: 'Share PDF' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const models = vi.mocked(renderPdf).mock.calls[0][0]
    expect(models.map((m) => m.employerName)).toEqual(['Acme', 'Bolt'])
    const file = share.mock.calls[0][0].files[0] as File
    expect(file.name).toBe('time-report-2026-10-04.pdf')
    expect(file.type).toBe('application/pdf')
  })

  it('passes the toggles to the report and skips deselected employers', async () => {
    await seed()
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share: vi.fn().mockResolvedValue(undefined) })
    const user = userEvent.setup()
    render(<Export week="2026-10-04" />)
    await user.click(await screen.findByRole('switch', { name: 'Expenses' }))
    await user.click(screen.getByRole('checkbox', { name: 'Bolt' }))
    await user.click(screen.getByRole('button', { name: 'Share PDF' }))
    await waitFor(() => expect(renderPdf).toHaveBeenCalled())
    const models = vi.mocked(renderPdf).mock.calls[0][0]
    expect(models).toHaveLength(1)
    expect(models[0].expenseItems).toEqual([])
    expect(models[0].valueLines.map((l) => l.label)).toEqual(['Regular pay'])
  })

  it('downloads the PDF when file sharing is unavailable', async () => {
    await seed()
    vi.stubGlobal('navigator', { ...navigator, canShare: undefined, share: undefined })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(<Export week="2026-10-04" />)
    await user.click(await screen.findByRole('button', { name: 'Share PDF' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    click.mockRestore()
  })

  it('shows an empty state and disables sharing when the week has no data', async () => {
    render(<Export week="2026-10-04" />)
    expect(await screen.findByText('Nothing to export for this week')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Share PDF' })).toBeDisabled()
  })
})
