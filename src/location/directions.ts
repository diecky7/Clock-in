import type { Place } from '../domain/types'
import { shortAddress } from './address'

/** Links that open the native iPhone apps (universal links; fall back to the web if the app is missing). */
export function directionLinks(p: Place): { name: 'Apple Maps' | 'Google Maps' | 'Waze'; href: string }[] {
  const ll = `${p.lat},${p.lon}`
  return [
    { name: 'Apple Maps', href: `https://maps.apple.com/?daddr=${ll}&q=${encodeURIComponent(shortAddress(p.label))}&dirflg=d` },
    { name: 'Google Maps', href: `https://www.google.com/maps/dir/?api=1&destination=${ll}` },
    { name: 'Waze', href: `https://waze.com/ul?ll=${ll}&navigate=yes` },
  ]
}
