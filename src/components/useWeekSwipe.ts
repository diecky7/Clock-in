import { useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'

/** Share of the screen width a drag must cover before it changes the week. */
export const SWIPE_THRESHOLD = 0.5
const OUT_MS = 180
const IN_MS = 260

const reduceMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Horizontal drag to change week. The content follows the finger; past half of the width it slides out,
 * the next (drag left) or previous (drag right) week slides in from the other side. Shorter drags spring back.
 */
export function useWeekSwipe(onChange: (dir: -1 | 1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const moved = useRef(false)
  const [dx, setDx] = useState(0)
  const [transition, setTransition] = useState('none')
  const [busy, setBusy] = useState(false)

  const width = (el: HTMLElement) => el.clientWidth || window.innerWidth

  function commit(dir: -1 | 1, w: number) {
    if (reduceMotion()) {
      setDx(0)
      onChange(dir)
      return
    }
    setBusy(true)
    setTransition(`transform ${OUT_MS}ms ease-in, opacity ${OUT_MS}ms ease-in`)
    setDx(-dir * w)
    setTimeout(() => {
      onChange(dir)
      setTransition('none')
      setDx(dir * w)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setTransition(`transform ${IN_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${IN_MS}ms ease-out`)
          setDx(0)
          setTimeout(() => setBusy(false), IN_MS)
        }),
      )
    }, OUT_MS)
  }

  function finish(e: PointerEvent<HTMLElement>) {
    const wasDragging = dragging.current
    start.current = null
    dragging.current = false
    if (!wasDragging) return
    const w = width(e.currentTarget)
    if (Math.abs(dx) > w * SWIPE_THRESHOLD) commit(dx < 0 ? 1 : -1, w)
    else {
      setTransition(`transform ${IN_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${IN_MS}ms ease-out`)
      setDx(0)
    }
  }

  const bind = {
    // On the whole screen, so a touch that starts at an edge or in the margins is ours too (vertical scroll stays native).
    style: { touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' } as CSSProperties,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (busy || !e.isPrimary) return
      start.current = { x: e.clientX, y: e.clientY }
      dragging.current = false
      moved.current = false
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = start.current
      if (!s) return
      const mx = e.clientX - s.x
      const my = e.clientY - s.y
      if (!dragging.current) {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
          start.current = null // vertical: let the page scroll
          return
        }
        if (Math.abs(mx) < 10) return
        dragging.current = true
        moved.current = true
        setTransition('none')
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }
      const w = width(e.currentTarget)
      setDx(Math.max(-w, Math.min(w, mx)))
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    // A drag that ends over a row must not also open it.
    onClickCapture: (e: MouseEvent<HTMLElement>) => {
      if (moved.current) {
        e.preventDefault()
        e.stopPropagation()
        moved.current = false
      }
    },
  }

  const style: CSSProperties = {
    transform: dx === 0 && transition === 'none' ? undefined : `translate3d(${dx}px,0,0)`,
    opacity: 1 - Math.min(1, Math.abs(dx) / (window.innerWidth || 1)) * 0.6,
    transition,
    willChange: dx === 0 ? undefined : 'transform',
  }
  return { bind, style }
}
