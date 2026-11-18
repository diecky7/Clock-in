import { runUndo, UNDO_MS, useUndo } from '../undo'

/** Small pill at the bottom: what happened, Undo, and a thin bar that runs out in 3.5 s. */
export default function UndoToast() {
  const item = useUndo()
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+5rem)] z-30 flex justify-center px-4">
      {item && (
        <div key={item.id} className="undo-toast pointer-events-auto relative flex max-w-full items-center overflow-hidden rounded-full bg-fg/90 pl-3.5 text-sm text-bg shadow-md">
          <span className="truncate">{item.label}</span>
          <button type="button" className="min-h-9 shrink-0 px-3.5 font-semibold" onClick={() => void runUndo()}>
            Undo
          </button>
          <span aria-hidden className="undo-bar absolute bottom-0 left-0 h-0.5 bg-bg/60" style={{ animationDuration: `${UNDO_MS}ms` }} />
        </div>
      )}
    </div>
  )
}
