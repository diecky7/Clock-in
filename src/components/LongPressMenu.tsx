import Modal from './Modal'
import { useRef, type PointerEvent } from 'react'

/** Pointer handlers that fire `onLongPress` after the finger rests for `ms`. */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  return {
    onPointerDown: () => {
      cancel()
      fired.current = false
      timer.current = setTimeout(() => {
        timer.current = null
        fired.current = true
        onLongPress()
      }, ms)
    },
    /** True once for the click that ends a hold, so it isn't also taken as a tap. */
    consumeHold: () => {
      const f = fired.current
      fired.current = false
      return f
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
  onViewPayment,
}: {
  target: MenuTarget
  confirming: boolean
  onViewPayment?: () => void
  onEdit: () => void
  onAskDelete: () => void
  onConfirmDelete: () => void
  onClose: () => void
}) {
  const noun = target.kind === 'entry' ? 'entry' : 'expense'
  const btn = 'min-h-12 w-full rounded-xl text-base font-medium'
  return (
    <Modal label={`${noun} actions`} placement="bottom" onClose={onClose}>
        {confirming ? (
          <>
            <p className="px-2 py-3 text-center text-base">Delete this {noun}?</p>
            <button type="button" className={`${btn} bg-danger text-accent-fg`} onClick={onConfirmDelete}>
              Yes, delete
            </button>
          </>
        ) : (
          <>
            {onViewPayment && (
              <button type="button" className={`${btn} bg-surface`} onClick={onViewPayment}>
                View payment
              </button>
            )}
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
    </Modal>
  )
}
