import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import MoneyInput from './MoneyInput'

function Harness() {
  const [cents, setCents] = useState<number | null>(null)
  return (
    <>
      <label htmlFor="m">Amount</label>
      <MoneyInput id="m" cents={cents} onChange={setCents} />
      <output>{String(cents)}</output>
    </>
  )
}

describe('MoneyInput', () => {
  it('fills digits from the right like a cash register', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByLabelText('Amount')
    await user.type(input, '1')
    expect(input).toHaveValue('$0.01')
    await user.type(input, '2')
    expect(input).toHaveValue('$0.12')
    await user.type(input, '5')
    expect(input).toHaveValue('$1.25')
    await user.type(input, '000')
    expect(input).toHaveValue('$1,250.00')
    expect(screen.getByRole('status')).toHaveTextContent('125000')
  })

  it('backspace drops the last digit, ignores letters, and clearing empties it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const input = screen.getByLabelText('Amount')
    await user.type(input, '1a2b5')
    expect(input).toHaveValue('$1.25')
    await user.type(input, '{Backspace}')
    expect(input).toHaveValue('$0.12')
    await user.clear(input)
    expect(input).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('null')
  })
})
