import { describe, expect, it } from 'vitest'
import { defaultEmployerId } from './employers'
import type { Employer } from './types'

const e = (id: string, archived = false) => ({ id, name: id, archived, overtimeEnabled: false, rates: [] }) as Employer

describe('defaultEmployerId', () => {
  it('prefers the last used employer, else the first active one', () => {
    const all = [e('a'), e('b'), e('c', true)]
    expect(defaultEmployerId(all, 'b')).toBe('b')
    expect(defaultEmployerId(all)).toBe('a')
    expect(defaultEmployerId(all, 'c')).toBe('a') // archived: not offered
    expect(defaultEmployerId(all, 'gone')).toBe('a')
    expect(defaultEmployerId([])).toBe('')
  })
})
