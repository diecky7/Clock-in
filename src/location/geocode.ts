import type { Place } from '../domain/types'

const PHOTON = 'https://photon.komoot.io/api/'
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse'

interface Parts {
  name?: string
  housenumber?: string
  house_number?: string
  street?: string
  road?: string
  city?: string
  town?: string
  village?: string
  state?: string
}

/** "1 City Hall Plaza, Boston, Massachusetts" — street first, then place name, city, state. */
function buildLabel(p: Parts): string {
  const number = p.housenumber ?? p.house_number
  const street = p.street ?? p.road
  const line = street ? (number ? `${number} ${street}` : street) : undefined
  const city = p.city ?? p.town ?? p.village
  return [line ?? p.name, city, p.state].filter(Boolean).join(', ')
}

export async function searchAddress(q: string, signal?: AbortSignal): Promise<Place[]> {
  if (!q.trim()) return []
  const url = new URL(PHOTON)
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '5')
  url.searchParams.set('lang', 'en')
  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error(`Address search failed (${res.status})`)
  const data = (await res.json()) as {
    features?: { geometry: { coordinates: [number, number] }; properties: Parts }[]
  }
  return (data.features ?? [])
    .map((f) => ({
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      label: buildLabel(f.properties) || f.properties.name || '',
    }))
    .filter((p) => p.label)
}

export async function reverseGeocode(lat: number, lon: number): Promise<Place> {
  const url = new URL(NOMINATIM)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('accept-language', 'en')
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Reverse geocoding failed (${res.status})`)
  const data = (await res.json()) as { display_name?: string; address?: Parts }
  const structured = data.address ? buildLabel(data.address) : ''
  return { lat, lon, label: structured || data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}` }
}

export function getCurrentPosition(): Promise<{ lat: number; lon: number; accuracyM: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracyM: pos.coords.accuracy }),
      (err) => reject(new Error(err.message || 'Location denied')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  })
}
