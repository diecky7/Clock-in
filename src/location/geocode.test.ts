import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCurrentPosition, reverseGeocode, searchAddress } from './geocode'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(body: unknown, ok = true) {
  const f = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body })
  vi.stubGlobal('fetch', f)
  return f
}

describe('searchAddress', () => {
  it('queries Photon with q, limit=5 and lang=en and maps results to places', async () => {
    const f = mockFetch({
      features: [
        {
          geometry: { coordinates: [-71.0589, 42.3601] },
          properties: { housenumber: '1', street: 'City Hall Plaza', city: 'Boston', state: 'Massachusetts', postcode: '02201' },
        },
        { geometry: { coordinates: [-71.1, 42.4] }, properties: { name: 'Home Depot', city: 'Medford', state: 'Massachusetts' } },
      ],
    })
    const places = await searchAddress('1 city hall')
    const url = new URL(f.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/')
    expect(url.searchParams.get('q')).toBe('1 city hall')
    expect(url.searchParams.get('limit')).toBe('5')
    expect(url.searchParams.get('lang')).toBe('en')
    expect(places).toEqual([
      {
        lat: 42.3601,
        lon: -71.0589,
        label: '1 City Hall Plz, Boston, MA 02201',
        detail: { number: '1', street: 'City Hall Plaza', city: 'Boston', state: 'Massachusetts', zip: '02201' },
      },
      { lat: 42.4, lon: -71.1, label: 'Home Depot, Medford, MA', detail: { name: 'Home Depot', city: 'Medford', state: 'Massachusetts' } },
    ])
  })

  it('returns [] for a blank query without calling fetch', async () => {
    const f = mockFetch({ features: [] })
    expect(await searchAddress('   ')).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })

  it('throws when the request fails', async () => {
    mockFetch({}, false)
    await expect(searchAddress('x')).rejects.toThrow()
  })
})

describe('reverseGeocode', () => {
  it('maps a Nominatim reply to a place', async () => {
    const f = mockFetch({
      lat: '42.3601',
      lon: '-71.0589',
      display_name: 'Boston City Hall, 1, City Hall Plaza, Boston, Massachusetts, USA',
      address: { house_number: '1', road: 'City Hall Plaza', city: 'Boston', state: 'Massachusetts', postcode: '02201-1234' },
    })
    const p = await reverseGeocode(42.36, -71.058)
    const url = new URL(f.mock.calls[0][0] as string)
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/reverse')
    expect(url.searchParams.get('format')).toBe('jsonv2')
    expect(url.searchParams.get('lat')).toBe('42.36')
    expect(p).toEqual({
      lat: 42.36,
      lon: -71.058,
      label: '1 City Hall Plz, Boston, MA 02201',
      detail: { number: '1', street: 'City Hall Plaza', city: 'Boston', state: 'Massachusetts', zip: '02201' },
    })
  })

  it('falls back to display_name when the address is not structured', async () => {
    mockFetch({ display_name: 'Somewhere, USA', address: {} })
    expect((await reverseGeocode(1, 2)).label).toBe('Somewhere, USA')
  })
})

describe('getCurrentPosition', () => {
  it('requests high accuracy with a 10 s timeout', async () => {
    const get = vi.fn((ok: PositionCallback, _err?: unknown, _opts?: unknown) => ok({ coords: { latitude: 1, longitude: 2, accuracy: 5 } } as GeolocationPosition))
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: get } })
    expect(await getCurrentPosition()).toEqual({ lat: 1, lon: 2, accuracyM: 5 })
    expect(get.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, timeout: 10000 })
  })

  it('rejects when geolocation is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    await expect(getCurrentPosition()).rejects.toThrow()
  })
})
