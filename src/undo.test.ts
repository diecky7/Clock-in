import { afterEach, expect, it, vi } from 'vitest'
import { dismissUndo, offerUndo, runUndo, UNDO_MS } from './undo'

afterEach(() => {
  vi.useRealTimers()
  dismissUndo()
})

it('Undo runs once and only within 3.5 s', async () => {
  vi.useFakeTimers()
  const undo = vi.fn().mockResolvedValue(undefined)
  offerUndo('Saved', undo)
  vi.advanceTimersByTime(UNDO_MS - 1)
  expect(await runUndo()).toBe(true)
  expect(await runUndo()).toBe(false)
  expect(undo).toHaveBeenCalledTimes(1)

  offerUndo('Saved', undo)
  vi.advanceTimersByTime(UNDO_MS)
  expect(await runUndo()).toBe(false)
  expect(undo).toHaveBeenCalledTimes(1)
  expect(UNDO_MS).toBe(3500)
})
