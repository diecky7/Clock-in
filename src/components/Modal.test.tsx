import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import Modal from './Modal'

function Host() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Modal label="Test box" onClose={() => setOpen(false)}>
          <button type="button">One</button>
          <button type="button">Two</button>
        </Modal>
      )}
    </>
  )
}

describe('Modal', () => {
  it('focuses inside, wraps Tab, closes on Escape and restores focus', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await user.click(opener)
    expect(screen.getByRole('dialog', { name: 'Test box' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'One' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'One' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('closes on a backdrop click but not on a panel click', async () => {
    const user = userEvent.setup()
    render(<Host />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'One' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
