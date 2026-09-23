import { isBrandMatched } from '../brand/matchSite'
import type { JourneyFile } from '../journey/types'
import { anyStepNeedsWork } from '../lib/stepNeedsWork'
import type { Experience } from '../types/experience'
import type { Play } from '../types/orchestration'

/**
 * The tracker mirrors Chargebee Growth's real planes: a connect prerequisite,
 * the cancel page itself, the play that targets it, and launch.
 */
export type SetupGroupId = 'connect' | 'page' | 'play' | 'launch'

export type SetupItemId =
  | 'connect'
  | 'chain'
  | 'content'
  | 'survey'
  | 'offers'
  | 'cancelHandling'
  | 'confirmation'
  | 'brand'
  | 'stepConfig'
  | 'audience'
  | 'experiment'
  | 'holdout'
  | 'walk'
  | 'publish'
  | 'reporting'

export interface SetupItem {
  id: SetupItemId
  group: SetupGroupId
  label: string
  hint: string
  done: boolean
  /**
   * Informational pointer, not a completion gate — shown as a row but excluded
   * from every progress count (e.g. Reporting, which only matters post-launch).
   */
  info?: boolean
  /**
   * The culminating publish gate. Shown and counted inside its group, but
   * excluded from the pre-publish readiness math so publishing is not gated on
   * having already published.
   */
  gate?: boolean
}

export interface SetupGroup {
  id: SetupGroupId
  title: string
  items: SetupItem[]
  done: number
  total: number
}

export interface SetupProgress {
  groups: SetupGroup[]
  done: number
  total: number
  remaining: number
  percent: number
  next: SetupItem | null
  gaps: string[]
  ready: boolean
}

export type ConfirmedSetup = Partial<Record<SetupItemId, boolean>>

const GROUP_TITLE: Record<SetupGroupId, string> = {
  connect: 'Connect',
  page: 'Cancel page',
  play: 'Play',
  launch: 'Launch',
}

const GROUP_ORDER: SetupGroupId[] = ['connect', 'page', 'play', 'launch']

/** A real A/B: a split that actually divides traffic between treatments. */
function hasExperiment(play: Play): boolean {
  return play.targeting.kind === 'split' && play.targeting.mode !== 'single'
}

/** A play-graph holdout branch, the counterpart to `file.holdout`. */
function playHasHoldout(play: Play): boolean {
  return play.targeting.kind === 'split' && play.targeting.branches.some((b) => b.node.kind === 'holdout')
}

/**
 * Offers are ready when every offer step has a save mechanic AND its placement
 * has a home: a reason-linked offer needs a survey step to route from, an entry
 * offer does not.
 */
function offersReady(file: JourneyFile): boolean {
  const offers = file.steps.filter((s) => s.kind === 'offer')
  if (offers.length === 0) return true
  if (!offers.every((s) => Boolean(s.offer))) return false
  const hasReasonLinked = offers.some((s) => s.id !== 'entry')
  const hasSurvey = file.steps.some((s) => s.kind === 'survey')
  return !hasReasonLinked || hasSurvey
}

/** Loss-aversion / personalization content: a headline and at least one bullet. */
function contentReady(experience: Experience | undefined): boolean {
  if (!experience) return true
  const laSteps = experience.steps.filter((st) =>
    st.components.some((c) => c.kind === 'loss_aversion'),
  )
  if (laSteps.length === 0) return true
  return laSteps.every((st) => {
    const la = st.components.find((c) => c.kind === 'loss_aversion')
    if (!la || la.kind !== 'loss_aversion') return true
    const bullets = (la.keepItems?.length ?? 0) + (la.loseItems?.length ?? 0)
    return Boolean((st.title ?? '').trim()) && bullets > 0
  })
}

/** Survey reasons chosen: every survey step has options, or is free-text only. */
function surveyReady(experience: Experience | undefined): boolean {
  if (!experience) return true
  const surveySteps = experience.steps.filter((st) =>
    st.components.some((c) => c.kind === 'survey'),
  )
  if (surveySteps.length === 0) return true
  return surveySteps.every((st) => {
    const sv = st.components.find((c) => c.kind === 'survey')
    if (!sv || sv.kind !== 'survey') return true
    return sv.options.length > 0 || sv.presentation === 'free_text'
  })
}

/** The page has a final step — a confirmation or an outcome screen. */
function confirmationReady(file: JourneyFile): boolean {
  return file.steps.some(
    (s) => s.kind === 'confirmation' || s.kind === 'outcome_saved' || s.kind === 'outcome_cancelled',
  )
}

/** Cancellation handling: how the cancel is processed and when it takes effect. */
function cancelHandlingReady(file: JourneyFile): boolean {
  const ch = file.cancelHandling
  return Boolean(ch?.processing && ch?.timing)
}

export function setupProgress(args: {
  file: JourneyFile
  play: Play
  experience: Experience | undefined
  confirmed: ConfirmedSetup
  installConnected: boolean
  walkedOrSkipped: boolean
  stepStripShown: boolean
  dismissedStepNeedsWork: boolean
}): SetupProgress {
  const {
    file,
    play,
    experience,
    confirmed,
    installConnected,
    walkedOrSkipped,
    stepStripShown,
    dismissedStepNeedsWork,
  } = args

  const hasOffers = file.steps.some((s) => s.kind === 'offer')
  const hasSurvey = file.steps.some((s) => s.kind === 'survey')
  const experiment = hasExperiment(play)
  const stepsReady =
    dismissedStepNeedsWork || !experience || !anyStepNeedsWork(experience.steps, file)
  const live = play.publishState === 'live'

  const items: SetupItem[] = []

  // Connect — the prerequisite plane.
  items.push({
    id: 'connect',
    group: 'connect',
    label: 'Billing and install',
    hint: 'Growth connected to Billing, snippet in place',
    done: installConnected,
  })

  // Cancel page — the experience the subscriber sees.
  items.push({
    id: 'chain',
    group: 'page',
    label: 'Step chain',
    hint: 'The screens a subscriber walks',
    done: stepStripShown && file.steps.length > 0,
  })
  items.push({
    id: 'content',
    group: 'page',
    label: 'Content and message',
    hint: 'Headline and loss-aversion cards',
    done: contentReady(experience),
  })
  if (hasSurvey) {
    items.push({
      id: 'survey',
      group: 'page',
      label: 'Survey and reasons',
      hint: 'Cancel reasons the survey collects',
      done: surveyReady(experience),
    })
  }
  if (hasOffers) {
    items.push({
      id: 'offers',
      group: 'page',
      label: 'Offers and placement',
      hint: 'A mechanic and a home on every offer',
      done: offersReady(file),
    })
  }
  items.push({
    id: 'cancelHandling',
    group: 'page',
    label: 'Cancellation handling',
    hint: 'How the cancel is processed and timed',
    done: cancelHandlingReady(file),
  })
  items.push({
    id: 'confirmation',
    group: 'page',
    label: 'Confirmation step',
    hint: 'A final confirm or outcome screen',
    done: confirmationReady(file),
  })
  items.push({
    id: 'brand',
    group: 'page',
    label: 'Brand',
    hint: 'Look of the subscriber UI',
    done: isBrandMatched(file.brand),
  })
  items.push({
    id: 'stepConfig',
    group: 'page',
    label: 'Step config',
    hint: 'Each screen is ready to walk',
    done: file.steps.length > 0 && stepsReady,
  })

  // Play — who it reaches and how traffic is divided.
  items.push({
    id: 'audience',
    group: 'play',
    label: 'Audience',
    hint: 'Who this experience reaches',
    done: Boolean(confirmed.audience) || file.audience !== 'all',
  })
  if (experiment) {
    items.push({
      id: 'experiment',
      group: 'play',
      label: 'Experiment',
      hint: 'A/B offer vs no-offer, traffic split',
      done: Boolean(confirmed.experiment),
    })
  }
  items.push({
    id: 'holdout',
    group: 'play',
    label: 'Control (holdout)',
    hint: 'A no-offer slice to measure lift',
    done: Boolean(confirmed.holdout) || file.holdout !== 0 || playHasHoldout(play),
  })

  // Launch — walk it, publish it, then watch it.
  items.push({
    id: 'walk',
    group: 'launch',
    label: 'Walk',
    hint: 'Preview as a subscriber',
    done: walkedOrSkipped,
  })
  items.push({
    id: 'publish',
    group: 'launch',
    label: 'Publish',
    hint: live ? 'This experience is live' : 'Review and go live',
    done: live,
    gate: true,
  })
  items.push({
    id: 'reporting',
    group: 'launch',
    label: 'Reporting',
    hint: 'Where lift shows after this is live',
    done: Boolean(confirmed.reporting),
    info: true,
  })

  // A counted item is a real pre-publish gate: not informational, not the
  // publish gate itself.
  const counted = items.filter((i) => !i.info && !i.gate)

  const groups: SetupGroup[] = GROUP_ORDER.map((id) => {
    const groupItems = items.filter((i) => i.group === id)
    const groupCounted = groupItems.filter((i) => !i.info)
    return {
      id,
      title: GROUP_TITLE[id],
      items: groupItems,
      done: groupCounted.filter((i) => i.done).length,
      total: groupCounted.length,
    }
  }).filter((g) => g.items.length > 0)

  const gaps = counted.filter((i) => !i.done).map((i) => `${i.label} not confirmed`)
  const done = counted.filter((i) => i.done).length
  const total = counted.length

  return {
    groups,
    done,
    total,
    remaining: total - done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    next: counted.find((i) => !i.done) ?? null,
    gaps,
    ready: gaps.length === 0,
  }
}
