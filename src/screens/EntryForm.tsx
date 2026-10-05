import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import DateTimeField from '../components/DateTimeField'
import EmployerPicker from '../components/EmployerPicker'
import { Field, PrimaryButton, Screen, inputCls } from '../components/ui'
import * as repo from '../data/repo'
import { activeEmployers } from '../domain/employers'
import { rateOn } from '../domain/rates'
import { formatHours, shiftMinutes, validateShift } from '../domain/time'
import { today } from '../domain/today'
import type { Employer, Place, Settings, TimeEntry } from '../domain/types'
import { addDays } from '../domain/weeks'
import { getCurrentPosition, reverseGeocode, searchAddress } from '../location/geocode'
import { navigate } from '../router'

// The map library is large; load it only when this form opens.
const MapPicker = lazy(() => import('../location/MapPicker'))

const FALLBACK_DAY = { in: '07:00', out: '15:30', breakMin: 30 }
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

function parseBreak(text: string): number {
  const n = Math.floor(Number(text))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function defaultsFor(date: string, settings: Settings) {
  const [y, m, d] = date.split('-').map(Number)
  const day = settings.schedule[new Date(y, m - 1, d).getDay()] ?? settings.schedule.find(Boolean) ?? FALLBACK_DAY
  const start = `${date}T${day.in}`
  const sameDayEnd = `${date}T${day.out}`
  const end = sameDayEnd > start ? sameDayEnd : `${addDays(date, 1)}T${day.out}`
  return { start, end, breakMin: day.breakMin }
}

export default function EntryForm({ id, initialDate }: { id?: string; initialDate?: string }) {
  const editing = id !== undefined && id !== 'new'
  const [ready, setReady] = useState(false)
  const [missing, setMissing] = useState(false)
  const [employers, setEmployers] = useState<Employer[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [existing, setExisting] = useState<TimeEntry | null>(null)

  const [employerId, setEmployerId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [breakText, setBreakText] = useState('0')
  const [place, setPlace] = useState<Place | null>(null)
  const [outTouched, setOutTouched] = useState(false)

  const [errors, setErrors] = useState<{ start?: string; end?: string; brk?: string }>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [locNote, setLocNote] = useState('')
  const [gpsBusy, setGpsBusy] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const [all, s] = await Promise.all([repo.listEmployers(), repo.getSettings()])
      const entry = editing ? ((await repo.getEntry(id)) ?? null) : null
      if (!alive) return
      if (editing && !entry) {
        setMissing(true)
        setReady(true)
        return
      }
      const choices = all.filter((e) => !e.archived || e.id === entry?.employerId)
      setEmployers(choices)
      setSettings(s)
      setExisting(entry)
      if (entry) {
        setEmployerId(entry.employerId)
        setStart(entry.start)
        setEnd(entry.end)
        setBreakText(String(entry.breakMin))
        setPlace(entry.place ?? null)
        setOutTouched(true)
      } else {
        const d = defaultsFor(initialDate ?? today(), s)
        setEmployerId(activeEmployers(all)[0]?.id ?? '')
        setStart(d.start)
        setEnd(d.end)
        setBreakText(String(d.breakMin))
      }
      setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [id, editing, initialDate])

  // Once the user picks, drags or clears the address, the automatic GPS fix must not overwrite it.
  const userChose = useRef(false)
  function setPlaceByUser(p: Place | null) {
    userChose.current = true
    setPlace(p)
  }

  async function useGps(auto = false) {
    setGpsBusy(true)
    setLocNote('')
    try {
      const pos = await getCurrentPosition()
      let p: Place
      try {
        p = await reverseGeocode(pos.lat, pos.lon)
      } catch {
        p = { lat: pos.lat, lon: pos.lon, label: `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}` }
      }
      if (auto && userChose.current) return
      setPlace(p)
    } catch {
      if (!(auto && userChose.current)) setLocNote("Couldn't get your location. Search for an address instead.")
    } finally {
      setGpsBusy(false)
    }
  }

  // New entries start on the current GPS position.
  const askedGps = useRef(false)
  useEffect(() => {
    if (!ready || editing || missing || askedGps.current) return
    askedGps.current = true
    void useGps(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, editing, missing])

  // Debounced address search; a newer keystroke aborts the previous request.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSuggestions([])
      return
    }
    const ctl = new AbortController()
    const t = setTimeout(() => {
      searchAddress(q, ctl.signal)
        .then((r) => {
          setSuggestions(r)
          setLocNote('')
        })
        .catch((err: unknown) => {
          if ((err as { name?: string }).name === 'AbortError') return
          setSuggestions([])
          setLocNote('Address search needs a connection. You can still save without one.')
        })
    }, 400)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [query])

  function changeStart(v: string) {
    setStart(v)
    if (!outTouched && DATETIME.test(v) && DATETIME.test(end)) {
      // Keep Out on the same day as In, with its time of day.
      const date = v.slice(0, 10)
      const time = end.slice(11)
      setEnd(`${date}T${time}` > v ? `${date}T${time}` : `${addDays(date, 1)}T${time}`)
    }
  }

  function choose(p: Place) {
    setPlaceByUser(p)
    setQuery('')
    setOpen(false)
    setLocNote('')
  }

  const brk = parseBreak(breakText)
  const shift = { start, end, breakMin: brk }
  const valid = DATETIME.test(start) && DATETIME.test(end) && validateShift(shift) === null
  const saveLabel = valid ? `Save · ${formatHours(shiftMinutes(shift))} h` : 'Save'

  async function save() {
    const next: typeof errors = {}
    if (!DATETIME.test(start)) next.start = 'Enter a date and time'
    if (!DATETIME.test(end)) next.end = 'Enter a date and time'
    if (!next.start && !next.end) {
      const v = validateShift(shift)
      if (v === 'OUT_BEFORE_IN') next.end = 'Out must be after In'
      if (v === 'BREAK_TOO_LONG') next.brk = 'Break is longer than the shift'
    }
    setErrors(next)
    const employer = employers.find((e) => e.id === employerId)
    if (next.start || next.end || next.brk || !employer || saving) return

    setSaving(true)
    setSaveError('')
    const date = start.slice(0, 10)
    const keepRate = existing && existing.employerId === employerId
    const entry: TimeEntry = {
      id: existing?.id ?? crypto.randomUUID(),
      employerId,
      start,
      end,
      breakMin: brk,
      rateCents: keepRate ? existing.rateCents : rateOn(employer, date),
      ...(place ? { place } : {}),
    }
    try {
      await repo.saveEntry(entry)
      if (place) await repo.addRecentPlace(place).catch(() => undefined)
      navigate('/')
    } catch {
      setSaveError("Couldn't save. Free some space on your iPhone and try again.")
    } finally {
      setSaving(false)
    }
  }

  const title = editing ? 'Edit entry' : 'New entry'
  if (!ready) return <Screen title={title} back="/">{null}</Screen>
  if (missing) {
    return (
      <Screen title={title} back="/">
        <p className="mt-6 text-muted">This entry no longer exists.</p>
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

  const recents = settings?.recentPlaces ?? []
  const list = query.trim() ? suggestions : recents

  return (
    <Screen title={title} back="/">
      <div className="mt-2">
        <EmployerPicker employers={employers} value={employerId} onChange={setEmployerId} />
      </div>

      <DateTimeField label="In" value={start} onChange={changeStart} error={errors.start} />
      <DateTimeField
        label="Out"
        value={end}
        onChange={(v) => {
          setOutTouched(true)
          setEnd(v)
        }}
        error={errors.end}
      />

      <Field label="Break (min)" htmlFor="break" error={errors.brk}>
        <input
          id="break"
          type="number"
          inputMode="numeric"
          min={0}
          className={inputCls}
          value={breakText}
          onChange={(e) => setBreakText(e.target.value)}
        />
      </Field>

      <div className="mt-6">
        <span className="mb-1 block text-sm text-muted">Location</span>
        <div className="relative">
          <input
            aria-label="Address"
            className={inputCls}
            placeholder="Search an address"
            autoComplete="off"
            value={query}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
          />
          {open && list.length > 0 && (
            <ul
              aria-label={query.trim() ? 'Suggestions' : 'Recent addresses'}
              className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-border bg-bg shadow-lg"
              onMouseDown={(e) => e.preventDefault()}
            >
              {list.map((p) => (
                <li key={`${p.label}-${p.lat}-${p.lon}`} className="border-t border-border first:border-t-0">
                  <button type="button" onClick={() => choose(p)} className="min-h-11 w-full px-3 py-2 text-left">
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => void useGps()}
          disabled={gpsBusy}
          className="mt-2 min-h-11 rounded-full border border-border px-4 text-sm font-medium disabled:opacity-50"
        >
          {gpsBusy ? 'Finding you…' : 'Use my location'}
        </button>
        {locNote && (
          <p role="status" className="mt-2 text-sm text-muted">
            {locNote}
          </p>
        )}
        <div className="mt-3">
          <Suspense fallback={<div className="h-60 w-full rounded-2xl bg-surface" />}>
            <MapPicker value={place} onChange={setPlaceByUser} fallback={recents[0] ?? null} />
          </Suspense>
        </div>
        {place && (
          <div className="mt-2 flex items-start justify-between gap-3">
            <p data-testid="chosen-place" className="text-sm">
              {place.label}
            </p>
            <button type="button" onClick={() => setPlaceByUser(null)} className="min-h-11 shrink-0 px-2 text-sm text-muted">
              Remove
            </button>
          </div>
        )}
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
