import { SBadge, SButton, SProgressBar } from '@chargebee/sting-react'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { jumpSetupItem } from './setupActions'
import { setupProgress, type SetupItem, type SetupTrack } from './setupTracker'

export function useSetupProgress() {
  const file = useJourney((s) => s.file)
  const play = useOrchestration((s) => s.play)
  const experience = useExperience((s) => s.experiences[PRIMARY_EXPERIENCE_ID])
  const confirmed = useOrchestration((s) => s.confirmedSetup)
  const walkedOrSkipped = useOrchestration((s) => s.walkedOrSkipped)
  const stepStripShown = useOrchestration((s) => s.stepStripShown)
  const dismissedStepNeedsWork = useOrchestration((s) => s.dismissedStepNeedsWork)
  return setupProgress({
    file,
    play,
    experience,
    confirmed,
    walkedOrSkipped,
    stepStripShown,
    dismissedStepNeedsWork,
  })
}

function TrackColumn({
  title,
  done,
  total,
  items,
  highlight,
}: {
  title: string
  done: number
  total: number
  items: SetupItem[]
  highlight?: SetupItem['id']
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-st flex items-baseline justify-between gap-ti">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="text-[11px] tabular-nums text-slate-400">
          {done}/{total}
        </p>
      </div>
      <div className="relative h-sm">
        <SProgressBar
          infinite={false}
          value={total === 0 ? 0 : Math.round((done / total) * 100)}
          variant={done === total && total > 0 ? 'success' : 'primary'}
        />
      </div>
      <ul className="mt-st space-y-ti">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => jumpSetupItem(item.id)}
              className={`flex w-full items-start gap-st rounded-xl px-st py-ti text-left transition-colors hover:bg-slate-50 ${
                highlight === item.id ? 'bg-indigo-50' : ''
              }`}
            >
              <SBadge variant={item.done ? 'success' : 'warning'} rounded>
                {item.done ? 'Ready' : 'Needs work'}
              </SBadge>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-slate-800">{item.label}</span>
                <span className="mt-px block text-[11px] leading-snug text-slate-500">{item.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Full two-track checklist — center Copilot and the expanded rail chip. */
export function SetupTrackerPanel({ highlight }: { highlight?: SetupItem['id'] }) {
  const progress = useSetupProgress()
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-md py-st">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Setup</p>
        <p className="text-[13px] font-bold text-slate-900">Journey completion</p>
      </div>
      <div className="flex gap-md p-md">
        <TrackColumn
          title="Play setup"
          done={progress.playDone}
          total={progress.playTotal}
          items={progress.play}
          highlight={highlight}
        />
        <TrackColumn
          title="Experience"
          done={progress.experienceDone}
          total={progress.experienceTotal}
          items={progress.experience}
          highlight={highlight}
        />
      </div>
    </div>
  )
}

/** Compact chip for the play header while Copilot is on the rail. */
export function SetupTrackerChip({
  expanded,
  onToggle,
}: {
  expanded: boolean
  onToggle: () => void
}) {
  const progress = useSetupProgress()
  return (
    <div className="relative">
      <SButton size="small" variant="neutral-outline" onClick={onToggle}>
        Play {progress.playDone}/{progress.playTotal} · Experience {progress.experienceDone}/
        {progress.experienceTotal}
      </SButton>
      {expanded && (
        <div className="absolute right-0 top-full z-40 mt-ti w-[420px]">
          <SetupTrackerPanel />
        </div>
      )}
    </div>
  )
}

export function trackForItem(id: SetupItem['id']): SetupTrack {
  return id === 'audience' || id === 'targeting' || id === 'offers' || id === 'holdout'
    ? 'play'
    : 'experience'
}
