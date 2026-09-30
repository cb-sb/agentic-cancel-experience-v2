import { experienceRows, playRows, summarize, useSetupInputs, workspaceRows } from './progress'

/** A small ring for how much of a checklist is done. */
export function ProgressRing({ percent, size = 14, stroke = 2.5 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const done = percent >= 100
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="flex-none -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={done ? '#10b981' : '#6366f1'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(100, percent) / 100)}
        style={{ transition: 'stroke-dashoffset 300ms ease' }}
      />
    </svg>
  )
}

function Pill({ resolved, counted, percent, label }: { resolved: number; counted: number; percent: number; label: string }) {
  if (counted === 0) return null
  return (
    <span title={`${label}: ${resolved} of ${counted} done`} className="flex flex-none items-center gap-[3px] text-[10.5px] tabular-nums text-slate-400">
      <ProgressRing percent={percent} size={12} stroke={2} />
      {percent < 100 && `${resolved}/${counted}`}
    </span>
  )
}

export function ExperienceProgressPill({ experienceId }: { experienceId: string }) {
  const inputs = useSetupInputs()
  const s = summarize(experienceRows(experienceId, inputs))
  return <Pill resolved={s.resolved} counted={s.counted} percent={s.percent} label="Setup" />
}

export function PlayProgressPill({ playId }: { playId: string }) {
  const inputs = useSetupInputs()
  const s = summarize([...playRows(playId, inputs), ...workspaceRows(inputs)])
  return <Pill resolved={s.resolved} counted={s.counted} percent={s.percent} label="Play setup" />
}
