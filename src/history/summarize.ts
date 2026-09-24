import { offerVariantLabel } from '../lib/offerVariants'
import { audienceLabel } from '../store/useJourney'
import type { JourneyFile, JourneyStepFile, JourneyStepKind } from '../journey/types'
import type { Play } from '../types/orchestration'

/** How an activity entry is classified — drives its icon and whether it can be restored. */
export type HistoryKind = 'edit' | 'milestone' | 'restore'

const STEP_LABEL: Record<JourneyStepKind, string> = {
  loss_aversion: 'Loss aversion',
  survey: 'Survey',
  offer: 'Offer',
  pricing_table: 'Pricing table',
  checkout: 'Checkout',
  confirmation: 'Confirmation',
  outcome_saved: 'Saved outcome',
  outcome_cancelled: 'Cancelled outcome',
}

const SHELL_LABEL: Record<string, string> = {
  modal: 'Modal',
  fullpage: 'Full page',
  fullpage_scroll: 'Scrolling page',
}

function stepIds(file: JourneyFile): string {
  return file.steps.map((s) => s.id).join('|')
}

function contentChanged(a: JourneyStepFile, b: JourneyStepFile): boolean {
  return JSON.stringify(a.content ?? null) !== JSON.stringify(b.content ?? null)
}

/**
 * A human label for a JourneyFile edit, or null when nothing meaningful moved.
 * Highest-signal change wins so a burst of derived writes reads as one action.
 */
export function summarizeFileChange(prev: JourneyFile, next: JourneyFile): string | null {
  if (prev === next) return null

  // Going from a blank canvas to a real journey is the first big moment.
  if (prev.steps.length === 0 && next.steps.length > 0) return 'Created the journey'
  if (prev.template !== next.template && prev.template !== 'none') return 'Switched template'

  if (prev.name !== next.name) return 'Renamed journey'

  // Step set / order first — structural changes read strongest.
  if (stepIds(prev) !== stepIds(next)) {
    if (next.steps.length > prev.steps.length) {
      const added = next.steps.find((s) => !prev.steps.some((p) => p.id === s.id))
      return added ? `Added ${STEP_LABEL[added.kind].toLowerCase()}` : 'Added a step'
    }
    if (next.steps.length < prev.steps.length) {
      const removed = prev.steps.find((s) => !next.steps.some((n) => n.id === s.id))
      return removed ? `Removed ${STEP_LABEL[removed.kind].toLowerCase()}` : 'Removed a step'
    }
    return 'Reordered steps'
  }

  // Same steps, same order — look for per-step field edits.
  for (const nextStep of next.steps) {
    const prevStep = prev.steps.find((p) => p.id === nextStep.id)
    if (!prevStep) continue
    if (prevStep.offer !== nextStep.offer) {
      return `Changed offer to ${offerVariantLabel(nextStep.offer ?? 'discount')}`
    }
    if (contentChanged(prevStep, nextStep)) {
      return `Edited ${STEP_LABEL[nextStep.kind].toLowerCase()} content`
    }
    if (prevStep.headline !== nextStep.headline || prevStep.body !== nextStep.body) {
      return `Edited ${STEP_LABEL[nextStep.kind].toLowerCase()} copy`
    }
  }

  if (prev.audience !== next.audience) return `Audience -> ${audienceLabel(next.audience)}`
  if (prev.holdout !== next.holdout) {
    return next.holdout === 0 ? 'Holdout -> none' : `Holdout -> ${next.holdout}%`
  }
  if (prev.shell !== next.shell) return `Shell -> ${SHELL_LABEL[next.shell] ?? next.shell}`

  const pb = prev.brand
  const nb = next.brand
  if (pb.matched !== nb.matched && nb.matched) return 'Matched brand'
  if (JSON.stringify(pb) !== JSON.stringify(nb)) return 'Updated brand'

  if (JSON.stringify(prev.cancelHandling ?? null) !== JSON.stringify(next.cancelHandling ?? null)) {
    return 'Set cancellation handling'
  }

  return null
}

/** Publish/unpublish is a milestone, not a restorable version. */
export function publishMilestone(prev: Play, next: Play): string | null {
  if (prev.publishState === next.publishState) return null
  return next.publishState === 'live' ? 'Published' : 'Unpublished'
}

/** Traffic-split / targeting graph edits that don't live on the JourneyFile. */
export function targetingChanged(prev: Play, next: Play): boolean {
  return prev.targeting !== next.targeting
}

const CONFIRM_LABEL: Record<string, string> = {
  audience: 'Confirmed audience',
  holdout: 'Confirmed control (holdout)',
  offers: 'Confirmed offers',
  experiment: 'Reviewed experiment',
  walk: 'Walked the experience',
  reporting: 'Noted reporting',
}

export function confirmLabel(id: string): string {
  return CONFIRM_LABEL[id] ?? 'Confirmed a step'
}
