import type { Place, PlaceDetail } from '../domain/types'
import { formatParts, shortAddress, zip5 } from './address'

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
  postcode?: string
  district?: string
  suburb?: string
  neighbourhood?: string
  county?: string
  country?: string
  osm_value?: string
  type?: string
}

function buildDetail(p: Parts, kind?: string): PlaceDetail {
  const d: PlaceDetail = {
    name: p.name,
    number: p.housenumber ?? p.house_number,
    street: p.street ?? p.road,
    neighborhood: p.neighbourhood ?? p.suburb ?? p.district,
    city: p.city ?? p.town ?? p.village,
    county: p.county,
    state: p.state,
    zip: zip5(p.postcode) || undefined,
    country: p.country,
    kind: kind ?? p.osm_value ?? p.type,
  }
  // Drop empty fields so saved places stay small.
  return Object.fromEntries(Object.entries(d).filter(([, v]) => v)) as PlaceDetail
}

/** "1 City Hall Plz, Boston, MA 02201" — street first (or the place name), city, state and ZIP. */
function buildLabel(p: Parts): string {
  return formatParts({
    name: p.name,
    number: p.housenumber ?? p.house_number,
    street: p.street ?? p.road,
    city: p.city ?? p.town ?? p.village,
    state: p.state,
    postcode: p.postcode,
  })
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
      detail: buildDetail(f.properties),
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
  const data = (await res.json()) as { display_name?: string; address?: Parts; name?: string; type?: string }
  const structured = data.address ? buildLabel(data.address) : ''
  const detail = data.address ? buildDetail({ ...data.address, name: data.address.name ?? data.name }, data.type) : {}
  return {
    lat,
    lon,
    label: structured || (data.display_name && shortAddress(data.display_name)) || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    ...(Object.keys(detail).length ? { detail } : {}),
  }
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
