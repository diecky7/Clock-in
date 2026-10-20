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

  it('shows an empty state and no share button when the week has no data', async () => {
    render(<Export week="2026-10-04" />)
    expect(await screen.findByText('Nothing to export for this week')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share PDF' })).not.toBeInTheDocument()
  })

  it('asks for an employer instead of sharing when none is selected', async () => {
    await seed()
    const user = userEvent.setup()
    render(<Export week="2026-10-04" />)
    for (const box of await screen.findAllByRole('checkbox')) {
      if ((box as HTMLInputElement).checked) await user.click(box)
    }
    const share = screen.getByRole('button', { name: 'Share PDF' })
    expect(share).toBeEnabled()
    await user.click(share)
    expect(await screen.findByRole('alert')).toHaveTextContent('Select at least one employer')
  })

  it('exports a month or two weeks, with overtime judged on the whole week', async () => {
    await repo.saveEmployer({ ...emp('e1', 'Acme'), overtimeEnabled: true, biweeklyStart: '2026-09-24' })
    // Week Sep 27 – Oct 3: 10 h a day Mon–Fri; the Friday (Oct 2) is all overtime.
    for (const d of ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
      await repo.saveEntry({ id: d, employerId: 'e1', start: `${d}T07:00`, end: `${d}T17:00`, breakMin: 0, rateCents: 3000 })
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    const user = userEvent.setup()
    render(<Export period="week" from="2026-10-01" />)
    expect(await screen.findByText('Sep 27 – Oct 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Monthly' }))
    expect(await screen.findByText('September 2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    expect(await screen.findByText('October 2026')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Share PDF' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const [m] = vi.mocked(renderPdf).mock.calls[0][0]
    expect(m.weekLabel).toBe('October 2026')
    expect(m.hoursTotal).toBe('20h 00m')
    expect(m.days).toHaveLength(2)
    expect(m.valueLines.map((l) => [l.label, l.cents])).toEqual([['Regular pay', 30000], ['Overtime pay', 45000]])
    expect((share.mock.calls[0][0].files[0] as File).name).toBe('time-report-month-2026-10-01.pdf')

    await user.click(screen.getByRole('button', { name: 'Biweekly' }))
    expect(await screen.findByText('Sep 24 – Oct 7')).toBeInTheDocument() // the employer's pay period
    await user.click(screen.getByRole('button', { name: 'Previous two weeks' }))
    expect(await screen.findByText('Sep 10 – 23')).toBeInTheDocument()
    expect(await screen.findByText('Nothing to export for these two weeks')).toBeInTheDocument()
  })
})
