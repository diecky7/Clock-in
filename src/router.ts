import { useSyncExternalStore } from 'react'

export interface Route {
  path: string
  params: Record<string, string>
}

const PATTERNS = [
  '/',
  '/entry/new',
  '/entry/:id',
  '/expense/new',
  '/expense/:id',
  '/settings',
  '/settings/employer/:id',
  '/settings/schedule',
  '/export',
  '/places',
  '/summary',
]

export function parseHash(hash: string): Route {
  const [rawPath, rawQuery = ''] = hash.replace(/^#/, '').split('?')
  const path = rawPath || '/'
  const query = Object.fromEntries(new URLSearchParams(rawQuery))
  const segs = path.split('/').filter(Boolean)
  for (const pattern of PATTERNS) {
    const pat = pattern.split('/').filter(Boolean)
    if (pat.length !== segs.length) continue
    const params: Record<string, string> = {}
    let ok = true
    pat.forEach((p, i) => {
      if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segs[i])
      else if (p !== segs[i]) ok = false
    })
    // literal routes (e.g. /entry/new) are listed before their :id twin
    if (ok) return { path: pattern, params: { ...query, ...params } }
  }
  return { path: '/', params: query }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const snapshot = () => window.location.hash

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, snapshot, () => '')
  return parseHash(hash)
}

export function navigate(path: string): void {
  window.location.hash = path
}
