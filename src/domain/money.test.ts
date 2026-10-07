import { describe, it, expect } from 'vitest'
import { formatUSD } from './money'
describe('money', () => {
  it('formats', () => { expect(formatUSD(123456)).toBe('$1,234.56') })
})
