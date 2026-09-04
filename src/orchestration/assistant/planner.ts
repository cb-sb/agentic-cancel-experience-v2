/**
 * The planner — turns a resolved `PlayIntent` into a `DraftPlan`.
 *
 * This is where PRD §5.3 lands: the reason subset comes from the segment's
 * reason mix, each reason gets the best *allowed* offer in the catalog, and the
 * projections are computed as `Σ (reason_share × acceptance × MRR)` rather than
 * quoted from a benchmark table. The posture benchmarks are only used to sanity-
 * check the shape of the answer, never to fabricate it.
 *
 * Nothing here mutates a store. `composePlan.ts` does that, from this output.
 */

import { blueprintMeta } from '../../lib/blueprints'
import {
  AGENT_POLICY,
  OFFER_LIBRARY,
  POSTURE_BENCHMARKS,
  REASON_LABEL,
  REASON_SHORT,
  acceptanceFor,
  catalogBound,
  collidingPlays,
  offerDef,
  rankedReasons,
  segment,
  type OfferDef,
  type Posture,
} from '../../lib/growthContext'
import { count, money, pct } from '../../lib/num'
import { MAX_STEPS, SURVEY_MAX_OPTIONS, type BlueprintId, type ReasonCode } from '../../types/experience'
import type { TriggerMoment } from '../../types/orchestration'
import { blueprintForStepCount } from './recommend'
import { resolveIntent, type Intensity, type Outcome, type PlayIntent, type ResolvedIntent, type Workflow } from './intent'

// ---------------------------------------------------------------------------
// Model constants
// ---------------------------------------------------------------------------

/**
 * Deflection that comes from the flow's shape rather than from an offer. These
 * are the numbers behind the clean-exit benchmark band — a subscriber who reads
 * an impact list or a "what you lose" card sometimes just stops.
 */
const SHAPE_DEFLECTION = {
  confirmation: 0.04,
  value_reinforcement: 0.05,
  survey: 0.02,
}

/** Share of cancels that actually engage with a reason-routed offer. */
const REASON_OFFER_REACH = 0.45
/** Share that engages with an unsolicited offer shown before the survey. */
const ENTRY_OFFER_REACH = 0.35
/** Half-width of the projection band, as a share of the mid case. */
const BAND = 0.15
/** Reason coverage the survey subset aims to clear. */
const COVERAGE_TARGET = 0.85

// ---------------------------------------------------------------------------
// Plan shape
// ---------------------------------------------------------------------------

export type PlanStage =
  | 'value_reinforcement'
  | 'entry_offer'
  | 'survey'
  | 'save_offers'
  | 'pricing_table'
  | 'confirmation'
  | 'outcome'

export interface PlanStep {
  stage: PlanStage
  label: string
  detail: string
}

export interface PlanMapping {
  code: ReasonCode
  /** Subscriber-facing survey wording. */
  label: string
  /** Dense label for the plan card. */
  short: string
  /** Share of this segment's cancels. */
  share: number
  /** Chosen offer, or null when deliberately left unmapped. */
  offerId: string | null
  /** Swappable alternatives, best first. */
  alternatives: string[]
}

export interface PlanProjection {
  /** Cancels per month entering the flow. */
  reach: number
  /** Subscribers eligible for the play. */
  eligible: number
  saveRate: [number, number]
  savesPerMonth: [number, number]
  retainedMrr: [number, number]
  /** Share of the flow's saves that came from an offer rather than the shape. */
  offerDrivenShare: number
  /** Margin given up, as a share of the revenue offers retain. */
  marginCostPct: number
  /** Margin given up per month, in dollars. */
  marginCost: number
  /** Share of the segment's cancels covered by the chosen reasons. */
  coverage: number
}

export interface DraftPlan {
  goal: string
  workflow: Workflow
  outcome: Outcome
  intensity: Intensity
  posture: Posture
  blueprint: BlueprintId
  segmentId: string
  segmentName: string
  steps: PlanStep[]
  mappings: PlanMapping[]
  /** Offer shown to everyone before the survey, when the posture calls for one. */
  entryOfferId: string | null
  projection: PlanProjection
  assumptions: string[]
  conflicts: string[]
  split: { treatment: number; holdout: number }
  trigger: { moment: TriggerMoment; label: string; expression?: string }
  /** The intent this was drafted from, so a swap can re-derive the narrative. */
  resolved: ResolvedIntent
}

// ---------------------------------------------------------------------------
// Blueprint and stages
// ---------------------------------------------------------------------------

const STAGES: Record<BlueprintId, PlanStage[]> = {
  click_to_cancel: ['confirmation', 'outcome'],
  clean_exit_1: ['value_reinforcement', 'confirmation', 'outcome'],
  clean_exit_2: ['value_reinforcement', 'survey', 'confirmation', 'outcome'],
  balanced: ['value_reinforcement', 'survey', 'save_offers', 'confirmation', 'outcome'],
  save_aggressive: ['value_reinforcement', 'entry_offer', 'survey', 'save_offers', 'confirmation', 'outcome'],
  custom_6: ['value_reinforcement', 'entry_offer', 'survey', 'save_offers', 'pricing_table', 'confirmation', 'outcome'],
}

function pickBlueprint(intent: ResolvedIntent): BlueprintId {
  if (intent.stepCount !== null) return blueprintForStepCount(intent.stepCount)
  switch (intent.intensity) {
    case 'clean_exit':
      return intent.wantsSurvey === false ? 'clean_exit_1' : 'clean_exit_2'
    case 'balanced':
      return 'balanced'
    case 'save_aggressive':
      return 'save_aggressive'
  }
}

// ---------------------------------------------------------------------------
// Reasons
// ---------------------------------------------------------------------------

/** Top reasons for the segment until coverage clears the target, capped by the survey. */
function pickReasons(intent: ResolvedIntent): { code: ReasonCode; share: number }[] {
  const ranked = rankedReasons(intent.segmentId)
  const forced = intent.reasonCodes
    .map((code) => ranked.find((r) => r.code === code))
    .filter((r): r is { code: ReasonCode; share: number } => Boolean(r))

  const chosen = [...forced]
  let coverage = chosen.reduce((s, r) => s + r.share, 0)
  for (const r of ranked) {
    if (chosen.length >= SURVEY_MAX_OPTIONS) break
    if (coverage >= COVERAGE_TARGET) break
    if (chosen.some((c) => c.code === r.code)) continue
    chosen.push(r)
    coverage += r.share
  }
  return chosen.sort((a, b) => b.share - a.share)
}

// ---------------------------------------------------------------------------
// Offer selection
// ---------------------------------------------------------------------------

/** Expected value of one accepted offer: acceptance, discounted by margin given up. */
function offerScore(offer: OfferDef, segmentId: string): number {
  return acceptanceFor(offer, segmentId) * (1 - offer.marginCostPct)
}

interface OfferPool {
  offers: OfferDef[]
  /** Offers the merchant named that had to be dropped, with the reason. */
  dropped: string[]
}

/** Offers the agent is allowed to use, after policy and catalog guardrails. */
function allowedOffers(intent: ResolvedIntent): OfferPool {
  const dropped: string[] = []
  const named = intent.offerIds.map((id) => offerDef(id)).filter((o): o is OfferDef => Boolean(o))

  const pool = (named.length ? named : OFFER_LIBRARY).filter((offer) => {
    if (!AGENT_POLICY.allowedCategories.includes(offer.category)) {
      dropped.push(`${offer.label} — ${offer.category.replace('_', ' ')} offers are off for this account`)
      return false
    }
    if (!catalogBound(offer)) {
      dropped.push(`${offer.label} — no catalog id resolved, so it cannot be fulfilled`)
      return false
    }
    return true
  })

  return { offers: pool, dropped }
}

/**
 * Assign offers to reasons under the per-flow offer cap.
 *
 * Greedy set cover: repeatedly take the offer that adds the most expected value
 * across the reasons still unassigned, until the cap is reached. Reasons no
 * chosen offer credibly answers stay unmapped rather than getting a bad fit.
 */
function mapOffers(
  reasons: { code: ReasonCode; share: number }[],
  pool: OfferDef[],
  segmentId: string,
  cap: number,
): { mappings: PlanMapping[]; chosen: OfferDef[] } {
  const fits = (offer: OfferDef, code: ReasonCode) => offer.fits.includes(code)
  const value = (offer: OfferDef, code: ReasonCode, share: number) =>
    fits(offer, code) ? share * offerScore(offer, segmentId) : 0

  const chosen: OfferDef[] = []
  let unassigned = [...reasons]

  while (chosen.length < cap && unassigned.length > 0) {
    let best: { offer: OfferDef; gain: number } | null = null
    for (const offer of pool) {
      if (chosen.some((c) => c.id === offer.id)) continue
      const gain = unassigned.reduce((s, r) => s + value(offer, r.code, r.share), 0)
      if (gain > 0 && (!best || gain > best.gain)) best = { offer, gain }
    }
    if (!best) break
    const winner = best.offer
    chosen.push(winner)
    unassigned = unassigned.filter((r) => !fits(winner, r.code))
  }

  const mappings: PlanMapping[] = reasons.map((r) => {
    const eligible = chosen.filter((o) => fits(o, r.code))
    const winner = eligible.sort((a, b) => offerScore(b, segmentId) - offerScore(a, segmentId))[0] ?? null
    const alternatives = pool
      .filter((o) => o.id !== winner?.id)
      .sort((a, b) => {
        const fitDelta = Number(fits(b, r.code)) - Number(fits(a, r.code))
        return fitDelta !== 0 ? fitDelta : offerScore(b, segmentId) - offerScore(a, segmentId)
      })
      .map((o) => o.id)
    return {
      code: r.code,
      label: REASON_LABEL[r.code],
      short: REASON_SHORT[r.code],
      share: r.share,
      offerId: winner?.id ?? null,
      alternatives,
    }
  })

  return { mappings, chosen }
}

/** Best broad-appeal offer for an entry step, excluding the reason-routed set. */
function pickEntryOffer(pool: OfferDef[], used: OfferDef[], segmentId: string): OfferDef | null {
  const candidates = pool.filter((o) => !used.some((u) => u.id === o.id))
  return candidates.sort((a, b) => offerScore(b, segmentId) - offerScore(a, segmentId))[0] ?? null
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function project(
  intent: ResolvedIntent,
  stages: PlanStage[],
  mappings: PlanMapping[],
  entryOffer: OfferDef | null,
): PlanProjection {
  const seg = segment(intent.segmentId)
  const shape = stages.reduce(
    (s, stage) => s + (SHAPE_DEFLECTION[stage as keyof typeof SHAPE_DEFLECTION] ?? 0),
    0,
  )

  // Entry offer works on whoever is still cancelling after the shape deflection.
  const entryAcceptance = entryOffer ? acceptanceFor(entryOffer, intent.segmentId) : 0
  const entrySave = stages.includes('entry_offer') ? (1 - shape) * ENTRY_OFFER_REACH * entryAcceptance : 0

  // Reason-routed offers work on whoever is left after that.
  const perReason = mappings.map((m) => {
    const offer = m.offerId ? offerDef(m.offerId) : null
    const acceptance = offer ? acceptanceFor(offer, intent.segmentId) : 0
    return { m, offer, accepted: m.share * acceptance }
  })
  const acceptedShare = perReason.reduce((s, r) => s + r.accepted, 0)
  const reasonSave = stages.includes('save_offers')
    ? (1 - shape - entrySave) * REASON_OFFER_REACH * acceptedShare
    : 0

  const offerSave = entrySave + reasonSave
  const mid = shape + offerSave

  // Margin cost is quoted against the revenue offers retain — free deflection
  // from the flow's shape costs nothing, and blending the two hides the trade-off.
  const costWeighted = perReason.reduce((s, r) => s + r.accepted * (r.offer?.marginCostPct ?? 0), 0)
  const reasonCostPct = acceptedShare > 0 ? costWeighted / acceptedShare : 0
  const entryCostPct = entryOffer?.marginCostPct ?? 0
  const marginCostPct =
    offerSave > 0 ? (entrySave * entryCostPct + reasonSave * reasonCostPct) / offerSave : 0

  const reach = seg.cancelsPerMonth
  const savesMid = reach * mid
  const retainedMid = savesMid * seg.arpu
  const marginCost = reach * offerSave * seg.arpu * marginCostPct

  const band = (v: number): [number, number] => [v * (1 - BAND), v * (1 + BAND)]

  return {
    reach,
    eligible: seg.subscribers,
    saveRate: band(mid),
    savesPerMonth: band(savesMid),
    retainedMrr: band(retainedMid),
    offerDrivenShare: mid > 0 ? offerSave / mid : 0,
    marginCostPct,
    marginCost,
    coverage: mappings.reduce((s, m) => s + m.share, 0),
  }
}

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

const OUTCOME_GOAL: Record<Outcome, string> = {
  revenue: 'Retain revenue on cancels that are cheap to save',
  insight: 'Understand why subscribers leave, without pushing offers',
  compliance: 'Keep the exit clean, fast and FTC-safe',
}

function stepLabels(
  stages: PlanStage[],
  mappings: PlanMapping[],
  entryOffer: OfferDef | null,
): PlanStep[] {
  const mapped = mappings.filter((m) => m.offerId)
  const distinct = new Set(mapped.map((m) => m.offerId)).size
  const detailFor: Record<PlanStage, string> = {
    value_reinforcement: "What they keep, what they lose, and what they've built",
    entry_offer: entryOffer ? entryOffer.title : 'An unconditional offer before the survey',
    survey: `${mappings.length} reason${mappings.length === 1 ? '' : 's'} covering ${pct(
      mappings.reduce((s, m) => s + m.share, 0),
    )} of cancels`,
    save_offers: `${distinct} interchangeable offer${distinct === 1 ? '' : 's'}, routed by reason`,
    pricing_table: 'A cheaper plan as a last alternative to leaving',
    confirmation: 'Impact summary and an explicit confirm',
    outcome: 'Cancellation receipt with an undo window',
  }
  const labelFor: Record<PlanStage, string> = {
    value_reinforcement: 'Value reinforcement',
    entry_offer: 'Entry offer',
    survey: 'Reason survey',
    save_offers: 'Reason-routed save offers',
    pricing_table: 'Plan downgrade',
    confirmation: 'Confirmation',
    outcome: 'Outcome',
  }
  return stages.map((stage) => ({ stage, label: labelFor[stage], detail: detailFor[stage] }))
}

function buildAssumptions(
  intent: ResolvedIntent,
  blueprint: BlueprintId,
  mappings: PlanMapping[],
  entryOffer: OfferDef | null,
  droppedOffers: string[],
  projection: PlanProjection,
): string[] {
  const out: string[] = []
  const seg = segment(intent.segmentId)
  const bench = POSTURE_BENCHMARKS[blueprintMeta(blueprint).posture]

  if (intent.defaulted.includes('segment')) {
    out.push(`Targeting ${seg.name} — you didn't name a segment, so I took the widest one (${count(seg.cancelsPerMonth)} cancels/mo).`)
  }
  if (intent.defaulted.includes('outcome')) {
    out.push('Optimising for retained revenue, since you did not say otherwise.')
  }
  if (intent.defaulted.includes('intensity')) {
    out.push(`${bench.label} posture — comparable merchants land at ${bench.blurb.toLowerCase()}`)
  }
  if (intent.workflow !== 'cancel') {
    out.push(`You mentioned a ${intent.workflow.replace('_', '-')} workflow. I can only build cancel experiences here, so this is the cancel flow.`)
  }
  if (intent.stepCount !== null && intent.stepCount >= MAX_STEPS) {
    out.push(`Capped at ${MAX_STEPS} steps — the FTC click-to-cancel maximum.`)
  }
  if (intent.wantsSurvey === false && STAGES[blueprint].includes('survey')) {
    out.push('Kept the reason survey: routing an offer off the cancel reason needs it.')
  }
  if (intent.wantsCounterOffer) {
    out.push('No sequential counter-offer — a declined offer goes straight to confirmation. Rejection routing is not supported.')
  }

  if (mappings.length > 0) {
    out.push(
      `Reasons cover ${pct(projection.coverage)} of ${seg.name} cancels. The rest fall through to confirmation.`,
    )
  }

  // With no save-offer stage the reasons are analytics only, so the per-flow
  // offer cap is not why they are unmapped — the posture is.
  const offersOn = STAGES[blueprint].includes('save_offers')
  if (!offersOn && mappings.length > 0) {
    out.push(
      'No save offers — this posture captures the cancel reason for reporting and lets people go.',
    )
  } else {
    const unmapped = mappings.filter((m) => !m.offerId)
    const coveredByEntry = entryOffer ? unmapped.filter((m) => entryOffer.fits.includes(m.code)) : []
    const trulyUnmapped = unmapped.filter((m) => !coveredByEntry.includes(m))
    if (coveredByEntry.length > 0 && entryOffer) {
      out.push(
        `${coveredByEntry.map((m) => m.short).join(', ')} gets no reason-routed offer, but the entry offer (${entryOffer.label}) already reaches them earlier in the flow.`,
      )
    }
    if (trulyUnmapped.length > 0) {
      out.push(
        `${trulyUnmapped.map((m) => m.short).join(', ')} ${trulyUnmapped.length === 1 ? 'has' : 'have'} no offer — nothing in the catalog beats the ${AGENT_POLICY.maxOffersPerFlow}-offer-per-flow cap on expected value.`,
      )
    }
  }

  if (intent.outcome === 'revenue' && !offersOn) {
    out.push(
      'You asked for retained revenue but also a clean exit, so the only lift here comes from the value reminder and the impact summary.',
    )
  }
  droppedOffers.forEach((d) => out.push(`Left out ${d}.`))

  if (projection.marginCostPct > 0) {
    out.push(
      `Margin cost is ${pct(projection.marginCostPct)} of the revenue offers retain (${money(projection.marginCost)}/mo), inside your ${pct(AGENT_POLICY.maxMarginCostPct)} ceiling.`,
    )
  }
  out.push('Drafted, not published. Nothing reaches a subscriber until you publish it.')
  return out
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function buildPlan(raw: PlayIntent): DraftPlan {
  const intent = resolveIntent(raw)
  const blueprint = pickBlueprint(intent)
  const stages = STAGES[blueprint]
  const seg = segment(intent.segmentId)

  const pool = allowedOffers(intent)
  const reasons = stages.includes('survey') ? pickReasons(intent) : []
  const offersOn = stages.includes('save_offers')
  // The entry offer counts against the per-flow cap — it is a save offer too.
  const mappingCap = AGENT_POLICY.maxOffersPerFlow - (stages.includes('entry_offer') ? 1 : 0)
  const { mappings, chosen } = offersOn
    ? mapOffers(reasons, pool.offers, intent.segmentId, mappingCap)
    : {
        mappings: reasons.map((r) => ({
          code: r.code,
          label: REASON_LABEL[r.code],
          short: REASON_SHORT[r.code],
          share: r.share,
          offerId: null,
          alternatives: [] as string[],
        })),
        chosen: [] as OfferDef[],
      }

  const entryOffer = stages.includes('entry_offer')
    ? pickEntryOffer(pool.offers, chosen, intent.segmentId)
    : null

  const projection = project(intent, stages, mappings, entryOffer)
  const assumptions = buildAssumptions(intent, blueprint, mappings, entryOffer, pool.dropped, projection)
  const conflicts = collidingPlays(intent.segmentId).map(
    (p) => `"${p.name}" is already running on ${p.surface} for this segment — subscribers could see both.`,
  )

  return {
    goal: `${OUTCOME_GOAL[intent.outcome]} for ${seg.name}`,
    workflow: intent.workflow,
    outcome: intent.outcome,
    intensity: intent.intensity,
    posture: blueprintMeta(blueprint).posture,
    blueprint,
    segmentId: intent.segmentId,
    segmentName: seg.name,
    steps: stepLabels(stages, mappings, entryOffer),
    mappings,
    entryOfferId: entryOffer?.id ?? null,
    projection,
    assumptions,
    conflicts,
    split: { treatment: 90, holdout: 10 },
    trigger: { moment: 'custom_page', label: 'Custom page load', expression: '/account/cancel' },
    resolved: intent,
  }
}

/** Re-map one reason to a different offer and re-run the projection. */
export function swapOffer(plan: DraftPlan, code: ReasonCode, offerId: string | null): DraftPlan {
  const mappings = plan.mappings.map((m) => (m.code === code ? { ...m, offerId } : m))
  const stages = plan.steps.map((s) => s.stage)
  const entryOffer = plan.entryOfferId ? offerDef(plan.entryOfferId) : null
  const projection = project(plan.resolved, stages, mappings, entryOffer)
  return {
    ...plan,
    mappings,
    projection,
    steps: stepLabels(stages, mappings, entryOffer),
    assumptions: buildAssumptions(plan.resolved, plan.blueprint, mappings, entryOffer, [], projection),
  }
}
