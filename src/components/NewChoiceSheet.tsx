import Modal from './Modal'
import { navigate } from '../router'

export default function NewChoiceSheet({ onClose }: { onClose: () => void }) {
  const btn = 'min-h-12 w-full rounded-xl px-3 text-left text-base font-medium active:bg-bg'
  const go = (path: string) => {
    onClose()
    navigate(path)
  }
  return (
    <Modal label="Add new" placement="popover" onClose={onClose}>
      <button type="button" className={btn} onClick={() => go('/entry/new')}>
        Time entry
      </button>
      <button type="button" className={btn} onClick={() => go('/expense/new')}>
        Expense
      </button>
    </Modal>
  )
}
