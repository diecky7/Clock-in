import { useRef, type PointerEvent } from 'react'

/** Pointer handlers that fire `onLongPress` after the finger rests for `ms`. */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  return {
    onPointerDown: () => {
      cancel()
      timer.current = setTimeout(() => {
        timer.current = null
        onLongPress()
      }, ms)
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onPointerMove: (e: PointerEvent) => {
      // A moving finger is a scroll, not a hold.
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) cancel()
    },
  }
}

export interface MenuTarget {
  kind: 'entry' | 'expense'
  id: string
}

export function LongPressMenu({
  target,
  confirming,
  onEdit,
  onAskDelete,
  onConfirmDelete,
  onClose,
}: {
  target: MenuTarget
  confirming: boolean
  onEdit: () => void
  onAskDelete: () => void
  onConfirmDelete: () => void
  onClose: () => void
}) {
  const noun = target.kind === 'entry' ? 'entry' : 'expense'
  const btn = 'min-h-12 w-full rounded-xl text-base font-medium'
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${noun} actions`}
        className="mx-auto w-full max-w-md space-y-2 rounded-t-3xl bg-bg p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        {confirming ? (
          <>
            <p className="px-2 py-3 text-center text-base">Delete this {noun}?</p>
            <button type="button" className={`${btn} bg-danger text-white`} onClick={onConfirmDelete}>
              Yes, delete
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`${btn} bg-surface`} onClick={onEdit}>
              Edit
            </button>
            <button type="button" className={`${btn} bg-surface text-danger`} onClick={onAskDelete}>
              Delete
            </button>
          </>
        )}
        <button type="button" className={`${btn} text-muted`} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
