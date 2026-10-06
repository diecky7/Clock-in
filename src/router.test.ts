import { describe, expect, it } from 'vitest'
import { parseHash } from './router'

describe('parseHash', () => {
  it('matches literal and parameterised routes', () => {
    expect(parseHash('')).toEqual({ path: '/', params: {} })
    expect(parseHash('#/entry/new')).toEqual({ path: '/entry/new', params: {} })
    expect(parseHash('#/entry/abc')).toEqual({ path: '/entry/:id', params: { id: 'abc' } })
    expect(parseHash('#/settings/employer/e1')).toEqual({ path: '/settings/employer/:id', params: { id: 'e1' } })
  })
  it('exposes query parameters', () => {
    expect(parseHash('#/export?week=2026-10-04')).toEqual({ path: '/export', params: { week: '2026-10-04' } })
  })
  it('falls back to home for unknown routes', () => {
    expect(parseHash('#/nope/what')).toEqual({ path: '/', params: {} })
  })
  it('knows the recent places route', () => {
    expect(parseHash('#/places')).toEqual({ path: '/places', params: {} })
  })
})
