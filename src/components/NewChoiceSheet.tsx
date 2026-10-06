import Modal from './Modal'
import { navigate } from '../router'

export default function NewChoiceSheet({ onClose }: { onClose: () => void }) {
  const btn = 'min-h-14 w-full rounded-2xl bg-surface text-lg font-medium'
  const go = (path: string) => {
    onClose()
    navigate(path)
  }
  return (
    <Modal label="Add new" placement="bottom" onClose={onClose}>
      <button type="button" className={btn} onClick={() => go('/entry/new')}>
        Time entry
      </button>
      <button type="button" className={btn} onClick={() => go('/expense/new')}>
        Expense
      </button>
      <button type="button" className="min-h-12 w-full text-base text-muted" onClick={onClose}>
        Cancel
      </button>
    </Modal>
  )
}
