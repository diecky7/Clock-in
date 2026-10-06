import { useEffect, useRef, useState } from 'react'
import Modal from '../components/Modal'
import { CopyIcon, FoldedMapIcon, NavArrowIcon, RoutePinIcon } from '../components/icons'
import { Screen, inputCls } from '../components/ui'
import * as repo from '../data/repo'
import { abbreviateStreet, copyText, decimalCoords, dmsCoords, kindLabel, shortAddress, stateCode } from '../location/address'
import { directionLinks } from '../location/directions'
import { formatDate, formatHours } from '../domain/time'
import type { Employer, Place } from '../domain/types'

const APP_ICON = { 'Apple Maps': FoldedMapIcon, 'Google Maps': RoutePinIcon, Waze: NavArrowIcon } as const

type Row = [label: string, value: string | undefined]

function Group({ title, rows }: { title: string; rows: Row[] }) {
  const shown = rows.filter((r): r is [string, string] => Boolean(r[1]))
  if (shown.length === 0) return null
  return (
    <section aria-label={title}>
      <h2 className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-muted">{title}</h2>
      <dl className="divide-y divide-border overflow-hidden rounded-2xl bg-bg">
        {shown.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 px-3 py-2.5 text-sm">
            <dt className="shrink-0 text-muted">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function DirectionsDialog({ place, employers, onClose }: { place: Place; employers: Employer[]; onClose: () => void }) {
  const first = useRef<HTMLAnchorElement>(null)
  const [history, setHistory] = useState<repo.PlaceHistory | null>(null)
  const [copied, setCopied] = useState<'' | 'address' | 'coords'>('')

  useEffect(() => {
    let alive = true
    void repo
      .placeHistory(place.label)
      .then((h) => alive && setHistory(h))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [place.label])

  async function copy(kind: 'address' | 'coords') {
    const text = kind === 'address' ? shortAddress(place.label) : decimalCoords(place.lat, place.lon)
    if (await copyText(text)) {
      setCopied(kind)
      setTimeout(() => setCopied(''), 1800)
    }
  }

  const d = place.detail ?? {}
  const names = new Map(employers.map((e) => [e.id, e.name]))
  const btn = 'min-h-12 rounded-full border border-border bg-bg px-4 text-sm font-medium'

  return (
    <Modal label={`Directions to ${place.label}`} initialFocus={first} onClose={onClose}>
        <p className="px-2 pb-3 pt-1 text-center text-base font-medium">{place.label}</p>

        <div className="grid grid-cols-3 gap-2">
          {directionLinks(place).map((l, i) => {
            const Icon = APP_ICON[l.name]
            return (
              <a
                key={l.name}
                ref={i === 0 ? first : undefined}
                href={l.href}
                onClick={onClose}
                aria-label={l.name}
                className="grid h-16 place-content-center justify-items-center gap-1 rounded-2xl bg-bg"
              >
                <Icon />
                <span className="text-[11px] leading-none text-muted">{l.name.split(' ')[0]}</span>
              </a>
            )
          })}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className={btn} onClick={() => void copy('address')}>
            {copied === 'address' ? 'Copied' : 'Copy address'}
          </button>
          <button type="button" className={btn} onClick={() => void copy('coords')}>
            {copied === 'coords' ? 'Copied' : 'Copy coordinates'}
          </button>
        </div>

        <Group
          title="Address"
          rows={[
            ['Place', d.name],
            ['Number', d.number],
            ['Street', d.street ? abbreviateStreet(d.street) : undefined],
            ['Neighborhood', d.neighborhood],
            ['City', d.city],
            ['County', d.county],
            ['State', d.state ? stateCode(d.state) : undefined],
            ['ZIP code', d.zip],
            ['Country', d.country],
            ['Type', kindLabel(d.kind) || undefined],
          ]}
        />
        <Group
          title="Location"
          rows={[
            ['Latitude', place.lat.toFixed(6)],
            ['Longitude', place.lon.toFixed(6)],
            ['Degrees', dmsCoords(place.lat, place.lon)],
            ['GPS accuracy', d.accuracyM !== undefined ? `±${Math.round(d.accuracyM * 3.28084)} ft` : undefined],
          ]}
        />
        {history && history.times > 0 && (
          <Group
            title="Your work here"
            rows={[
              ['Times worked', String(history.times)],
              ['Total hours', `${formatHours(history.minutes)} h`],
              ['First time', history.first ? formatDate(history.first) : undefined],
              ['Last time', history.last ? formatDate(history.last) : undefined],
              ['Employers', history.employerIds.map((id) => names.get(id) ?? 'Employer').join(', ')],
            ]}
          />
        )}

        <button type="button" className="mt-3 min-h-12 w-full text-base text-muted" onClick={onClose}>
          Close
        </button>
    </Modal>
  )
}

export default function Places() {
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [employers, setEmployers] = useState<Employer[]>([])
  const [picked, setPicked] = useState<Place | null>(null)
  const [filter, setFilter] = useState('')
  const [copied, setCopied] = useState('')

  async function copy(p: Place) {
    if (await copyText(shortAddress(p.label))) {
      setCopied(p.label)
      setTimeout(() => setCopied((c) => (c === p.label ? '' : c)), 1800)
    }
  }

  useEffect(() => {
    let alive = true
    void Promise.all([repo.listAllPlaces(), repo.listEmployers()])
      .then(([all, emps]) => {
        if (!alive) return
        setPlaces(all)
        setEmployers(emps)
      })
      .catch(() => alive && setPlaces([]))
    return () => {
      alive = false
    }
  }, [])

  const q = filter.trim().toLowerCase()
  const shown = (places ?? []).filter((p) => !q || shortAddress(p.label).toLowerCase().includes(q))

  return (
    <Screen title="Places" back="/">
      {places && places.length > 6 && (
        <input
          type="search"
          aria-label="Search addresses"
          placeholder="Search addresses"
          className={inputCls}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      {places && places.length === 0 && <p className="mt-8 text-center text-muted">No addresses yet</p>}
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl bg-surface">
        {shown.map((p) => (
          <li key={`${p.label}-${p.lat}-${p.lon}`} className="flex min-h-16 items-center gap-1 py-2 pl-4 pr-2">
            <button
              type="button"
              aria-label={`Directions to ${p.label}`}
              className="min-h-11 flex-1 text-left"
              onClick={() => setPicked(p)}
            >
              {p.label}
            </button>
            <button
              type="button"
              aria-label={`Copy address: ${p.label}`}
              onClick={() => void copy(p)}
              className="grid size-11 shrink-0 place-items-center rounded-full"
            >
              {copied === p.label ? <span className="text-xs font-medium">Copied</span> : <CopyIcon />}
            </button>
          </li>
        ))}
      </ul>
      {places && places.length > 0 && shown.length === 0 && <p className="mt-6 text-center text-muted">No matches</p>}
      {picked && <DirectionsDialog place={picked} employers={employers} onClose={() => setPicked(null)} />}
    </Screen>
  )
}
