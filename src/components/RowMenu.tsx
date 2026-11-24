import Modal from './Modal'

export interface MenuTarget {
  kind: 'entry' | 'expense'
  id: string
}

/** What the sheet is about: the row's day, name and amount, and whether it has been received. */
export interface MenuSummary {
  title: string
  status: string
}

/** What can be done with one row of the list; opens when the row is tapped. */
export function RowMenu({
  target,
  summary,
  confirming,
  onEdit,
  onAskDelete,
  onConfirmDelete,
  onClose,
  onViewPayment,
}: {
  target: MenuTarget
  summary?: MenuSummary
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
            {summary && (
              <div className="px-2 pb-2 pt-1 text-center">
                <p className="truncate text-base font-semibold">{summary.title}</p>
                <p className="text-sm text-muted">{summary.status}</p>
              </div>
            )}
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
