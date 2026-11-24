import { useEffect, useState } from 'react'
import { requestPersistence } from '../data/images'
import { saveBackup } from '../data/saveBackup'

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
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    void requestPersistence().then((ok) => {
      if (alive && !ok && !dismissed()) setShow(true)
    })
    return () => {
      alive = false
    }
  }, [])

  async function backUp() {
    setFailed(false)
    try {
      await saveBackup()
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') setFailed(true)
    }
  }

  if (!show) return null
  const btn = 'min-h-11 shrink-0 rounded-full px-4 font-medium'
  return (
    <aside aria-label="Storage notice" className="mt-2 rounded-2xl bg-surface pl-4 pr-1 pt-3 text-sm">
      <p>iOS may clear this app's data if storage runs low.</p>
      {failed && (
        <p role="alert" className="mt-1 text-danger">
          Couldn't create the backup.
        </p>
      )}
      <div className="flex justify-end">
        <button type="button" className={btn} onClick={() => void backUp()}>
          Back up now
        </button>
        <button
          type="button"
          className={`${btn} text-muted`}
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
      </div>
    </aside>
  )
}
