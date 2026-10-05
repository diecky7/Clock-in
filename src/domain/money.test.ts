import { describe, it, expect } from 'vitest'
import { formatUSD, parseUSD } from './money'
describe('money', () => {
  it('formats', () => { expect(formatUSD(123456)).toBe('$1,234.56') })
  it('parses', () => {
    expect(parseUSD('175.50')).toBe(17550)
    expect(parseUSD('abc')).toBeNull()
    expect(parseUSD('0')).toBeNull()
  })
})
