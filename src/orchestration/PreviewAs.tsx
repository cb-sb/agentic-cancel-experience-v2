import { audienceMatches, playVariants, resolvePlay, SAMPLE_SUBSCRIBERS, type Resolution } from '../play/resolve'
import { PRIMARY_EXPERIENCE_ID } from '../lib/orchestrationSeed'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import { byPriority, useCancelSettings } from '../workspace/useCancelSettings'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'

type Outcome =
  | { show: 'page'; note: string | null }
  | { show: 'message'; title: string; body: string }

function subscriberFor(id: string) {
  return id.startsWith('sub:') ? SAMPLE_SUBSCRIBERS.find((s) => `sub:${s.id}` === id) : undefined
}

/** What the picked subscriber or branch gets, and which experience the preview should play. */
export function usePreviewOutcome(): Outcome {
  const previewAs = useWorkspaceUi((s) => s.previewAs)
  const play = useOrchestration((s) => s.play)
  const globalControl = useCancelSettings((s) => s.globalControl)
  const fallbackId = useCancelSettings((s) => s.globalFallbackId)
  const priority = useCancelSettings((s) => s.priority)
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)

  if (previewAs.startsWith('branch:')) {
    const v = playVariants(play).find((x) => `branch:${x.branchId}` === previewAs)
    return { show: 'page', note: v ? `${v.label}: ${v.share}` : null }
  }
  const sub = subscriberFor(previewAs)
  if (!sub) return { show: 'page', note: null }

  const r: Resolution = resolvePlay(play, sub, globalControl)
  if (r.kind === 'control') {
    return {
      show: 'message',
      title: 'No cancel treatment',
      body: `${sub.name} is in the Global control group (${globalControl}% of everyone who clicks Cancel). They cancel with no cancel page, so you can compare them with everyone else.`,
    }
  }
  if (r.kind === 'outside') {
    const fallback = threads.find((t) => t.id === fallbackId)
    if (fallback?.id === activeId) return { show: 'page', note: `${sub.name} is outside this audience and gets it as the Global fallback.` }
    return {
      show: 'message',
      title: fallback ? `Gets the Global fallback: ${fallback.title}` : 'No cancel page',
      body: fallback
        ? `${sub.name} is outside this experience's audience (${play.audience.name}). Subscribers no audience matches get the Global fallback.`
        : `${sub.name} is outside this experience's audience (${play.audience.name}), and there is no Global fallback, so they cancel with no cancel page.`,
    }
  }
  if (r.kind === 'no_page') {
    return { show: 'message', title: 'No cancel page', body: `${sub.name} lands in "${r.label}", which shows no cancel page.` }
  }

  const ranked = byPriority(threads, priority)
  const above = ranked.slice(0, ranked.findIndex((t) => t.id === activeId))
  const winner = above.find(
    (t) => t.snapshot?.play.publishState === 'live' && audienceMatches(t.snapshot.play.audience, sub.props),
  )
  if (winner) {
    return {
      show: 'message',
      title: `Gets ${winner.title} instead`,
      body: `${winner.title} is live, ranked above this one, and its audience also matches ${sub.name}. The higher-ranked cancel experience wins. Change the order on the Experiences page.`,
    }
  }
  return { show: 'page', note: `${sub.name} gets ${r.label}: ${r.share}.` }
}

function pick(value: string) {
  useWorkspaceUi.getState().setPreviewAs(value)
  const play = useOrchestration.getState().play
  const exp = useExperience.getState()
  let target: string | null = null
  if (value === '') target = exp.activeExperienceId
  else if (value.startsWith('branch:')) {
    target = playVariants(play).find((v) => `branch:${v.branchId}` === value)?.experienceId ?? null
  } else {
    const sub = subscriberFor(value)
    const { globalControl } = useCancelSettings.getState()
    const r = sub ? resolvePlay(play, sub, globalControl) : null
    target = r?.kind === 'page' ? r.experienceId : r?.kind === 'outside' ? PRIMARY_EXPERIENCE_ID : null
  }
  if (target && exp.experiences[target]) exp.setActiveExperience(target)
  else exp.resetSession()
}

export function PreviewAsPicker() {
  const previewAs = useWorkspaceUi((s) => s.previewAs)
  const play = useOrchestration((s) => s.play)
  const branches = playVariants(play).filter((v) => v.experienceId)
  return (
    <label className="flex items-center gap-[6px] pl-[6px] text-[12.5px] text-slate-500">
      Preview as
      <select
        value={previewAs}
        onChange={(e) => pick(e.target.value)}
        className="max-w-[220px] rounded-md border border-slate-200 bg-white px-[6px] py-[4px] text-[12.5px] font-medium text-slate-800 outline-none hover:border-slate-300"
      >
        <option value="">The variant you are editing</option>
        {branches.length > 1 && (
          <optgroup label="Variants">
            {branches.map((v) => (
              <option key={v.branchId} value={`branch:${v.branchId}`}>
                {v.label}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Sample subscribers">
          {SAMPLE_SUBSCRIBERS.map((s) => (
            <option key={s.id} value={`sub:${s.id}`}>
              {s.name}, {s.summary.toLowerCase()}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  )
}
