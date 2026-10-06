import { render, screen } from '@testing-library/react'
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

  it('hides the map apps until the arrow is tapped, then offers all three', async () => {
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

  it('Cancel and Escape close the box', async () => {
    await repo.addRecentPlace({ lat: 1, lon: 2, label: 'Somewhere' })
    const user = userEvent.setup()
    render(<Places />)
    const open = await screen.findByRole('button', { name: 'Directions to Somewhere' })
    await user.click(open)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
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
})
