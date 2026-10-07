import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

const PLACEMENT = {
  center: {
    overlay: 'grid place-items-center p-4',
    panel: 'max-h-[88dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-border bg-surface p-4',
  },
  // Small menu that opens up and to the left of the round "+" button.
  popover: {
    overlay: '',
    panel:
      'fixed bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+3.5rem)] right-[5.25rem] w-44 space-y-1 rounded-2xl border border-border bg-surface p-1.5 shadow-lg',
  },
  bottom: {
    overlay: 'flex items-end',
    panel: 'mx-auto w-full max-w-md space-y-2 rounded-t-3xl border-t border-border bg-bg p-4 pb-8',
  },
}

/**
 * Accessible modal dialog: Escape and backdrop close it, focus moves in and returns to the opener,
 * Tab stays inside, and the app behind is inert.
 */
export default function Modal({
  label,
  onClose,
  placement = 'center',
  initialFocus,
  children,
}: {
  label: string
  onClose: () => void
  placement?: 'center' | 'bottom' | 'popover'
  initialFocus?: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    const wasInert = root?.hasAttribute('inert') ?? false
    root?.setAttribute('inert', '')
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    ;(initialFocus?.current ?? focusables()[0] ?? panel.current)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.current?.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !panel.current?.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (!wasInert) root?.removeAttribute('inert')
      if (opener?.isConnected) opener.focus()
    }
    // Runs once per open; the latest onClose is read through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cls = PLACEMENT[placement]
  return createPortal(
    <div
      className={`fixed inset-0 z-20 ${placement === 'popover' ? 'bg-black/20' : 'bg-black/40'} ${cls.overlay}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={cls.panel}>
        {children}
      </div>
    </div>,
    document.body,
  )
}
