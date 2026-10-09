import { useEffect, useRef, useState } from 'react'
import Modal from '../components/Modal'
import { CopyIcon, FoldedMapIcon, NavArrowIcon, RoutePinIcon } from '../components/icons'
import { Screen, inputCls } from '../components/ui'
import * as repo from '../data/repo'
import { copyAddress, copyText, decimalCoords, dmsCoords, fullAddress, shortAddress } from '../location/address'
import { directionLinks } from '../location/directions'
import { reverseGeocode } from '../location/geocode'
import { formatDate, formatDuration } from '../domain/time'
import type { Employer, Place } from '../domain/types'

const APP_ICON = { 'Apple Maps': FoldedMapIcon, 'Google Maps': RoutePinIcon, Waze: NavArrowIcon } as const

type Row = [label: string, value: string | undefined]

function Group({ title, rows }: { title: string; rows: Row[] }) {
  const shown = rows.filter((r): r is [string, string] => Boolean(r[1]))
  if (shown.length === 0) return null
  return (
    <section aria-label={title} className="mt-4 overflow-hidden rounded-b-2xl rounded-t-md bg-bg">
      <h2 className="bg-title px-4 py-3 text-lg font-semibold text-title-fg">{title}</h2>
      <dl className="divide-y divide-border">
        {shown.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-3.5 text-base">
            <dt className="shrink-0 text-muted">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function DirectionsDialog({ place: saved, employers, onClose }: { place: Place; employers: Employer[]; onClose: () => void }) {
  const [place, setPlace] = useState(saved)
  const first = useRef<HTMLAnchorElement>(null)
  const [history, setHistory] = useState<repo.PlaceHistory | null>(null)
  const [copied, setCopied] = useState<'' | 'address' | 'coords'>('')

  // Addresses saved before details were kept: look them up once, show them in full and remember the result.
  useEffect(() => {
    if (saved.detail) return
    let alive = true
    void reverseGeocode(saved.lat, saved.lon)
      .then((r) => {
        if (!alive || !r.detail) return
        setPlace({ ...saved, detail: r.detail })
        return repo.savePlaceDetail(saved, r.detail)
      })
      .catch(() => undefined) // offline: keep what we have
    return () => {
      alive = false
    }
  }, [saved])

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
    const text = kind === 'address' ? copyAddress(place) : decimalCoords(place.lat, place.lon)
    if (await copyText(text)) {
      setCopied(kind)
      setTimeout(() => setCopied(''), 1800)
    }
  }

  const d = place.detail ?? {}
  const names = new Map(employers.map((e) => [e.id, e.name]))
  const btn = 'min-h-12 rounded-full border border-border bg-bg px-4 text-base font-medium'

  return (
    <Modal label={`Directions to ${place.label}`} initialFocus={first} onClose={onClose}>
        <p className="px-2 pb-4 pt-1 text-center text-xl font-semibold">{fullAddress(place)}</p>

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
          title="Location"
          rows={[
            ['Latitude', place.lat.toFixed(6)],
            ['Longitude', place.lon.toFixed(6)],
            ['Degrees', dmsCoords(place.lat, place.lon)],
            ['GPS accuracy', d.accuracyM !== undefined ? `±${Math.round(d.accuracyM * 3.28084)} ft` : undefined],
          ]}
        />
        {history && history.times > 0 && (
          <>
            <Group
              title="Your work here"
              rows={[
                ['Times worked', String(history.times)],
                ['Total hours', formatDuration(history.minutes)],
                ['First time', history.first ? formatDate(history.first) : undefined],
                ['Last time', history.last ? formatDate(history.last) : undefined],
              ]}
            />
            <section aria-label="Employers" className="mt-4 overflow-hidden rounded-b-2xl rounded-t-md bg-bg">
              <h2 className="bg-title px-4 py-3 text-lg font-semibold text-title-fg">Employers</h2>
              <div className="divide-y divide-border">
                {history.byEmployer.map((v) => (
                  <details key={v.employerId} className="group">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-base font-medium [&::-webkit-details-marker]:hidden">
                      <span>{names.get(v.employerId) ?? 'Employer'}</span>
                      <span aria-hidden className="text-muted transition-transform group-open:rotate-90">›</span>
                    </summary>
                    <dl className="divide-y divide-border border-t border-border text-base">
                      {(
                        [
                          ['Times worked', String(v.times)],
                          ['Total hours', formatDuration(v.minutes)],
                          ['First time', formatDate(v.first)],
                          ['Last time', formatDate(v.last)],
                        ] as const
                      ).map(([k, val]) => (
                        <div key={k} className="flex items-baseline justify-between gap-4 px-4 py-3.5">
                          <dt className="text-muted">{k}</dt>
                          <dd>{val}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ))}
              </div>
            </section>
          </>
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
