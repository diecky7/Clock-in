import { useEffect, useState } from 'react'
import { Screen } from '../components/ui'
import * as repo from '../data/repo'
import { directionLinks } from '../location/directions'
import type { Place } from '../domain/types'

export default function Places() {
  const [places, setPlaces] = useState<Place[] | null>(null)

  useEffect(() => {
    let alive = true
    void repo
      .getSettings()
      .then((s) => alive && setPlaces(s.recentPlaces))
      .catch(() => alive && setPlaces([]))
    return () => {
      alive = false
    }
  }, [])

  return (
    <Screen title="Recent places" back="/">
      {places && places.length === 0 && <p className="mt-8 text-center text-muted">No addresses yet</p>}
      <ul className="mt-2 space-y-3">
        {(places ?? []).map((p) => (
          <li key={`${p.label}-${p.lat}-${p.lon}`} className="rounded-2xl bg-surface p-4">
            <p>{p.label}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {directionLinks(p).map((l) => (
                <a
                  key={l.name}
                  href={l.href}
                  aria-label={`${l.name}: ${p.label}`}
                  className="grid min-h-11 place-items-center whitespace-nowrap rounded-full border border-border bg-bg px-1 text-center text-[13px] font-medium"
                >
                  {l.name}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Screen>
  )
}
