import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import type { Employer, Place } from '../domain/types'
import * as geo from '../location/geocode'
import EntryForm from './EntryForm'

vi.mock('../location/MapPicker', () => ({ default: () => <div data-testid="map" /> }))
vi.mock('../location/geocode', () => ({
  searchAddress: vi.fn(),
  reverseGeocode: vi.fn(),
  getCurrentPosition: vi.fn(),
}))

const acme: Employer = { id: 'e1', name: 'Acme', overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 3200 }] }
const bolt: Employer = { id: 'e2', name: 'Bolt', overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 4000 }] }
const hall: Place = { lat: 42.36, lon: -71.05, label: '1 City Hall Plz, Boston, MA' }

beforeEach(async () => {
  await resetDbForTests()
  window.location.hash = ''
  vi.mocked(geo.getCurrentPosition).mockRejectedValue(new Error('denied'))
  vi.mocked(geo.searchAddress).mockResolvedValue([])
  vi.mocked(geo.reverseGeocode).mockRejectedValue(new Error('offline'))
})

async function setup(opts: { id?: string } = {}) {
  await repo.saveEmployer(acme)
  await repo.saveEmployer(bolt)
  render(<EntryForm id={opts.id} initialDate="2026-10-05" />)
  await screen.findByRole('radio', { name: 'Acme' })
}

describe('EntryForm', () => {
  it('defaults In, Out and Break from the schedule of the chosen day', async () => {
    await setup()
    expect(screen.getByText('Mon, Oct 5 · 7:00 AM')).toBeInTheDocument()
    expect(screen.getByText('Mon, Oct 5 · 3:30 PM')).toBeInTheDocument()
    expect(screen.getByLabelText('Break (min)')).toHaveValue(30)
    expect(screen.getByRole('button', { name: 'Save · 8h 00m' })).toBeInTheDocument()
  })

  it('employer buttons select the employer', async () => {
    const user = userEvent.setup()
    await setup()
    expect(screen.getByRole('radio', { name: 'Acme' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Bolt' }))
    expect(screen.getByRole('radio', { name: 'Bolt' })).toBeChecked()
  })

  it('saves with rateCents = the employer rate on the entry date', async () => {
    const user = userEvent.setup()
    await setup()
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect(await repo.listEntriesBetween('2026-10-05', '2026-10-05')).toHaveLength(1))
    const [e] = await repo.listEntriesBetween('2026-10-05', '2026-10-05')
    expect(e).toMatchObject({ employerId: 'e1', start: '2026-10-05T07:00', end: '2026-10-05T15:30', breakMin: 30, rateCents: 3200 })
    expect(window.location.hash).toBe('#/')
  })

  it('Out before In shows an inline error and does not save', async () => {
    const user = userEvent.setup()
    await setup()
    fireEvent.change(screen.getByLabelText('Out'), { target: { value: '2026-10-05T06:00' } })
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    expect(screen.getByText('Out must be after In')).toBeInTheDocument()
    expect(await repo.listEntriesBetween('2026-10-01', '2026-10-31')).toEqual([])
  })

  it('a break as long as the shift shows an inline error and does not save', async () => {
    const user = userEvent.setup()
    await setup()
    const brk = screen.getByLabelText('Break (min)')
    await user.clear(brk)
    await user.type(brk, '600')
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    expect(screen.getByText('Break is longer than the shift')).toBeInTheDocument()
    expect(await repo.listEntriesBetween('2026-10-01', '2026-10-31')).toEqual([])
  })

  it('still saves without a place when GPS is denied and the network fails', async () => {
    const user = userEvent.setup()
    vi.mocked(geo.searchAddress).mockRejectedValue(new Error('offline'))
    await setup()
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect(await repo.listEntriesBetween('2026-10-05', '2026-10-05')).toHaveLength(1))
    const [e] = await repo.listEntriesBetween('2026-10-05', '2026-10-05')
    expect(e.place).toBeUndefined()
  })

  it('fills the place from GPS on a new entry', async () => {
    vi.mocked(geo.getCurrentPosition).mockResolvedValue({ lat: 42.36, lon: -71.05, accuracyM: 5 })
    vi.mocked(geo.reverseGeocode).mockResolvedValue(hall)
    await setup()
    expect(await screen.findByText(hall.label)).toBeInTheDocument()
  })

  it('asks which address to use when GPS is near a saved one, and uses the saved one on request', async () => {
    const user = userEvent.setup()
    const saved: Place = { lat: 42.3601, lon: -71.05, label: 'City Hall Plz, Boston, MA' } // ~35 ft away
    await repo.addRecentPlace(saved)
    vi.mocked(geo.getCurrentPosition).mockResolvedValue({ lat: 42.36, lon: -71.05, accuracyM: 5 })
    vi.mocked(geo.reverseGeocode).mockResolvedValue(hall)
    await setup()
    expect(await screen.findByRole('alert')).toHaveTextContent(saved.label)
    await user.click(screen.getByRole('button', { name: 'Use saved address' }))
    expect(screen.getByTestId('chosen-place')).toHaveTextContent(saved.label)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not ask when the saved address is farther than the limit or the check is off', async () => {
    const far: Place = { lat: 42.37, lon: -71.05, label: 'Far Away St, Boston, MA' }
    await repo.addRecentPlace(far)
    vi.mocked(geo.getCurrentPosition).mockResolvedValue({ lat: 42.36, lon: -71.05, accuracyM: 5 })
    vi.mocked(geo.reverseGeocode).mockResolvedValue(hall)
    await setup()
    expect(await screen.findByText(hall.label)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an old long label in short form, in the chosen place and the nearby prompt', async () => {
    const user = userEvent.setup()
    const old: Place = { lat: 42.3601, lon: -71.05, label: '1 City Hall Plaza, Boston, Massachusetts' }
    await repo.saveEmployer(acme)
    await repo.saveEntry({ id: 'old', employerId: 'e1', start: '2026-09-01T07:00', end: '2026-09-01T15:00', breakMin: 0, rateCents: 3200, place: old })
    vi.mocked(geo.getCurrentPosition).mockResolvedValue({ lat: 42.36, lon: -71.05, accuracyM: 5 })
    vi.mocked(geo.reverseGeocode).mockResolvedValue({ lat: 42.36, lon: -71.05, label: 'Elsewhere Rd, Boston, MA' })
    await setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('1 City Hall Plz, Boston, MA')
    expect(screen.getByRole('alert')).not.toHaveTextContent('Massachusetts')
    await user.click(screen.getByRole('button', { name: 'Use saved address' }))
    expect(screen.getByTestId('chosen-place')).toHaveTextContent('1 City Hall Plz, Boston, MA')
    expect(screen.getByTestId('chosen-place')).not.toHaveTextContent('Massachusetts')
  })

  it('focusing the empty address field lists recent places; choosing one fills the place; saving records it', async () => {
    const user = userEvent.setup()
    await repo.addRecentPlace(hall)
    await setup()
    await user.click(screen.getByLabelText('Address'))
    await user.click(await screen.findByRole('button', { name: hall.label }))
    expect(screen.getByTestId('chosen-place')).toHaveTextContent(hall.label)
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect(await repo.listEntriesBetween('2026-10-05', '2026-10-05')).toHaveLength(1))
    const [e] = await repo.listEntriesBetween('2026-10-05', '2026-10-05')
    expect(e.place).toEqual(hall)
    expect((await repo.getSettings()).recentPlaces[0]).toEqual(hall)
  })

  it('a slow automatic GPS fix does not overwrite an address the user already chose', async () => {
    const user = userEvent.setup()
    const other: Place = { lat: 42.28, lon: -71.41, label: '12 Main St, Framingham, MA' }
    let resolveGps!: (v: { lat: number; lon: number; accuracyM: number }) => void
    vi.mocked(geo.getCurrentPosition).mockReturnValue(new Promise((r) => (resolveGps = r)))
    vi.mocked(geo.reverseGeocode).mockResolvedValue(hall)
    await repo.addRecentPlace(other)
    await setup()
    await user.click(screen.getByLabelText('Address'))
    await user.click(await screen.findByRole('button', { name: other.label }))
    resolveGps({ lat: 42.36, lon: -71.05, accuracyM: 5 })
    await waitFor(() => expect(geo.reverseGeocode).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByTestId('chosen-place')).toHaveTextContent(other.label)
  })

  it('typing searches after a debounce and lists suggestions', async () => {
    const user = userEvent.setup()
    vi.mocked(geo.searchAddress).mockResolvedValue([hall])
    await setup()
    await user.type(screen.getByLabelText('Address'), 'city hall')
    await waitFor(() => expect(geo.searchAddress).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(vi.mocked(geo.searchAddress).mock.calls[0][0]).toBe('city hall')
    await user.click(await screen.findByRole('button', { name: hall.label }))
    expect(screen.getByTestId('chosen-place')).toHaveTextContent(hall.label)
  })

  it('edit mode loads the entry and keeps the stored rate unless the employer changes', async () => {
    const user = userEvent.setup()
    await repo.saveEntry({
      id: 't1',
      employerId: 'e1',
      start: '2026-10-05T08:00',
      end: '2026-10-05T12:00',
      breakMin: 0,
      rateCents: 2500,
    })
    await setup({ id: 't1' })
    expect(await screen.findByText('Mon, Oct 5 · 8:00 AM')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect(window.location.hash).toBe('#/'))
    expect((await repo.getEntry('t1'))?.rateCents).toBe(2500)

    window.location.hash = ''
    await user.click(screen.getByRole('radio', { name: 'Bolt' }))
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(async () => expect((await repo.getEntry('t1'))?.rateCents).toBe(4000))
    expect((await repo.listEntriesBetween('2026-10-05', '2026-10-05')).filter((e) => e.id === 't1')).toHaveLength(1)
  })
})
