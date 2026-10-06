import type { Place } from '../domain/types'

/** Links that open the native iPhone apps (universal links; fall back to the web if the app is missing). */
export function directionLinks(p: Place): { name: string; href: string }[] {
  const ll = `${p.lat},${p.lon}`
  return [
    { name: 'Apple Maps', href: `https://maps.apple.com/?daddr=${ll}&q=${encodeURIComponent(p.label)}&dirflg=d` },
    { name: 'Google Maps', href: `https://www.google.com/maps/dir/?api=1&destination=${ll}` },
    { name: 'Waze', href: `https://waze.com/ul?ll=${ll}&navigate=yes` },
  ]
}
