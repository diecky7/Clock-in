import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetDbForTests } from '../data/db'
import * as repo from '../data/repo'
import Places from './Places'

beforeEach(async () => {
  await resetDbForTests()
})

describe('Places', () => {
  it('says so when there are no recent addresses', async () => {
    render(<Places />)
    expect(await screen.findByText('No addresses yet')).toBeInTheDocument()
  })

  it('hides the map apps until the address is tapped, then offers all three', async () => {
    await repo.addRecentPlace({ lat: 42.28, lon: -71.41, label: '12 Main St, Framingham, MA' })
    const user = userEvent.setup()
    render(<Places />)
    expect(await screen.findByText('12 Main St, Framingham, MA')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Waze' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Directions to 12 Main St, Framingham, MA' }))
    expect(screen.getByRole('dialog', { name: 'Directions to 12 Main St, Framingham, MA' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apple Maps' })).toHaveAttribute('href', expect.stringContaining('maps.apple.com/?daddr=42.28,-71.41'))
    expect(screen.getByRole('link', { name: 'Google Maps' })).toHaveAttribute('href', expect.stringContaining('destination=42.28,-71.41'))
    expect(screen.getByRole('link', { name: 'Waze' })).toHaveAttribute('href', expect.stringContaining('ll=42.28,-71.41&navigate=yes'))
  })

  it('lists two spellings of one address once, in short form', async () => {
    await repo.saveEmployer({ id: 'e', name: 'A', overtimeEnabled: false, archived: false, rates: [{ from: '2025-01-01', cents: 3000 }] })
    await repo.saveEntry({
      id: 't', employerId: 'e', start: '2025-10-06T07:00', end: '2025-10-06T15:00', breakMin: 0, rateCents: 3000,
      place: { lat: 1, lon: 2, label: '12 Main Street, Framingham, Massachusetts' },
    })
    await repo.addRecentPlace({ lat: 1, lon: 2, label: '12 Main St, Framingham, MA' })
    render(<Places />)
    expect(await screen.findAllByText('12 Main St, Framingham, MA')).toHaveLength(1)
    expect(screen.queryByText(/Massachusetts/)).not.toBeInTheDocument()
  })

  it('Cancel and Escape close the box', async () => {
    await repo.addRecentPlace({ lat: 1, lon: 2, label: 'Somewhere' })
    const user = userEvent.setup()
    render(<Places />)
    const open = await screen.findByRole('button', { name: 'Directions to Somewhere' })
    await user.click(open)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(open).toHaveFocus()
    await user.click(open)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps every address ever used, not just the latest few, and merges places from past entries', async () => {
    for (let n = 1; n <= 12; n++) await repo.addRecentPlace({ lat: 42 + n / 1000, lon: -71, label: `${n} Oak St, Boston, MA` })
    await repo.saveEmployer({ id: 'e', name: 'A', overtimeEnabled: false, archived: false, rates: [{ from: '2025-01-01', cents: 3000 }] })
    await repo.saveEntry({
      id: 't', employerId: 'e', start: '2025-10-06T07:00', end: '2025-10-06T15:00', breakMin: 0, rateCents: 3000,
      place: { lat: 41, lon: -71, label: '9 Old Rd, Worcester, MA' },
    })
    render(<Places />)
    expect(await screen.findByText('1 Oak St, Boston, MA')).toBeInTheDocument()
    expect(screen.getByText('12 Oak St, Boston, MA')).toBeInTheDocument()
    expect(screen.getByText('9 Old Rd, Worcester, MA')).toBeInTheDocument()
  })

  it('filters a long list with the search box', async () => {
    const user = userEvent.setup()
    for (let n = 1; n <= 8; n++) await repo.addRecentPlace({ lat: 42, lon: -71 - n / 1000, label: `${n} Pine Ave, Salem, MA` })
    await repo.addRecentPlace({ lat: 41, lon: -70, label: '5 Beach Rd, Cape Cod, MA' })
    render(<Places />)
    await user.type(await screen.findByLabelText('Search addresses'), 'beach')
    expect(screen.getByText('5 Beach Rd, Cape Cod, MA')).toBeInTheDocument()
    expect(screen.queryByText('1 Pine Ave, Salem, MA')).not.toBeInTheDocument()
  })

  it('copies the full abbreviated address', async () => {
    await repo.addRecentPlace({ lat: 1, lon: 2, label: '12 Main Street, Framingham, Massachusetts' })
    const user = userEvent.setup()
    render(<Places />)
    await user.click(await screen.findByRole('button', { name: /^Copy address/ }))
    expect(await navigator.clipboard.readText()).toBe('12 Main St, Framingham, MA')
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })

  it('shows everything known about an address in the box, with a captioned icon per map app and copy buttons', async () => {
    await repo.saveEmployer({ id: 'e', name: 'Acme', overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 3000 }] })
    const place = {
      lat: 42.28,
      lon: -71.41,
      label: '12 Main St, Framingham, MA 01702',
      detail: { number: '12', street: 'Main Street', city: 'Framingham', county: 'Middlesex County', state: 'Massachusetts', zip: '01702', country: 'United States', accuracyM: 5, kind: 'residential' },
    }
    await repo.addRecentPlace(place)
    for (const [id, day] of [['a', '05'], ['b', '06']])
      await repo.saveEntry({ id, employerId: 'e', start: `2026-10-${day}T07:00`, end: `2026-10-${day}T15:00`, breakMin: 0, rateCents: 3000, place })
    const user = userEvent.setup()
    render(<Places />)
    await user.click(await screen.findByRole('button', { name: /^Directions to/ }))
    const box = screen.getByRole('dialog')
    expect(within(box).getByRole('link', { name: 'Waze' })).toBeInTheDocument()
    expect(within(box).getByText('Waze')).toBeInTheDocument() // short caption under the icon
    expect(within(box).getByText('Apple')).toBeInTheDocument()
    expect(within(box).getByText('Middlesex County')).toBeInTheDocument()
    expect(within(box).getByText('12 Main Street, Framingham, Massachusetts 01702, United States')).toBeInTheDocument() // full, spelled out
    expect(within(box).getByText('Main Street')).toBeInTheDocument()
    expect(within(box).getByText('Residential street')).toBeInTheDocument()
    expect(within(box).getByText('42.280000')).toBeInTheDocument()
    expect(within(box).getByText('±16 ft')).toBeInTheDocument()
    expect((await within(box).findAllByText('Times worked')).length).toBeGreaterThan(0)
    expect(within(box).getAllByText('16.0 h').length).toBeGreaterThan(0)
    expect(within(box).getByText('Acme')).toBeInTheDocument()
    expect(within(box).queryByText('Employers', { selector: 'dt' })).not.toBeInTheDocument() // no repeated row in the summary
    await user.click(within(box).getByRole('button', { name: 'Copy coordinates' }))
    expect(await navigator.clipboard.readText()).toBe('42.28000, -71.41000')
    await user.click(within(box).getByRole('button', { name: 'Copy address' }))
    expect(await navigator.clipboard.readText()).toBe('12 Main St, Framingham, MA 01702')
  })

  it('lists every employer that worked at the address in expandable sections', async () => {
    const mk = (id: string, name: string) => ({ id, name, overtimeEnabled: false, archived: false, rates: [{ from: '2026-01-01', cents: 3000 }] })
    await repo.saveEmployer(mk('a', 'Acme'))
    await repo.saveEmployer(mk('b', 'Bay Homes'))
    const place = { lat: 1, lon: 2, label: '5 Oak St, Salem, MA 01970' }
    await repo.addRecentPlace(place)
    const shift = (id: string, employerId: string, day: string, out: string) =>
      repo.saveEntry({ id, employerId, start: `2026-10-${day}T07:00`, end: `2026-10-${day}T${out}`, breakMin: 0, rateCents: 3000, place })
    await shift('1', 'a', '05', '15:00') // 8 h
    await shift('2', 'b', '07', '11:00') // 4 h
    await shift('3', 'b', '08', '11:00') // 4 h
    const user = userEvent.setup()
    render(<Places />)
    await user.click(await screen.findByRole('button', { name: /^Directions to/ }))
    const box = screen.getByRole('dialog')
    const acme = (await within(box).findByText('Acme')).closest('details') as HTMLElement
    const bay = within(box).getByText('Bay Homes').closest('details') as HTMLElement
    expect(within(box).getAllByText('Times worked')[0].nextSibling).toHaveTextContent('3') // summary row, above the employers
    await user.click(within(bay).getByText('Bay Homes'))
    expect(bay).toHaveProperty('open', true)
    expect(acme).toHaveProperty('open', false)
    expect(within(bay).getByText('8.0 h')).toBeInTheDocument()
  })
})
