import { runUndo, UNDO_MS, useUndo } from '../undo'

/** Bottom toast with an Undo button and a bar that runs out in 3.5 s. */
export default function UndoToast() {
  const item = useUndo()
  if (!item) return null
  return (
    <div
      key={item.id}
      role="status"
      className="undo-toast fixed inset-x-4 bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+5rem)] z-30 mx-auto max-w-sm overflow-hidden rounded-2xl bg-fg text-bg shadow-lg"
    >
      <div className="flex min-h-12 items-center justify-between gap-3 pl-4 pr-1">
        <span className="truncate text-base">{item.label}</span>
        <button type="button" className="min-h-11 shrink-0 rounded-xl px-4 text-base font-semibold" onClick={() => void runUndo()}>
          Undo
        </button>
      </div>
      <div aria-hidden className="h-1 bg-bg/20">
        <div className="undo-bar h-full bg-bg/70" style={{ animationDuration: `${UNDO_MS}ms` }} />
      </div>
    </div>
  )
}
