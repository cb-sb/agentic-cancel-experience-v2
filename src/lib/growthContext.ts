/**
 * Mock growth-data layer for the conversational setup agent.
 *
 * The real product reads this from the merchant's account: subscriber counts and
 * ARPU per segment, the cancel-reason mix, historical offer acceptance, and the
 * plays already running. In the prototype there is no server, so everything the
 * agent needs to make a *data-backed* recommendation lives here.
 *
 * Numbers are internally consistent — the per-tier cancel counts sum to the
 * base total, and every reason mix sums to 1 — so projections in the plan card
 * add up under scrutiny.
 */

import type { AudienceCondition, MatchJoin } from '../types/orchestration'
import { AUDIENCE_LIBRARY, conditionExpression } from '../types/orchestration'
import type { OfferCategory, ReasonCode } from '../types/experience'
import { REASON_CODES } from '../types/experience'

export type ChurnRisk = 'low' | 'medium' | 'high'
export type Posture = 'clean_exit' | 'balanced' | 'save_aggressive'

// ---------------------------------------------------------------------------
// Reason labels
// ---------------------------------------------------------------------------

/** Subscriber-facing wording per reason code (used when composing surveys). */
export const REASON_LABEL: Record<ReasonCode, string> = {
  price: "It's too expensive",
  not_using: "I'm not using it enough to justify the cost",
  taking_break: 'I just need a break for a while',
  missing_features: 'Missing features or integrations',
  switching_competitor: 'Switching to a competitor',
  technical_issues: 'Bugs or reliability problems',
  too_complex: 'Too complicated or hard to use',
  other: 'Something else',
}

/** Short label for dense UI (plan card mapping rows, chips). */
export const REASON_SHORT: Record<ReasonCode, string> = {
  price: 'Too expensive',
  not_using: 'Not using it',
  taking_break: 'Need a break',
  missing_features: 'Missing features',
  switching_competitor: 'Switching away',
  technical_issues: 'Technical issues',
  too_complex: 'Too complex',
  other: 'Other',
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export interface Segment {
  id: string
  name: string
  /** Library audience this maps onto, when one exists. */
  savedAudienceId: string | null
  /** True → every subscriber is eligible (no rules). */
  targetAll?: boolean
  /** Rules used when there is no library entry to point at. */
  conditions?: AudienceCondition[]
  match?: MatchJoin
  subscribers: number
  cancelsPerMonth: number
  /** Monthly recurring revenue per subscriber, in dollars. */
  arpu: number
  churnRisk: ChurnRisk
  /** Which reason mix applies (defaults to the segment's own id, then `base`). */
  reasonMixKey?: string
  /** Offered as a chip when the agent asks "who is this for?". */
  featured?: boolean
  /** Words in a typed prompt that identify this segment. */
  keywords: RegExp
}

/** Build the plan-tier segments' rules from the Plan property. */
function planRule(id: string, value: string): AudienceCondition[] {
  return [{ id: `${id}-1`, property: 'Plan', operator: 'is', value }]
}

/**
 * The four plan tiers are the merchant's own cut of the base; the five
 * library-backed entries mirror `AUDIENCE_LIBRARY` so a prompt naming a saved
 * audience resolves to real numbers too.
 */
export const SEGMENTS: Segment[] = [
  {
    id: 'all',
    name: 'All cancelling subscribers',
    savedAudienceId: null,
    targetAll: true,
    subscribers: 13180,
    cancelsPerMonth: 412,
    arpu: 116,
    churnRisk: 'medium',
    reasonMixKey: 'base',
    featured: true,
    keywords: /\ball (?:cancelling |canceling )?(?:subscribers|customers|users)\b|\beveryone\b|\bwhole base\b|\bentire base\b/i,
  },
  {
    id: 'smb_starter',
    name: 'SMB Starter',
    savedAudienceId: null,
    conditions: planRule('smb', 'Starter'),
    match: 'AND',
    subscribers: 7240,
    cancelsPerMonth: 245,
    arpu: 29,
    churnRisk: 'high',
    featured: true,
    keywords: /\b(?:smb|small business)\b|\bstarter\b/i,
  },
  {
    id: 'growth_active',
    name: 'Growth — Active (30d)',
    savedAudienceId: null,
    conditions: [
      { id: 'ga-1', property: 'Plan', operator: 'is', value: 'Growth' },
      { id: 'ga-2', property: 'Days since signup', operator: 'gt', value: '30' },
    ],
    match: 'AND',
    subscribers: 3140,
    cancelsPerMonth: 92,
    arpu: 99,
    churnRisk: 'medium',
    featured: true,
    keywords: /\bgrowth\b/i,
  },
  {
    id: 'growth_low',
    name: 'Growth — Low engagement',
    savedAudienceId: null,
    conditions: planRule('gl', 'Growth'),
    match: 'AND',
    subscribers: 1180,
    cancelsPerMonth: 38,
    arpu: 99,
    churnRisk: 'high',
    featured: true,
    keywords: /\blow engagement\b|\bdormant\b|\bidle\b|\binactive\b/i,
  },
  {
    id: 'pro_enterprise',
    name: 'Pro & Enterprise',
    savedAudienceId: null,
    conditions: planRule('pe', 'Pro'),
    match: 'AND',
    subscribers: 1620,
    cancelsPerMonth: 37,
    arpu: 547,
    churnRisk: 'low',
    featured: true,
    keywords: /\b(?:pro|enterprise)\b/i,
  },
  {
    id: 'all_paying',
    name: 'Paying subscribers',
    savedAudienceId: 'all_paying',
    subscribers: 13180,
    cancelsPerMonth: 412,
    arpu: 116,
    churnRisk: 'medium',
    reasonMixKey: 'base',
    keywords: /\bpaying\b/i,
  },
  {
    id: 'high_value',
    name: 'High-value subscribers',
    savedAudienceId: 'high_value',
    subscribers: 1620,
    cancelsPerMonth: 37,
    arpu: 547,
    churnRisk: 'low',
    reasonMixKey: 'pro_enterprise',
    keywords: /\bhigh[- ]value\b|\bwhales?\b|\btop accounts?\b/i,
  },
  {
    id: 'high_risk',
    name: 'High risk customers',
    savedAudienceId: 'high_risk',
    subscribers: 480,
    cancelsPerMonth: 38,
    arpu: 41,
    churnRisk: 'high',
    reasonMixKey: 'growth_low',
    keywords: /\bhigh[- ]risk\b|\bat[- ]risk\b/i,
  },
  {
    id: 'annual',
    name: 'Annual customers',
    savedAudienceId: 'annual',
    subscribers: 2050,
    cancelsPerMonth: 24,
    arpu: 142,
    churnRisk: 'low',
    reasonMixKey: 'base',
    keywords: /\bannual\b|\byearly\b/i,
  },
  {
    id: 'in_trial',
    name: 'In-trial (active)',
    savedAudienceId: 'in_trial',
    subscribers: 890,
    cancelsPerMonth: 61,
    arpu: 0,
    churnRisk: 'high',
    reasonMixKey: 'in_trial',
    keywords: /\btrial\b/i,
  },
]

const SEGMENT_BY_ID = new Map(SEGMENTS.map((s) => [s.id, s]))

export const DEFAULT_SEGMENT_ID = 'all'

export function segment(id: string): Segment {
  return SEGMENT_BY_ID.get(id) ?? SEGMENT_BY_ID.get(DEFAULT_SEGMENT_ID)!
}

export function featuredSegments(): Segment[] {
  return SEGMENTS.filter((s) => s.featured)
}

/**
 * Audience fields for a segment, shaped for the `audience` apply-op. Library
 * segments carry their saved id so the drawer shows the saved audience; the
 * plan tiers carry inline rules.
 */
export function audienceFieldsFor(s: Segment): {
  name: string
  ruleType: 'TARGETING' | 'ALL_AUDIENCE'
  targetAll: boolean
  savedAudienceId: string | null
  match: MatchJoin
  conditions: AudienceCondition[]
  expression: string
} {
  if (s.targetAll) {
    return {
      name: s.name,
      ruleType: 'ALL_AUDIENCE',
      targetAll: true,
      savedAudienceId: null,
      match: 'AND',
      conditions: [],
      expression: 'Everyone who reaches the cancel button',
    }
  }
  const lib = s.savedAudienceId ? AUDIENCE_LIBRARY.find((a) => a.id === s.savedAudienceId) : null
  const conditions = lib?.conditions ?? s.conditions ?? []
  const match = lib?.match ?? s.match ?? 'AND'
  return {
    name: s.name,
    ruleType: 'TARGETING',
    targetAll: false,
    savedAudienceId: s.savedAudienceId ?? null,
    match,
    conditions,
    expression: conditionExpression(conditions, match),
  }
}

// ---------------------------------------------------------------------------
// Reason mix
// ---------------------------------------------------------------------------

export type ReasonMix = Record<ReasonCode, number>

function mix(m: Partial<ReasonMix>): ReasonMix {
  return REASON_CODES.reduce((acc, code) => {
    acc[code] = m[code] ?? 0
    return acc
  }, {} as ReasonMix)
}

/** Reason distribution per segment (shares of that segment's cancels). */
export const REASON_MIX: Record<string, ReasonMix> = {
  base: mix({
    price: 0.28,
    not_using: 0.2,
    taking_break: 0.12,
    switching_competitor: 0.14,
    missing_features: 0.12,
    too_complex: 0.06,
    technical_issues: 0.03,
    other: 0.05,
  }),
  smb_starter: mix({
    price: 0.38,
    not_using: 0.22,
    taking_break: 0.14,
    switching_competitor: 0.1,
    missing_features: 0.08,
    too_complex: 0.03,
    technical_issues: 0.01,
    other: 0.04,
  }),
  growth_active: mix({
    not_using: 0.3,
    switching_competitor: 0.24,
    missing_features: 0.15,
    price: 0.12,
    taking_break: 0.09,
    too_complex: 0.05,
    technical_issues: 0.02,
    other: 0.03,
  }),
  growth_low: mix({
    not_using: 0.42,
    taking_break: 0.16,
    price: 0.14,
    missing_features: 0.1,
    switching_competitor: 0.08,
    too_complex: 0.05,
    technical_issues: 0.02,
    other: 0.03,
  }),
  pro_enterprise: mix({
    missing_features: 0.26,
    switching_competitor: 0.22,
    price: 0.16,
    not_using: 0.14,
    too_complex: 0.09,
    technical_issues: 0.06,
    taking_break: 0.04,
    other: 0.03,
  }),
  in_trial: mix({
    not_using: 0.34,
    too_complex: 0.22,
    missing_features: 0.16,
    price: 0.12,
    switching_competitor: 0.08,
    technical_issues: 0.04,
    taking_break: 0.02,
    other: 0.02,
  }),
}

export function reasonMixFor(segmentId: string): ReasonMix {
  const s = segment(segmentId)
  return REASON_MIX[s.reasonMixKey ?? s.id] ?? REASON_MIX.base
}

/** Reason codes for a segment, highest share first, `other` always excluded. */
export function rankedReasons(segmentId: string): { code: ReasonCode; share: number }[] {
  const m = reasonMixFor(segmentId)
  return REASON_CODES.filter((c) => c !== 'other' && m[c] > 0)
    .map((code) => ({ code, share: m[code] }))
    .sort((a, b) => b.share - a.share)
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export interface BillingEntity {
  couponId?: string
  planId?: string
  addonId?: string
}

export interface OfferDef {
  id: string
  /** Catalog name, as the merchant would recognise it. */
  label: string
  category: OfferCategory
  eyebrow: string
  title: string
  description: string
  primaryCta: string
  /** Share of the retained MRR given up when this offer is accepted. */
  marginCostPct: number
  /** Historical acceptance by segment id; `default` covers unlisted segments. */
  acceptance: Record<string, number> & { default: number }
  /** Resolved catalog binding. Absent for offers that need no catalog entity. */
  billingEntity?: BillingEntity
  /** Reason codes this offer credibly answers. */
  fits: ReasonCode[]
}

/** Categories whose fulfilment needs a resolved catalog id (guardrail §9). */
const NEEDS_CATALOG_ID: OfferCategory[] = ['discount', 'plan_change', 'addon']

export const OFFER_LIBRARY: OfferDef[] = [
  {
    id: 'discount_50_3mo',
    label: '50% off for 3 months',
    category: 'discount',
    eyebrow: 'EXCLUSIVE DISCOUNT',
    title: '50% off for the next 3 months',
    description:
      'Same plan, half the price for your next three billing cycles. It simply resumes at your normal rate after.',
    primaryCta: 'Claim 50% discount',
    marginCostPct: 0.17,
    acceptance: { smb_starter: 0.34, growth_active: 0.27, growth_low: 0.22, pro_enterprise: 0.19, default: 0.26 },
    billingEntity: { couponId: 'HALFOFF3' },
    fits: ['price', 'not_using'],
  },
  {
    id: 'annual_discount_25',
    label: 'Annual discount 25%',
    category: 'discount',
    eyebrow: 'SWITCH AND SAVE',
    title: '25% off when you switch to annual',
    description:
      'Move to a yearly plan and keep everything you have for a quarter less. Cancel anytime before renewal.',
    primaryCta: 'Switch and save 25%',
    marginCostPct: 0.25,
    acceptance: { smb_starter: 0.3, growth_active: 0.24, growth_low: 0.2, pro_enterprise: 0.18, in_trial: 0.16, default: 0.24 },
    billingEntity: { couponId: 'ANNUAL25' },
    fits: ['price', 'switching_competitor'],
  },
  {
    id: 'discount_10_1mo',
    label: '10% off (1 month)',
    category: 'discount',
    eyebrow: 'A SMALL THANK YOU',
    title: '10% off your next month',
    description: 'A modest discount on your next invoice — no change to your plan or features.',
    primaryCta: 'Apply 10% off',
    marginCostPct: 0.1,
    acceptance: { default: 0.12 },
    billingEntity: { couponId: 'SAVE10' },
    fits: ['price'],
  },
  {
    id: 'pause_3mo',
    label: 'Pause 3 months',
    category: 'pause',
    eyebrow: 'TAKE A BREAK',
    title: 'Pause for up to 3 months instead',
    description:
      'Freeze your plan and stop billing. Come back whenever you like — your data and settings stay exactly as you left them.',
    primaryCta: 'Pause my subscription',
    marginCostPct: 0.08,
    acceptance: { smb_starter: 0.22, growth_active: 0.2, growth_low: 0.26, pro_enterprise: 0.15, default: 0.21 },
    fits: ['taking_break', 'not_using'],
  },
  {
    id: 'skip_next',
    label: 'Skip next payment',
    category: 'skip',
    eyebrow: 'SKIP A CYCLE',
    title: 'Skip your next payment',
    description: 'Take this billing cycle off. We pick things back up automatically next month.',
    marginCostPct: 0.09,
    primaryCta: 'Skip next payment',
    acceptance: { default: 0.16 },
    fits: ['taking_break', 'price'],
  },
  {
    id: 'three_months_free',
    label: '3 months free',
    category: 'extension',
    eyebrow: 'ON THE HOUSE',
    title: 'Three months on us',
    description: 'Stay on your current plan free for three months while you decide. No strings attached.',
    primaryCta: 'Claim 3 free months',
    marginCostPct: 0.25,
    acceptance: { growth_active: 0.3, smb_starter: 0.26, pro_enterprise: 0.21, default: 0.25 },
    fits: ['switching_competitor', 'price'],
  },
  {
    id: 'roadmap_extension',
    label: 'Free month while the feature ships',
    category: 'extension',
    eyebrow: 'ALMOST THERE',
    title: "A free month while we ship what you're missing",
    description:
      "The integration you need is close. Stay on us for a month and we'll tell you the moment it lands.",
    primaryCta: 'Give it another month',
    marginCostPct: 0.08,
    acceptance: { pro_enterprise: 0.16, default: 0.13 },
    fits: ['missing_features'],
  },
  {
    id: 'downgrade_starter',
    label: 'Downgrade to Starter',
    category: 'plan_change',
    eyebrow: 'A LIGHTER PLAN',
    title: 'Switch to Starter — $12/mo',
    description:
      'Keep the essentials at a fraction of the price. Stop paying for the features you are not using.',
    primaryCta: 'Move to Starter',
    marginCostPct: 0.71,
    acceptance: { growth_active: 0.18, growth_low: 0.21, pro_enterprise: 0.14, smb_starter: 0.09, default: 0.16 },
    billingEntity: { planId: 'plan_starter' },
    fits: ['price', 'not_using', 'too_complex'],
  },
  {
    id: 'onboarding_addon',
    label: 'Free onboarding + priority support',
    category: 'addon',
    eyebrow: 'ON THE HOUSE',
    title: 'Free onboarding and priority support',
    description:
      'A specialist will set the tricky parts up with you, and your tickets jump the queue for three months.',
    primaryCta: 'Add it free',
    marginCostPct: 0.06,
    acceptance: { pro_enterprise: 0.14, in_trial: 0.18, default: 0.11 },
    billingEntity: { addonId: 'addon_onboarding' },
    fits: ['too_complex', 'missing_features', 'technical_issues'],
  },
]

const OFFER_BY_ID = new Map(OFFER_LIBRARY.map((o) => [o.id, o]))

export function offerDef(id: string): OfferDef | null {
  return OFFER_BY_ID.get(id) ?? null
}

export function acceptanceFor(offer: OfferDef, segmentId: string): number {
  return offer.acceptance[segmentId] ?? offer.acceptance.default
}

/** Guardrail §9 — an offer may only ship when its catalog binding resolves. */
export function catalogBound(offer: OfferDef): boolean {
  if (!NEEDS_CATALOG_ID.includes(offer.category)) return true
  const e = offer.billingEntity
  if (!e) return false
  return Boolean(e.couponId || e.planId || e.addonId)
}

/** Offers that credibly answer a reason, richest fit first. */
export function offersForReason(code: ReasonCode): OfferDef[] {
  return OFFER_LIBRARY.filter((o) => o.fits.includes(code))
}

// ---------------------------------------------------------------------------
// Benchmarks and policy
// ---------------------------------------------------------------------------

export interface PostureBenchmark {
  posture: Posture
  label: string
  /** Save-rate band observed across comparable merchants. */
  save: [number, number]
  /** Margin given up as a share of saved revenue. */
  cost: [number, number]
  blurb: string
}

export const POSTURE_BENCHMARKS: Record<Posture, PostureBenchmark> = {
  clean_exit: {
    posture: 'clean_exit',
    label: 'Respect the exit',
    save: [0.1, 0.14],
    cost: [0.05, 0.09],
    blurb: 'Lowest friction. Learn why, then let people go.',
  },
  balanced: {
    posture: 'balanced',
    label: 'Balanced',
    save: [0.18, 0.22],
    cost: [0.13, 0.17],
    blurb: 'One targeted save per reason. The most common choice.',
  },
  save_aggressive: {
    posture: 'save_aggressive',
    label: 'Maximise saves',
    save: [0.26, 0.3],
    cost: [0.2, 0.24],
    blurb: 'Entry offer plus reason-routed saves. Costs the most margin.',
  },
}

/** Account-level guardrails the agent must respect (§5.2). */
export const AGENT_POLICY = {
  allowedCategories: ['discount', 'pause', 'plan_change', 'extension', 'skip', 'addon'] as OfferCategory[],
  /** Distinct save offers the agent may put in one flow. */
  maxOffersPerFlow: 3,
  /** Ceiling on blended margin cost as a share of retained revenue. */
  maxMarginCostPct: 0.35,
  /** FTC six-step cap. */
  maxSteps: 6,
  /** A visible cancel affordance is mandatory on every step. */
  requireCancelAffordance: true,
}

// ---------------------------------------------------------------------------
// Active plays (collision detection)
// ---------------------------------------------------------------------------

export interface ActivePlay {
  id: string
  name: string
  /** Segment this play already targets. */
  segmentId: string
  surface: string
}

export const ACTIVE_PLAYS: ActivePlay[] = [
  { id: 'play_winback', name: 'Winback — lapsed Starter', segmentId: 'smb_starter', surface: 'Cancel page' },
  { id: 'play_dunning', name: 'Dunning recovery', segmentId: 'all_paying', surface: 'Email + in-app' },
]

/** Live plays already targeting this segment (or the whole base). */
export function collidingPlays(segmentId: string): ActivePlay[] {
  return ACTIVE_PLAYS.filter((p) => p.segmentId === segmentId || p.segmentId === 'all_paying')
}
