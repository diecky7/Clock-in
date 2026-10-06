import { useEffect, useRef, useState } from 'react'
import { ArrowIcon, CopyIcon } from '../components/icons'
import { Screen, inputCls } from '../components/ui'
import * as repo from '../data/repo'
import { copyText, shortAddress } from '../location/address'
import { directionLinks } from '../location/directions'
import type { Place } from '../domain/types'

function DirectionsDialog({ place, onClose }: { place: Place; onClose: () => void }) {
  const first = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Directions to ${place.label}`}
        className="w-full max-w-sm space-y-2 rounded-3xl border border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-2 pb-2 pt-1 text-center text-sm text-muted">{place.label}</p>
        {directionLinks(place).map((l, i) => (
          <a
            key={l.name}
            ref={i === 0 ? first : undefined}
            href={l.href}
            onClick={onClose}
            className="grid min-h-14 place-items-center rounded-2xl bg-bg text-lg font-medium"
          >
            {l.name}
          </a>
        ))}
        <button type="button" className="min-h-12 w-full text-base text-muted" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function Places() {
  const [places, setPlaces] = useState<Place[] | null>(null)
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
    void repo
      .listAllPlaces()
      .then((all) => alive && setPlaces(all))
      .catch(() => alive && setPlaces([]))
    return () => {
      alive = false
    }
  }, [])

  const q = filter.trim().toLowerCase()
  const shown = (places ?? []).filter((p) => !q || p.label.toLowerCase().includes(q))

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
          <li key={`${p.label}-${p.lat}-${p.lon}`} className="flex min-h-16 items-center gap-3 py-2 pl-4 pr-2">
            <p className="flex-1">{p.label}</p>
            <button
              type="button"
              aria-label={`Copy address: ${p.label}`}
              onClick={() => void copy(p)}
              className="grid size-11 shrink-0 place-items-center rounded-full"
            >
              {copied === p.label ? <span className="text-xs font-medium">Copied</span> : <CopyIcon />}
            </button>
            <button
              type="button"
              aria-label={`Directions to ${p.label}`}
              onClick={() => setPicked(p)}
              className="grid size-11 shrink-0 place-items-center rounded-full"
            >
              <ArrowIcon />
            </button>
          </li>
        ))}
      </ul>
      {places && places.length > 0 && shown.length === 0 && <p className="mt-6 text-center text-muted">No matches</p>}
      {picked && <DirectionsDialog place={picked} onClose={() => setPicked(null)} />}
    </Screen>
  )
}
