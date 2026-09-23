import { SButton, SIcon, SProgressBar } from '@chargebee/sting-react'
import { EASE_ENTER, EASE_LEAVE, PANEL_MS } from '../lib/motion'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useCopilotThread } from './copilotThread'
import { jumpSetupItem } from './setupActions'
import { trackerItemForSpotlight } from './spotlight'
import { useLookTarget } from './useLookTarget'
import { setupProgress, type SetupItem, type SetupGroupId } from './setupTracker'

export function useSetupProgress() {
  const file = useJourney((s) => s.file)
  const play = useOrchestration((s) => s.play)
  const experience = useExperience((s) => s.experiences[PRIMARY_EXPERIENCE_ID])
  const confirmed = useOrchestration((s) => s.confirmedSetup)
  const installConnected = useOrchestration((s) => s.installConnected)
  const walkedOrSkipped = useOrchestration((s) => s.walkedOrSkipped)
  const stepStripShown = useOrchestration((s) => s.stepStripShown)
  const dismissedStepNeedsWork = useOrchestration((s) => s.dismissedStepNeedsWork)
  return setupProgress({
    file,
    play,
    experience,
    confirmed,
    installConnected,
    walkedOrSkipped,
    stepStripShown,
    dismissedStepNeedsWork,
  })
}

function useTrackerHighlight(): { item?: SetupItem['id']; pulsed: boolean } {
  const look = useLookTarget()
  const fromLook = look ? trackerItemForSpotlight(look) : undefined
  const turn = useCopilotThread((s) => s.turn)
  const beat = useCopilotThread((s) => s.beat)
  if (fromLook) return { item: fromLook, pulsed: true }
  if (turn !== 'plan') return { item: undefined, pulsed: false }
  if (beat === 'audience' || beat === 'holdout' || beat === 'offers' || beat === 'walk' || beat === 'brand') {
    return { item: beat, pulsed: false }
  }
  return { item: undefined, pulsed: false }
}

/**
 * Status pill. Ready / Needs work for real gates; an informational pointer
 * (Reporting) and the publish gate get their own neutral wording so the
 * checklist doesn't read as "incomplete" for things that aren't gates.
 */
function StatusBadge({ item }: { item: SetupItem }) {
  if (item.info) {
    return (
      <span className="shrink-0 rounded-[6px] bg-slate-100 px-[6px] py-[2px] text-[10px] font-semibold leading-[14px] text-slate-500">
        {item.done ? 'Noted' : 'After launch'}
      </span>
    )
  }
  if (item.gate) {
    return (
      <span
        className={`shrink-0 rounded-[6px] px-[6px] py-[2px] text-[10px] font-semibold leading-[14px] ${
          item.done ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
        }`}
      >
        {item.done ? 'Live' : 'Ready to publish'}
      </span>
    )
  }
  return (
    <span
      className={`shrink-0 rounded-[6px] px-[6px] py-[2px] text-[10px] font-semibold leading-[14px] ${
        item.done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
      }`}
    >
      {item.done ? 'Ready' : 'Needs work'}
    </span>
  )
}

function TrackColumn({
  title,
  done,
  total,
  items,
  highlight,
  pulsed,
}: {
  title: string
  done: number
  total: number
  items: SetupItem[]
  highlight?: SetupItem['id']
  pulsed?: boolean
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <section className="min-w-0">
      <div className="mb-[8px] flex items-baseline justify-between gap-[8px] px-[12px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
        <p className="text-[11px] tabular-nums text-slate-400">
          {done}/{total}
        </p>
      </div>
      <div className="relative mx-[12px] h-[4px] overflow-hidden rounded-full">
        <SProgressBar
          infinite={false}
          value={pct}
          variant={done === total && total > 0 ? 'success' : 'primary'}
        />
      </div>
      <ul className="mt-[8px] flex flex-col gap-[2px]">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => jumpSetupItem(item.id)}
              className={`flex w-full items-start rounded-[12px] px-[12px] py-[10px] text-left transition-colors hover:bg-slate-50 ${
                highlight === item.id ? 'bg-indigo-50' : ''
              } ${highlight === item.id && pulsed ? 'cb-spotlight-ring' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-[8px]">
                  <span className="text-[13px] font-semibold leading-[18px] text-slate-800">
                    {item.label}
                  </span>
                  <StatusBadge item={item} />
                </span>
                <span className="mt-[4px] block text-[12px] leading-[16px] text-slate-500">
                  {item.hint}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ProgressDonut({
  percent,
  complete,
}: {
  percent: number
  complete: boolean
}) {
  const fill = complete ? '#10b981' : '#4f46e5'
  return (
    <span
      aria-hidden
      className="relative flex size-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${fill} ${percent}%, #e2e8f0 0)` }}
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-white text-[9px] font-bold tabular-nums leading-none text-slate-800">
        {percent}%
      </span>
    </span>
  )
}

/**
 * Persistent journey-completion dock. One surface: a compact pill when closed,
 * the same shell growing up into the checklist. Anchored bottom-left.
 */
export function SetupTrackerDock() {
  const hasSteps = useJourney((s) => s.file.steps.length > 0)
  const progress = useSetupProgress()
  const open = useOrchestration((s) => s.trackerOpen)
  const setTrackerOpen = useOrchestration((s) => s.setTrackerOpen)
  const highlight = useTrackerHighlight()
  const pct = progress.percent
  const complete = progress.done === progress.total && progress.total > 0
  const ease = open ? EASE_ENTER : EASE_LEAVE
  const nextLine = complete
    ? 'Ready to publish'
    : progress.next
      ? `Next: ${progress.next.label}`
      : 'Start a cancel path'
  const statusLine = complete
    ? 'All steps ready'
    : `${progress.done} of ${progress.total} complete`

  if (!hasSteps) return null

  return (
    <div
      className="overflow-hidden border border-slate-200 bg-white motion-reduce:transition-none"
      style={{
        width: open ? 304 : 280,
        borderRadius: open ? 20 : 999,
        transition: `width ${PANEL_MS}ms ${ease}, border-radius ${PANEL_MS}ms ${ease}, box-shadow ${PANEL_MS}ms ${ease}`,
        boxShadow: open
          ? '0 16px 48px rgba(15, 23, 42, 0.16)'
          : '0 8px 24px rgba(15, 23, 42, 0.10)',
      }}
    >
      <div
        className="overflow-x-hidden overflow-y-auto motion-reduce:transition-none"
        style={{
          maxHeight: open ? 'min(720px, 74vh)' : 0,
          transition: `max-height ${PANEL_MS}ms ${ease}`,
        }}
        aria-hidden={!open}
        {...(!open ? { inert: '' } : {})}
      >
        <div className="flex items-center justify-between gap-[12px] px-[20px] pb-[4px] pt-[16px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Journey completion
          </p>
          <SButton
            size="small"
            variant="neutral-ghost"
            aria-label="Collapse journey completion"
            onClick={() => setTrackerOpen(false)}
            icon={<SIcon name="x" size={14} />}
          />
        </div>
        <div className="flex flex-col gap-[18px] px-[8px] pb-[16px] pt-[12px]">
          {progress.groups.map((group) => (
            <TrackColumn
              key={group.id}
              title={group.title}
              done={group.done}
              total={group.total}
              items={group.items}
              highlight={highlight.item}
              pulsed={highlight.pulsed}
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-label={`${statusLine}. ${nextLine}`}
        onClick={() => {
          if (!open) setTrackerOpen(true)
        }}
        className={`flex w-full items-center gap-[12px] text-left ${
          open ? 'border-t border-slate-100 px-[20px] py-[12px]' : 'px-[14px] py-[10px]'
        }`}
      >
        <ProgressDonut percent={pct} complete={complete} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold leading-snug tracking-tight text-slate-900">
            {statusLine}
          </span>
          <span className="mt-px block truncate text-[12px] leading-snug text-slate-500">{nextLine}</span>
        </span>
        {!open && <SIcon name="chevron-up" size={16} className="shrink-0 text-slate-400" />}
      </button>
    </div>
  )
}

export function trackForItem(id: SetupItem['id']): SetupGroupId {
  switch (id) {
    case 'connect':
      return 'connect'
    case 'audience':
    case 'experiment':
    case 'holdout':
      return 'play'
    case 'walk':
    case 'publish':
    case 'reporting':
      return 'launch'
    default:
      return 'page'
  }
}
