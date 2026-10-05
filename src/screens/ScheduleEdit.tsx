import { useEffect, useRef, useState } from 'react'
import * as repo from '../data/repo'
import { Screen, Switch, inputCls } from '../components/ui'
import type { DaySchedule, Settings } from '../domain/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_DAY = { in: '07:00', out: '15:30', breakMin: 30 }

export default function ScheduleEdit() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const latest = useRef<Settings | null>(null)

  useEffect(() => {
    let alive = true
    void repo.getSettings().then((s) => {
      if (!alive) return
      latest.current = s
      setSettings(s)
    })
    return () => {
      alive = false
    }
  }, [])

  function update(i: number, day: DaySchedule) {
    const cur = latest.current
    if (!cur) return
    const schedule = cur.schedule.map((d, idx) => (idx === i ? day : d))
    const next = { ...cur, schedule }
    latest.current = next
    setSettings(next)
    void repo.saveSettings(next)
  }

  if (!settings) return <Screen title="Default schedule" back="/settings">{null}</Screen>

  return (
    <Screen title="Default schedule" back="/settings">
      <p className="text-sm text-muted">New entries start with these times.</p>
      <ul className="mt-4 space-y-3">
        {DAYS.map((name, i) => {
          const day = settings.schedule[i]
          return (
            <li key={name} className="rounded-2xl bg-surface p-4">
              <div className="flex min-h-11 items-center justify-between">
                <span className="font-medium">{name}</span>
                <span className="flex items-center gap-3 text-sm text-muted">
                  Off
                  <Switch checked={day === null} label={`${name} off`} onChange={(off) => update(i, off ? null : { ...DEFAULT_DAY })} />
                </span>
              </div>
              {day && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-muted">
                  <label className="grid min-w-0 gap-1">
                    In
                    <input
                      type="time"
                      aria-label={`${name} in`}
                      className={inputCls}
                      value={day.in}
                      onChange={(e) => e.target.value && update(i, { ...day, in: e.target.value })}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1">
                    Out
                    <input
                      type="time"
                      aria-label={`${name} out`}
                      className={inputCls}
                      value={day.out}
                      onChange={(e) => e.target.value && update(i, { ...day, out: e.target.value })}
                    />
                  </label>
                  <label className="col-span-2 grid min-w-0 gap-1">
                    Break (min)
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      aria-label={`${name} break (min)`}
                      className={inputCls}
                      value={day.breakMin}
                      onChange={(e) => update(i, { ...day, breakMin: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    />
                  </label>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Screen>
  )
}
