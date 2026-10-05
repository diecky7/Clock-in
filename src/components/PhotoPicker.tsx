import { useEffect, useState } from 'react'
import { resizeImage } from '../data/images'
import * as repo from '../data/repo'
import { CameraIcon } from './icons'

function Thumb({ id, n, onRemove }: { id: string; n: number; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    let made: string | null = null
    void repo.getPhoto(id).then((blob) => {
      if (!alive || !blob || typeof URL.createObjectURL !== 'function') return
      made = URL.createObjectURL(blob)
      setUrl(made)
    })
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [id])
  return (
    <li className="relative size-24 overflow-hidden rounded-xl bg-surface">
      {url && <img src={url} alt={`Receipt photo ${n}`} className="size-full object-cover" />}
      <button
        type="button"
        aria-label={`Remove photo ${n}`}
        onClick={onRemove}
        className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-black/60 text-white"
      >
        ×
      </button>
    </li>
  )
}

export default function PhotoPicker({
  photoIds,
  onChange,
  max = 3,
}: {
  photoIds: string[]
  onChange: (ids: string[]) => void
  max?: number
}) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function add(files: File[]) {
    if (files.length === 0) return
    setMessage('')
    setBusy(true)
    let ids = photoIds
    try {
      for (const file of files) {
        if (ids.length >= max) {
          setMessage(`Up to ${max} photos`)
          break
        }
        try {
          const id = await repo.putPhoto(await resizeImage(file))
          ids = [...ids, id]
          onChange(ids)
        } catch {
          setMessage("Couldn't save the photo. Free some space and try again.")
          break
        }
      }
    } finally {
      setBusy(false)
    }
  }

  const action =
    'flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-surface text-base font-medium focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-fg'

  return (
    <div>
      {photoIds.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {photoIds.map((id, i) => (
            <Thumb key={id} id={id} n={i + 1} onRemove={() => onChange(photoIds.filter((p) => p !== id))} />
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <label className={action}>
          <CameraIcon />
          Camera
          <input
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Take photo"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? [])
              e.target.value = ''
              void add(picked)
            }}
          />
        </label>
        <label className={action}>
          Library
          <input
            type="file"
            accept="image/*"
            multiple
            aria-label="Choose from library"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? [])
              e.target.value = ''
              void add(picked)
            }}
          />
        </label>
      </div>
      {message && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  )
}
