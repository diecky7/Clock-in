import { useEffect, useState } from 'react'
import { requestPersistence } from '../data/images'

const KEY = 'persistence-note-dismissed'

function dismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Asks iOS to keep our data; when it refuses, recommends regular backups. */
export default function PersistenceNote() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let alive = true
    void requestPersistence().then((ok) => {
      if (alive && !ok && !dismissed()) setShow(true)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!show) return null
  return (
    <aside aria-label="Storage notice" className="mt-2 flex items-center gap-3 rounded-2xl bg-surface py-1 pl-4 pr-1 text-sm">
      <p className="flex-1 py-2">iOS may clear this app's data if storage runs low. Export a backup regularly in Settings.</p>
      <button
        type="button"
        className="min-h-11 shrink-0 rounded-full px-4 font-medium"
        onClick={() => {
          try {
            localStorage.setItem(KEY, '1')
          } catch {
            /* storage unavailable: the note just comes back next launch */
          }
          setShow(false)
        }}
      >
        Got it
      </button>
    </aside>
  )
}
