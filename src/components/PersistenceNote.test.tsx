import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestPersistence } from '../data/images'
import PersistenceNote from './PersistenceNote'

vi.mock('../data/images', () => ({ requestPersistence: vi.fn() }))

beforeEach(() => localStorage.clear())

describe('PersistenceNote', () => {
  it('stays hidden when persistence is granted', async () => {
    vi.mocked(requestPersistence).mockResolvedValue(true)
    render(<PersistenceNote />)
    await Promise.resolve()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('recommends backups when refused, and can be dismissed for good', async () => {
    vi.mocked(requestPersistence).mockResolvedValue(false)
    const user = userEvent.setup()
    const first = render(<PersistenceNote />)
    await user.click(await screen.findByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    first.unmount()
    render(<PersistenceNote />)
    await Promise.resolve()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
