import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import type { Place } from '../domain/types'
import { reverseGeocode } from './geocode'

const STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const DEFAULT_CENTER: [number, number] = [-71.06, 42.36] // Boston

export default function MapPicker({
  value,
  onChange,
  fallback,
}: {
  value: Place | null
  onChange: (p: Place) => void
  /** Where the map opens (no pin) when there is no value yet, e.g. the last used address. */
  fallback?: Place | null
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const marker = useRef<maplibregl.Marker | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!box.current) return
    const start = value ?? fallback ?? null
    const m = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: start ? [start.lon, start.lat] : DEFAULT_CENTER,
      zoom: start ? 16 : 10,
      attributionControl: { compact: true },
    })
    map.current = m
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    async function pick(lat: number, lon: number) {
      try {
        onChangeRef.current(await reverseGeocode(lat, lon))
      } catch {
        // Offline or rate limited: keep the pin, label it with coordinates.
        onChangeRef.current({ lat, lon, label: `${lat.toFixed(5)}, ${lon.toFixed(5)}` })
      }
    }

    const pin = new maplibregl.Marker({ draggable: true, color: '#e11d48' })
    marker.current = pin
    if (value) pin.setLngLat([value.lon, value.lat]).addTo(m)
    pin.on('dragend', () => {
      const { lat, lng } = pin.getLngLat()
      void pick(lat, lng)
    })
    m.on('click', (e: maplibregl.MapMouseEvent) => {
      pin.setLngLat(e.lngLat).addTo(m)
      void pick(e.lngLat.lat, e.lngLat.lng)
    })

    return () => {
      m.remove()
      map.current = null
      marker.current = null
    }
    // The map is created once; later value changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const m = map.current
    const pin = marker.current
    if (!m || !pin || !value) return
    pin.setLngLat([value.lon, value.lat]).addTo(m)
    m.easeTo({ center: [value.lon, value.lat], zoom: Math.max(m.getZoom(), 15), duration: 400 })
  }, [value])

  return (
    <div
      ref={box}
      role="region"
      aria-label="Map. Tap or drag the pin to adjust the location"
      className="h-60 w-full overflow-hidden rounded-2xl bg-surface"
    />
  )
}
