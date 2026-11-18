import { useSyncExternalStore } from 'react'

/** How long the Undo button stays up. */
export const UNDO_MS = 3500

export interface UndoItem {
  id: number
  label: string
  undo: () => Promise<void>
}

let current: UndoItem | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Screens that show stored data reload when this fires (after an undo). */
export const DATA_CHANGED = 'clockin:data-changed'

/** Shows "label · Undo" for 3.5 s. A new action replaces the previous one. */
export function offerUndo(label: string, undo: () => Promise<void>): void {
  clearTimeout(timer)
  current = { id: ++seq, label, undo }
  timer = setTimeout(dismissUndo, UNDO_MS)
  emit()
}

export function dismissUndo(): void {
  clearTimeout(timer)
  current = null
  emit()
}

/** Runs the undo once; the toast closes either way. */
export async function runUndo(): Promise<boolean> {
  const item = current
  dismissUndo()
  if (!item) return false
  try {
    await item.undo()
    window.dispatchEvent(new Event(DATA_CHANGED))
    return true
  } catch {
    return false
  }
}

export function useUndo(): UndoItem | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
