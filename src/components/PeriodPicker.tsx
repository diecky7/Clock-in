import { PERIOD_KINDS, type PeriodKind } from '../domain/periods'
import Dropdown from './Dropdown'

/** Weekly / Biweekly / Monthly. */
export default function PeriodPicker({ kind, onChange }: { kind: PeriodKind; onChange: (k: PeriodKind) => void }) {
  const name = PERIOD_KINDS.find((p) => p.kind === kind)?.name ?? 'Weekly'
  return (
    <Dropdown
      value={kind}
      options={PERIOD_KINDS.map((p) => ({ value: p.kind, label: p.name }))}
      onChange={(v) => onChange(v as PeriodKind)}
      buttonLabel={<span className="whitespace-nowrap">{name}</span>}
      ariaLabel={`Show: ${name}, change`}
      menuLabel="Show"
    />
  )
}
