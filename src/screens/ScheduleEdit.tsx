import { useEffect, useRef, useState } from 'react'
import * as repo from '../data/repo'
import DateTimeField from '../components/DateTimeField'
import { Screen, inputCls } from '../components/ui'
import type { DaySchedule, Settings } from '../domain/types'

type Times = NonNullable<DaySchedule>

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** One set of times for every work day; the weekday chips choose which days use it. */
export default function ScheduleEdit() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [times, setTimes] = useState<Times>(repo.DEFAULT_DAY)
  const latest = useRef<Settings | null>(null)

  useEffect(() => {
    let alive = true
    void repo.getSettings().then((s) => {
      if (!alive) return
      latest.current = s
      setSettings(s)
      setTimes(s.schedule.find((d): d is Times => d !== null) ?? repo.DEFAULT_DAY)
    })
    return () => {
      alive = false
    }
  }, [])

  function save(on: boolean[], t: Times) {
    const cur = latest.current
    if (!cur) return
    const next = { ...cur, schedule: on.map((x) => (x ? { ...t } : null)) }
    latest.current = next
    setSettings(next)
    setTimes(t)
    void repo.saveSettings(next)
  }

  if (!settings) return <Screen title="Default schedule" back="/settings">{null}</Screen>

  const on = settings.schedule.map((d) => d !== null)

  return (
    <Screen title="Default schedule" back="/settings">
      <p className="mb-4 mt-2 text-base text-muted">New entries start with these times.</p>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-surface p-4">
        <DateTimeField
          type="time"
          label="In"
          className=""
          value={times.in}
          onChange={(v) => v && save(on, { ...times, in: v })}
        />
        <DateTimeField
          type="time"
          label="Out"
          className=""
          value={times.out}
          onChange={(v) => v && save(on, { ...times, out: v })}
        />
        <label className="col-span-2 grid min-w-0 gap-1 text-sm text-muted">
          Break (min)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            aria-label="Break (min)"
            className={inputCls}
            value={times.breakMin}
            onChange={(e) => save(on, { ...times, breakMin: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          />
        </label>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Work days</h2>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {DAYS.map((name, i) => (
          <button
            key={name}
            type="button"
            aria-pressed={on[i]}
            aria-label={name}
            onClick={() => save(on.map((x, j) => (j === i ? !x : x)), times)}
            className={`min-h-11 rounded-xl border border-border text-sm font-medium ${on[i] ? 'bg-accent text-accent-fg' : 'bg-bg text-muted'}`}
          >
            {name.slice(0, 3)}
          </button>
        ))}
      </div>
    </Screen>
  )
}
