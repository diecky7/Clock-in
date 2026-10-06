import { render, screen } from '@testing-library/react'
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

  it('lists recent addresses with Apple Maps, Google Maps and Waze links', async () => {
    await repo.addRecentPlace({ lat: 42.28, lon: -71.41, label: '12 Main St, Framingham, MA' })
    render(<Places />)
    expect(await screen.findByText('12 Main St, Framingham, MA')).toBeInTheDocument()
    const apple = screen.getByRole('link', { name: /Apple Maps/ })
    expect(apple).toHaveAttribute('href', expect.stringContaining('maps.apple.com/?daddr=42.28,-71.41'))
    expect(screen.getByRole('link', { name: /Google Maps/ })).toHaveAttribute('href', expect.stringContaining('destination=42.28,-71.41'))
    expect(screen.getByRole('link', { name: /Waze/ })).toHaveAttribute('href', expect.stringContaining('ll=42.28,-71.41&navigate=yes'))
  })
})
