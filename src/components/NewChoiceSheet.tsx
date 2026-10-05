import { navigate } from '../router'

export default function NewChoiceSheet({ onClose }: { onClose: () => void }) {
  const btn = 'min-h-14 w-full rounded-2xl bg-surface text-lg font-medium'
  const go = (path: string) => {
    onClose()
    navigate(path)
  }
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add new"
        className="mx-auto w-full max-w-md space-y-2 rounded-t-3xl bg-bg p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={btn} onClick={() => go('/entry/new')}>
          Time entry
        </button>
        <button type="button" className={btn} onClick={() => go('/expense/new')}>
          Expense
        </button>
        <button type="button" className="min-h-12 w-full text-base text-muted" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
