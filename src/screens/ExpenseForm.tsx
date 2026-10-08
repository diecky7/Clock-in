import { useEffect, useRef, useState } from 'react'
import EmployerPicker from '../components/EmployerPicker'
import PhotoPicker from '../components/PhotoPicker'
import { Field, PrimaryButton, Screen, inputCls } from '../components/ui'
import * as repo from '../data/repo'
import { defaultEmployerId } from '../domain/employers'
import DateTimeField from '../components/DateTimeField'
import MoneyInput from '../components/MoneyInput'
import { formatUSD } from '../domain/money'
import { today } from '../domain/today'
import type { Employer, Expense } from '../domain/types'
import { navigate } from '../router'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export default function ExpenseForm({ id, initialDate }: { id?: string; initialDate?: string }) {
  const editing = id !== undefined && id !== 'new'
  const [ready, setReady] = useState(false)
  const [missing, setMissing] = useState(false)
  const [employers, setEmployers] = useState<Employer[]>([])
  const [existing, setExisting] = useState<Expense | null>(null)

  const [employerId, setEmployerId] = useState('')
  const [description, setDescription] = useState('')
  const [cents, setCents] = useState<number | null>(null)
  const [date, setDate] = useState(initialDate ?? today())
  const [photoIds, setPhotoIds] = useState<string[]>([])
  const [error, setError] = useState<{ amount?: string; date?: string }>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Photos added in this session; removed again if the form is left without saving.
  const added = useRef(new Set<string>())
  const saved = useRef(false)
  const photosRef = useRef<string[]>([])
  photosRef.current = photoIds

  useEffect(() => {
    let alive = true
    void (async () => {
      const [all, s] = await Promise.all([repo.listEmployers(), repo.getSettings()])
      const x = editing ? ((await repo.getExpense(id)) ?? null) : null
      if (!alive) return
      if (editing && !x) {
        setMissing(true)
        setReady(true)
        return
      }
      setEmployers(all.filter((e) => !e.archived || e.id === x?.employerId))
      setExisting(x)
      if (x) {
        setEmployerId(x.employerId)
        setDescription(x.description === 'Expense' ? '' : x.description)
        setCents(x.amountCents)
        setDate(x.date)
        setPhotoIds(x.photoIds)
      } else {
        setEmployerId(defaultEmployerId(all, s.lastEmployerId))
      }
      setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [id, editing])

  useEffect(
    () => () => {
      if (saved.current) return
      for (const p of added.current) void repo.deletePhoto(p).catch(() => undefined)
    },
    [],
  )

  function changePhotos(ids: string[]) {
    for (const p of ids) if (!photoIds.includes(p)) added.current.add(p)
    setPhotoIds(ids)
  }

  const saveLabel = cents === null ? 'Save' : `Save · ${formatUSD(cents)}`

  async function save() {
    const next: typeof error = {}
    if (cents === null) next.amount = 'Enter an amount'
    if (!DATE.test(date)) next.date = 'Enter a date'
    setError(next)
    if (next.amount || next.date || cents === null || !employerId || saving) return

    setSaving(true)
    setSaveError('')
    const expense: Expense = {
      id: existing?.id ?? crypto.randomUUID(),
      employerId,
      date,
      description: description.trim() || 'Expense',
      amountCents: cents,
      photoIds,
    }
    try {
      await repo.saveExpense(expense)
      await repo.rememberEmployer(employerId)
      saved.current = true
      // Photos taken out are deleted: both ones the expense already had and ones added then removed in this session.
      const dropped = new Set([...(existing?.photoIds ?? []), ...added.current])
      for (const p of dropped) if (!photoIds.includes(p)) await repo.deletePhoto(p)
      navigate('/')
    } catch {
      setSaveError("Couldn't save. Free some space on your iPhone and try again.")
    } finally {
      setSaving(false)
    }
  }

  const title = editing ? 'Edit expense' : 'New expense'
  if (!ready) return <Screen title={title} back="/">{null}</Screen>
  if (missing) {
    return (
      <Screen title={title} back="/">
        <p className="mt-6 text-muted">This expense no longer exists.</p>
      </Screen>
    )
  }
  if (employers.length === 0) {
    return (
      <Screen title={title} back="/">
        <p className="mt-6 text-muted">Add an employer first.</p>
        <button type="button" onClick={() => navigate('/settings/employer/new')} className="mt-4 min-h-12 w-full rounded-full bg-accent font-semibold text-accent-fg">
          Add employer
        </button>
      </Screen>
    )
  }

  return (
    <Screen title={title} back="/">
      <div className="mt-2">
        <EmployerPicker employers={employers} value={employerId} onChange={setEmployerId} />
      </div>

      <Field label="Description" htmlFor="x-desc">
        <input
          id="x-desc"
          className={inputCls}
          placeholder="What was it for?"
          autoComplete="off"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label="Amount" htmlFor="x-amount" error={error.amount}>
        <MoneyInput id="x-amount" cents={cents} onChange={setCents} />
      </Field>

      <DateTimeField type="date" label="Date" value={date} onChange={setDate} error={error.date} />

      <div className="mt-6">
        <span className="mb-2 block text-sm text-muted">Receipt (up to 3 photos)</span>
        <PhotoPicker photoIds={photoIds} onChange={changePhotos} />
      </div>

      {saveError && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {saveError}
        </p>
      )}
      <div className="mt-8">
        <PrimaryButton type="button" disabled={saving} onClick={() => void save()}>
          {saveLabel}
        </PrimaryButton>
      </div>
    </Screen>
  )
}
