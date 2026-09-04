/**
 * The play intent — everything the agent needs to know before it can draft a
 * plan, plus the logic that decides what is still missing.
 *
 * Per PRD §5.1 the agent asks about at most one gap per turn, in the fixed
 * priority order `outcome → usecase → audience → intensity`, and never asks
 * more than four questions in total. Anything still unknown after that is
 * defaulted and surfaced under the plan card's Assumptions.
 */

import { MAX_STEPS, type ReasonCode } from '../../types/experience'
import { AGENT_POLICY, DEFAULT_SEGMENT_ID, type Posture } from '../../lib/growthContext'

/** Workflow families the merchant might be describing. Only `cancel` ships. */
export type Workflow = 'cancel' | 'dunning' | 'at_risk' | 'upsell'

/** What the merchant is optimising for. Drives posture and offer selection. */
export type Outcome = 'revenue' | 'insight' | 'compliance'

/** How hard the flow pushes to save. Mirrors the blueprint postures. */
export type Intensity = Posture

export interface PlayIntent {
  /** The merchant's own words, kept for the transcript and the goal line. */
  prompt: string
  workflow: Workflow | null
  outcome: Outcome | null
  /** A `SEGMENTS` id. */
  segmentId: string | null
  intensity: Intensity | null
  /** Step count explicitly requested in the prompt. */
  stepCount: number | null
  /** `OFFER_LIBRARY` ids named in the prompt. */
  offerIds: string[]
  /** Reason codes named in the prompt. */
  reasonCodes: ReasonCode[]
  /** Explicit survey ask (or refusal) in the prompt. */
  wantsSurvey: boolean | null
  /** The prompt asked for something the engine cannot express (counter-offers). */
  wantsCounterOffer: boolean
  /** Gaps already put to the merchant, so nothing is asked twice. */
  asked: Gap[]
}

export type Gap = 'outcome' | 'workflow' | 'segment' | 'intensity'

/** PRD §5.1 priority order. */
export const GAP_ORDER: Gap[] = ['outcome', 'workflow', 'segment', 'intensity']

/** PRD §5.1 — never interrogate the merchant beyond this. */
export const MAX_QUESTIONS = 4

export function emptyIntent(prompt = ''): PlayIntent {
  return {
    prompt,
    workflow: null,
    outcome: null,
    segmentId: null,
    intensity: null,
    stepCount: null,
    offerIds: [],
    reasonCodes: [],
    wantsSurvey: null,
    wantsCounterOffer: false,
    asked: [],
  }
}

function isFilled(intent: PlayIntent, gap: Gap): boolean {
  switch (gap) {
    case 'outcome':
      return intent.outcome !== null
    case 'workflow':
      return intent.workflow !== null
    case 'segment':
      return intent.segmentId !== null
    case 'intensity':
      return intent.intensity !== null
  }
}

/** The next thing worth asking about, or null when it is time to draft. */
export function nextGap(intent: PlayIntent): Gap | null {
  if (intent.asked.length >= MAX_QUESTIONS) return null
  for (const gap of GAP_ORDER) {
    if (intent.asked.includes(gap)) continue
    if (!isFilled(intent, gap)) return gap
  }
  return null
}

/** How many questions are still available before the cap bites. */
export function questionsLeft(intent: PlayIntent): number {
  return Math.max(0, MAX_QUESTIONS - intent.asked.length)
}

// ---------------------------------------------------------------------------
// Pushback
// ---------------------------------------------------------------------------

export interface Pushback {
  /** What the merchant asked for. */
  requested: string
  /** Why it cannot be built. */
  reason: string
  /** What the agent proposes instead. */
  counter: string
  /** Label on the accept chip. */
  accept: string
  /** Intent patch applied when the merchant accepts the counter-proposal. */
  patch: Partial<PlayIntent>
}

/**
 * Asks that the engine cannot honour. Returned instead of a plan so the agent
 * can say no before it spends a turn drafting something it must then retract.
 */
export function unrealistic(intent: PlayIntent): Pushback | null {
  if (intent.stepCount !== null && intent.stepCount > MAX_STEPS) {
    return {
      requested: `a ${intent.stepCount}-step flow`,
      reason: `The FTC click-to-cancel rule caps a cancel flow at ${MAX_STEPS} steps, and every step past the fourth drops completion by roughly 8%.`,
      counter: `Cap it at ${MAX_STEPS} steps and route the save offers off the survey reason instead — you get the same number of save attempts without the extra friction.`,
      accept: `Cap it at ${MAX_STEPS} steps and draft the plan`,
      patch: { stepCount: MAX_STEPS },
    }
  }
  if (intent.offerIds.length > AGENT_POLICY.maxOffersPerFlow) {
    return {
      requested: `${intent.offerIds.length} offers in one flow`,
      reason: `Account policy allows ${AGENT_POLICY.maxOffersPerFlow} distinct save offers per flow.`,
      counter: `I'll keep the ${AGENT_POLICY.maxOffersPerFlow} with the strongest acceptance for your segment and note the rest.`,
      accept: `Keep the strongest ${AGENT_POLICY.maxOffersPerFlow} and draft the plan`,
      patch: { offerIds: intent.offerIds.slice(0, AGENT_POLICY.maxOffersPerFlow) },
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Posture implied by an outcome, when the prompt gives no other signal. */
export function intensityForOutcome(outcome: Outcome): Intensity {
  switch (outcome) {
    case 'compliance':
      return 'clean_exit'
    case 'insight':
      return 'clean_exit'
    case 'revenue':
      return 'balanced'
  }
}

export interface ResolvedIntent {
  prompt: string
  workflow: Workflow
  outcome: Outcome
  segmentId: string
  intensity: Intensity
  stepCount: number | null
  offerIds: string[]
  reasonCodes: ReasonCode[]
  wantsSurvey: boolean | null
  wantsCounterOffer: boolean
  /** Fields the agent filled in itself — these become plan-card assumptions. */
  defaulted: Gap[]
}

/** Fill everything still unknown with a defensible default. */
export function resolveIntent(intent: PlayIntent): ResolvedIntent {
  const defaulted: Gap[] = []
  if (intent.workflow === null) defaulted.push('workflow')
  if (intent.outcome === null) defaulted.push('outcome')
  if (intent.segmentId === null) defaulted.push('segment')
  if (intent.intensity === null) defaulted.push('intensity')

  const workflow: Workflow = intent.workflow ?? 'cancel'
  const outcome: Outcome = intent.outcome ?? 'revenue'
  const segmentId = intent.segmentId ?? DEFAULT_SEGMENT_ID
  const intensity: Intensity = intent.intensity ?? intensityForOutcome(outcome)

  return {
    prompt: intent.prompt,
    workflow,
    outcome,
    segmentId,
    intensity,
    stepCount: intent.stepCount === null ? null : Math.min(intent.stepCount, MAX_STEPS),
    offerIds: intent.offerIds,
    reasonCodes: intent.reasonCodes,
    wantsSurvey: intent.wantsSurvey,
    wantsCounterOffer: intent.wantsCounterOffer,
    defaulted,
  }
}
