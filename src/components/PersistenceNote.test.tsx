import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestPersistence } from '../data/images'
import { saveBackup } from '../data/saveBackup'
import PersistenceNote from './PersistenceNote'

vi.mock('../data/images', () => ({ requestPersistence: vi.fn() }))
vi.mock('../data/saveBackup', () => ({ saveBackup: vi.fn() }))

beforeEach(() => localStorage.clear())

describe('PersistenceNote', () => {
  it('stays hidden when persistence is granted', async () => {
    vi.mocked(requestPersistence).mockResolvedValue(true)
    render(<PersistenceNote />)
    await Promise.resolve()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('recommends backups when refused, and can be dismissed for good', async () => {
    vi.mocked(requestPersistence).mockResolvedValue(false)
    const user = userEvent.setup()
    const first = render(<PersistenceNote />)
    expect(await screen.findByRole('complementary', { name: 'Storage notice' })).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    first.unmount()
    render(<PersistenceNote />)
    await Promise.resolve()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('Back up now makes the backup right there, and says so when it fails', async () => {
    vi.mocked(requestPersistence).mockResolvedValue(false)
    vi.mocked(saveBackup).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('nope'))
    const user = userEvent.setup()
    render(<PersistenceNote />)
    await user.click(await screen.findByRole('button', { name: 'Back up now' }))
    expect(saveBackup).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back up now' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't create the backup.")
  })
})
