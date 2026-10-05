import { useEffect, useState } from 'react'
import * as repo from '../data/repo'
import { Field, PrimaryButton, Screen, Switch, inputCls } from '../components/ui'
import { formatUSD, parseUSD } from '../domain/money'
import { addRateChange, rateOn } from '../domain/rates'
import { today } from '../domain/today'
import type { Employer } from '../domain/types'
import { navigate } from '../router'

export default function EmployerEdit({ id }: { id: string }) {
  const isNew = id === 'new'
  const [loaded, setLoaded] = useState(isNew)
  const [employer, setEmployer] = useState<Employer | null>(null)
  const [name, setName] = useState('')
  const [rate, setRate] = useState('')
  const [overtime, setOvertime] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; rate?: string }>({})
  const [confirmArchive, setConfirmArchive] = useState(false)

  useEffect(() => {
    if (isNew) return
    let alive = true
    void repo.listEmployers().then((all) => {
      if (!alive) return
      const e = all.find((x) => x.id === id) ?? null
      setEmployer(e)
      if (e) {
        setName(e.name)
        setRate((rateOn(e, today()) / 100).toFixed(2))
        setOvertime(e.overtimeEnabled)
      }
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [id, isNew])

  async function save() {
    const cents = parseUSD(rate)
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Enter a name'
    if (cents === null) next.rate = 'Enter a valid rate'
    setErrors(next)
    if (next.name || next.rate || cents === null) return

    let e: Employer = employer ?? {
      id: crypto.randomUUID(),
      name: name.trim(),
      overtimeEnabled: overtime,
      archived: false,
      rates: [{ from: today(), cents }],
    }
    e = { ...e, name: name.trim(), overtimeEnabled: overtime }
    if (employer && cents !== rateOn(employer, today())) {
      e = addRateChange(e, { from: today(), cents })
    }
    await repo.saveEmployer(e)
    navigate('/settings')
  }

  async function archive() {
    if (!employer) return
    await repo.saveEmployer({ ...employer, archived: true })
    navigate('/settings')
  }

  if (!loaded) return <Screen title="Employer" back="/settings">{null}</Screen>

  return (
    <Screen title={isNew ? 'Add employer' : 'Edit employer'} back="/settings">
      <Field label="Name" htmlFor="emp-name" error={errors.name}>
        <input id="emp-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Hourly rate" htmlFor="emp-rate" error={errors.rate}>
        <input
          id="emp-rate"
          className={inputCls}
          inputMode="decimal"
          placeholder="0.00"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </Field>
      {!isNew && <p className="mt-2 text-sm text-muted">New rate applies to new entries only</p>}

      <div className="mt-6 flex min-h-14 items-center justify-between rounded-2xl bg-surface px-4">
        <span>Overtime 1.5× after 40 h</span>
        <Switch checked={overtime} onChange={setOvertime} label="Overtime 1.5× after 40 h" />
      </div>

      {employer && (
        <section className="mt-6" aria-label="Rate history">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">Rate history</h2>
          <ul className="overflow-hidden rounded-2xl bg-surface">
            {[...employer.rates].reverse().map((r) => (
              <li key={r.from} className="flex min-h-12 items-center justify-between border-t border-border px-4 first:border-t-0">
                <span>{formatUSD(r.cents)}</span>
                <span className="text-sm text-muted">from {r.from}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8">
        <PrimaryButton type="button" onClick={() => void save()}>
          Save
        </PrimaryButton>
      </div>

      {employer && !confirmArchive && (
        <button
          type="button"
          onClick={() => setConfirmArchive(true)}
          className="mt-4 min-h-12 w-full rounded-full text-base font-medium text-danger"
        >
          Delete employer
        </button>
      )}
      {employer && confirmArchive && (
        <div className="mt-4 rounded-2xl bg-surface p-4" role="group" aria-label="Confirm delete">
          <p className="text-sm">Hide this employer from new entries? Past weeks keep their data.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setConfirmArchive(false)} className="min-h-11 flex-1 rounded-full border border-border">
              Cancel
            </button>
            <button type="button" onClick={() => void archive()} className="min-h-11 flex-1 rounded-full bg-danger font-medium text-white">
              Archive
            </button>
          </div>
        </div>
      )}
    </Screen>
  )
}
