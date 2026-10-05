import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportBackup } from '../data/backup'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import { activeEmployers } from '../domain/employers'
import { today } from '../domain/today'
import type { Employer, TimeEntry } from '../domain/types'
import EmployerEdit from './EmployerEdit'
import ScheduleEdit from './ScheduleEdit'
import Settings from './Settings'

beforeEach(async () => {
  await resetDbForTests()
  window.location.hash = ''
})

const acme: Employer = {
  id: 'e1',
  name: 'Acme',
  overtimeEnabled: false,
  archived: false,
  rates: [{ from: '2026-01-01', cents: 3000 }],
}

describe('EmployerEdit', () => {
  it('adds an employer with its first rate starting today', async () => {
    const user = userEvent.setup()
    render(<EmployerEdit id="new" />)
    await user.type(await screen.findByLabelText('Name'), 'Acme')
    await user.type(screen.getByLabelText('Hourly rate'), '32.00')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect(await repo.listEmployers()).toHaveLength(1))
    const [e] = await repo.listEmployers()
    expect(e.name).toBe('Acme')
    expect(e.rates).toEqual([{ from: today(), cents: 3200 }])
    expect(e.archived).toBe(false)
  })

  it('a new rate is appended and leaves existing entries untouched', async () => {
    await repo.saveEmployer(acme)
    const entry: TimeEntry = {
      id: 't1',
      employerId: 'e1',
      start: '2026-10-05T07:00',
      end: '2026-10-05T15:00',
      breakMin: 0,
      rateCents: 3000,
    }
    await repo.saveEntry(entry)
    const user = userEvent.setup()
    render(<EmployerEdit id="e1" />)
    const rate = await screen.findByLabelText('Hourly rate')
    await waitFor(() => expect(rate).toHaveValue('30.00'))
    await user.clear(rate)
    await user.type(rate, '35')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await repo.listEmployers())[0].rates).toHaveLength(2))
    const [e] = await repo.listEmployers()
    expect(e.rates[1]).toEqual({ from: today(), cents: 3500 })
    expect((await repo.getEntry('t1'))?.rateCents).toBe(3000)
  })

  it('shows rate history and the new-entries-only note', async () => {
    await repo.saveEmployer(acme)
    render(<EmployerEdit id="e1" />)
    expect(await screen.findByText('New rate applies to new entries only')).toBeInTheDocument()
    expect(screen.getByText('$30.00')).toBeInTheDocument()
  })

  it('Delete employer archives it and hides it from active employers', async () => {
    await repo.saveEmployer(acme)
    const user = userEvent.setup()
    render(<EmployerEdit id="e1" />)
    await user.click(await screen.findByRole('button', { name: 'Delete employer' }))
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(async () => expect((await repo.listEmployers())[0].archived).toBe(true))
    expect(activeEmployers(await repo.listEmployers())).toEqual([])
  })

  it('the overtime switch saves overtimeEnabled', async () => {
    await repo.saveEmployer(acme)
    const user = userEvent.setup()
    render(<EmployerEdit id="e1" />)
    await user.click(await screen.findByRole('switch', { name: /Overtime/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await repo.listEmployers())[0].overtimeEnabled).toBe(true))
  })

  it('shows inline errors and does not save an empty name or invalid rate', async () => {
    const user = userEvent.setup()
    render(<EmployerEdit id="new" />)
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter a name')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid rate')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Name'), 'Acme')
    await user.type(screen.getByLabelText('Hourly rate'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter a valid rate')).toBeInTheDocument()
    expect(await repo.listEmployers()).toEqual([])
  })
})

describe('Settings', () => {
  it('lists active employers with their current rate, hides archived ones', async () => {
    await repo.saveEmployer(acme)
    await repo.saveEmployer({ ...acme, id: 'e2', name: 'Old Co', archived: true })
    render(<Settings />)
    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('$30.00/h')).toBeInTheDocument()
    expect(screen.queryByText('Old Co')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add employer' })).toBeInTheDocument()
  })

  it('Week starts on saves weekStartsOn', async () => {
    const user = userEvent.setup()
    render(<Settings />)
    await user.selectOptions(await screen.findByLabelText('Week starts on'), 'Monday')
    await waitFor(async () => expect((await repo.getSettings()).weekStartsOn).toBe(1))
  })
})

describe('ScheduleEdit', () => {
  it('shows the defaults and saves a day set to Off as null', async () => {
    const user = userEvent.setup()
    render(<ScheduleEdit />)
    expect(await screen.findByLabelText('Monday in')).toHaveValue('07:00')
    await user.click(screen.getByRole('switch', { name: 'Monday off' }))
    await waitFor(async () => expect((await repo.getSettings()).schedule[1]).toBeNull())
  })

  it('ignores a cleared time instead of saving an empty one', async () => {
    const user = userEvent.setup()
    render(<ScheduleEdit />)
    const input = await screen.findByLabelText('Wednesday in')
    await user.clear(input)
    expect(input).toHaveValue('07:00')
    await new Promise((r) => setTimeout(r, 30))
    expect((await repo.getSettings()).schedule[3]?.in).toBe('07:00')
  })

  it('saves an edited time and break', async () => {
    const user = userEvent.setup()
    render(<ScheduleEdit />)
    const brk = await screen.findByLabelText('Tuesday break (min)')
    await user.clear(brk)
    await user.type(brk, '45')
    await waitFor(async () => expect((await repo.getSettings()).schedule[2]?.breakMin).toBe(45))
  })
})

describe('Settings backup', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Export backup shares a .json file when the share sheet supports files', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share })
    const user = userEvent.setup()
    render(<Settings />)
    await user.click(await screen.findByRole('button', { name: 'Export backup' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const file = share.mock.calls[0][0].files[0] as File
    expect(file.name).toMatch(/^clock-in-backup-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it('Import backup asks before replacing, then restores', async () => {
    await repo.saveEmployer(acme)
    const backup = await exportBackup()
    await repo.saveEmployer({ ...acme, id: 'extra', name: 'Extra Co' })
    const user = userEvent.setup()
    render(<Settings />)
    await user.upload(await screen.findByLabelText('Backup file'), new File([backup], 'b.json', { type: 'application/json' }))
    expect(await screen.findByText('Replace all data on this device?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Replace' }))
    expect(await screen.findByText('Backup restored.')).toBeInTheDocument()
    expect((await repo.listEmployers()).map((e) => e.name)).toEqual(['Acme'])
  })

  it('Cancel leaves data alone; an invalid file shows the error and keeps data', async () => {
    await repo.saveEmployer(acme)
    const user = userEvent.setup()
    render(<Settings />)
    const input = await screen.findByLabelText('Backup file')
    await user.upload(input, new File(['nope'], 'b.json', { type: 'application/json' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(await repo.listEmployers()).toHaveLength(1)
    await user.upload(input, new File(['nope'], 'b.json', { type: 'application/json' }))
    await user.click(await screen.findByRole('button', { name: 'Replace' }))
    expect(await screen.findByText("This isn't a valid backup file.")).toBeInTheDocument()
    expect(await repo.listEmployers()).toHaveLength(1)
  })
})
