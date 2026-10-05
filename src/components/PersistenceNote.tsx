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
    <aside aria-label="Storage notice" className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-30 mx-auto max-w-md rounded-2xl bg-surface p-4 text-sm shadow-lg">
      <p>iOS may clear this app's data if storage runs low. Export a backup regularly in Settings.</p>
      <button
        type="button"
        className="mt-2 min-h-11 rounded-full px-4 font-medium"
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
