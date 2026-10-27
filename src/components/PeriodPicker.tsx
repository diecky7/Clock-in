import { PERIOD_KINDS, type PeriodKind } from '../domain/periods'
import Dropdown from './Dropdown'

/** The period label in the date bar; tapping it switches the home screen between week, two weeks and month. */
export default function PeriodPicker({ kind, label, onChange }: { kind: PeriodKind; label: string; onChange: (k: PeriodKind) => void }) {
  return (
    <Dropdown
      value={kind}
      options={PERIOD_KINDS.map((p) => ({ value: p.kind, label: p.name }))}
      onChange={(v) => onChange(v as PeriodKind)}
      buttonLabel={label}
      ariaLabel={`${label}, change period`}
      menuLabel="Show"
    />
  )
}
