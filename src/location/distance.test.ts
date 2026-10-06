import { describe, expect, it } from 'vitest'
import { distanceFt, formatDistance, nearestWithin } from './distance'

const a = { lat: 42.36, lon: -71.05, label: 'A' }

describe('distance', () => {
  it('is zero for the same point and about 364,000 ft per degree of latitude', () => {
    expect(distanceFt(a, a)).toBe(0)
    expect(distanceFt({ lat: 42, lon: -71 }, { lat: 43, lon: -71 })).toBeGreaterThan(363_000)
    expect(distanceFt({ lat: 42, lon: -71 }, { lat: 43, lon: -71 })).toBeLessThan(365_000)
  })

  it('formats feet below a fifth of a mile and miles above', () => {
    expect(formatDistance(312)).toBe('310 ft')
    expect(formatDistance(2640)).toBe('0.5 mi')
  })

  it('finds the closest place inside the limit, none outside, and is off at 0', () => {
    const near = { lat: 42.3605, lon: -71.05, label: 'near' } // ~180 ft
    const far = { lat: 42.37, lon: -71.05, label: 'far' }
    expect(nearestWithin(a, [far, near], 500)?.place.label).toBe('near')
    expect(nearestWithin(a, [far], 500)).toBeNull()
    expect(nearestWithin(a, [near], 0)).toBeNull()
  })
})
