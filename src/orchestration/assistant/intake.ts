/**
 * Deterministic intake — turns a typed prompt into a partial `PlayIntent`.
 *
 * There is no model call here. Everything is keyword matching against the
 * vocabulary the product already owns (`SEGMENTS`, `OFFER_LIBRARY`,
 * `REASON_CODES`), which keeps the prototype reproducible and makes this the
 * single seam a real NLU call would slot into later.
 *
 * Offers are matched first and their text removed before segments are matched,
 * so "annual discount" reads as an offer rather than the Annual segment.
 */

import type { ReasonCode } from '../../types/experience'
import { OFFER_LIBRARY, SEGMENTS, offerDef } from '../../lib/growthContext'
import { emptyIntent, type Intensity, type Outcome, type PlayIntent, type Workflow } from './intent'

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Checked most-specific-first: an at-risk prompt usually says "cancel" too. */
const WORKFLOW_PATTERNS: [Workflow, RegExp][] = [
  ['dunning', /\bdunning\b|failed payment|payment fail|involuntary|card declin|recover(?:ing)? payment/i],
  ['upsell', /\bupsell\b|\bupgrade\b|expansion revenue|cross[- ]sell/i],
  ['at_risk', /at[- ]risk|health score|early warning|before they cancel|proactive(?:ly)? reach/i],
  ['cancel', /\bcancel(?:lation|ling|ing)?\b|churn deflect|save flow|deflection flow|offboard|retention flow/i],
]

const OUTCOME_PATTERNS: [Outcome, RegExp][] = [
  ['compliance', /complian|\bftc\b|click[- ]to[- ]cancel|\blegal\b|regulat|respect the exit|easy to cancel/i],
  ['insight', /\bwhy\b|reason code|\binsight|\bfeedback\b|learn (?:why|from)|understand (?:why|churn)|voice of (?:the )?customer/i],
  ['revenue', /\brevenue\b|save rate|\bsaves?\b|\bretain\b|retention|\bmrr\b|\bdeflect|reduce cancellation|reduce churn|win ?back/i],
]

const INTENSITY_PATTERNS: [Intensity, RegExp][] = [
  ['save_aggressive', /aggressive|push(?:es|ing)? hard|hard on saves|maximi[sz]e save|max save|every save|as many save/i],
  [
    'clean_exit',
    /clean exit|exit clean|no offers?\b|don'?t push|light touch|low friction|frictionless|minimal|respect the exit/i,
  ],
  ['balanced', /\bbalanced\b|revenue[- ]aware|cost[- ]aware|\bfair\b|moderate|sensible/i],
]

const REASON_PATTERNS: [ReasonCode, RegExp][] = [
  ['price', /too expensive|\bprice\b|pricing|cost too much|\bbudget\b|cheaper/i],
  ['not_using', /not using|low usage|don'?t use|barely use|underus|unused/i],
  ['taking_break', /need(?:s|ing)? a break|take a break|time off|seasonal|come back later/i],
  ['missing_features', /missing feature|feature gap|missing integration|lacks? (?:a )?feature/i],
  ['switching_competitor', /competitor|switching (?:to|away)|moving to another/i],
  ['technical_issues', /\bbugs?\b|outage|reliab|broken|too many errors/i],
  ['too_complex', /too complex|complicated|hard to use|confusing|learning curve/i],
]

/** Offer catalog keywords, keyed by `OFFER_LIBRARY` id. */
const OFFER_PATTERNS: [string, RegExp][] = [
  ['discount_50_3mo', /50% off|half off|half price|50 percent/i],
  ['annual_discount_25', /annual discount|25% off|switch(?:ing)? to annual|annual plan discount/i],
  ['discount_10_1mo', /10% off|10 percent off|small discount/i],
  ['pause_3mo', /\bpause\b|freeze (?:my |the )?(?:plan|subscription)/i],
  ['skip_next', /skip (?:a |the |their |next )?(?:payment|cycle|month|invoice|billing)/i],
  ['three_months_free', /(?:3|three) months? free|free months?|months? on us/i],
  ['roadmap_extension', /roadmap|while we ship|feature ships/i],
  ['downgrade_starter', /downgrade|lighter plan|cheaper plan|smaller plan|plan change/i],
  ['onboarding_addon', /onboarding|priority support|white[- ]glove|hands[- ]on setup/i],
]

/**
 * Segment match order — most specific first, so "Growth low engagement" does
 * not get claimed by the plain Growth tier.
 */
const SEGMENT_PRIORITY = [
  'growth_low',
  'high_risk',
  'high_value',
  'in_trial',
  'annual',
  'pro_enterprise',
  'smb_starter',
  'growth_active',
  'all_paying',
  'all',
]

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
}

const STEP_COUNT_RE = new RegExp(
  `\\b(\\d{1,2}|${Object.keys(NUMBER_WORDS).join('|')})\\b[\\s-]*steps?\\b`,
  'i',
)

const SURVEY_YES = /\bsurvey\b|ask (?:them )?why|reason (?:question|survey)|collect reasons/i
const SURVEY_NO = /no survey|without a survey|skip the survey|don'?t ask why/i
const COUNTER_OFFER = /counter[- ]?offer|second offer|follow[- ]up offer|if they (?:decline|reject|say no)|escalat(?:e|ing) the offer/i

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function firstMatch<T>(text: string, patterns: [T, RegExp][]): T | null {
  for (const [value, re] of patterns) if (re.test(text)) return value
  return null
}

function parseStepCount(text: string): number | null {
  const m = STEP_COUNT_RE.exec(text)
  if (!m) return null
  const token = m[1].toLowerCase()
  const n = NUMBER_WORDS[token] ?? Number(token)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseOffers(text: string): { ids: string[]; residue: string } {
  const ids: string[] = []
  let residue = text
  for (const [id, re] of OFFER_PATTERNS) {
    if (!offerDef(id) || !re.test(residue)) continue
    ids.push(id)
    residue = residue.replace(new RegExp(re.source, 'gi'), ' ')
  }
  // Also honour an offer named by its exact catalog label.
  for (const offer of OFFER_LIBRARY) {
    if (ids.includes(offer.id)) continue
    if (residue.toLowerCase().includes(offer.label.toLowerCase())) ids.push(offer.id)
  }
  return { ids, residue }
}

function parseSegment(text: string): string | null {
  for (const id of SEGMENT_PRIORITY) {
    const s = SEGMENTS.find((x) => x.id === id)
    if (s && s.keywords.test(text)) return s.id
  }
  return null
}

function parseReasons(text: string): ReasonCode[] {
  return REASON_PATTERNS.filter(([, re]) => re.test(text)).map(([code]) => code)
}

function parseSurvey(text: string): boolean | null {
  if (SURVEY_NO.test(text)) return false
  if (SURVEY_YES.test(text)) return true
  return null
}

/** Extract everything the prompt states outright. Silent on anything else. */
export function parseIntake(text: string): PlayIntent {
  const prompt = text.trim()
  const intent = emptyIntent(prompt)
  if (!prompt) return intent

  const { ids, residue } = parseOffers(prompt)

  intent.offerIds = ids
  intent.workflow = firstMatch(prompt, WORKFLOW_PATTERNS)
  intent.outcome = firstMatch(prompt, OUTCOME_PATTERNS)
  intent.intensity = firstMatch(prompt, INTENSITY_PATTERNS)
  intent.segmentId = parseSegment(residue)
  intent.stepCount = parseStepCount(prompt)
  intent.reasonCodes = parseReasons(prompt)
  intent.wantsSurvey = parseSurvey(prompt)
  intent.wantsCounterOffer = COUNTER_OFFER.test(prompt)

  // A named offer set is itself an intensity signal.
  if (intent.intensity === null && intent.offerIds.length >= 3) intent.intensity = 'save_aggressive'

  return intent
}

/** Layer a follow-up prompt over an intent without losing what was answered. */
export function mergeIntake(base: PlayIntent, text: string): PlayIntent {
  const patch = parseIntake(text)
  // Re-stating the posture supersedes an earlier step count — otherwise a stale
  // "six steps" would silently outrank a fresh "keep the exit clean".
  const respecified = patch.intensity !== null && patch.stepCount === null
  return {
    ...base,
    prompt: base.prompt ? `${base.prompt}\n${patch.prompt}` : patch.prompt,
    workflow: patch.workflow ?? base.workflow,
    outcome: patch.outcome ?? base.outcome,
    segmentId: patch.segmentId ?? base.segmentId,
    intensity: patch.intensity ?? base.intensity,
    stepCount: respecified ? null : patch.stepCount ?? base.stepCount,
    offerIds: patch.offerIds.length ? patch.offerIds : base.offerIds,
    reasonCodes: patch.reasonCodes.length ? patch.reasonCodes : base.reasonCodes,
    wantsSurvey: patch.wantsSurvey ?? base.wantsSurvey,
    wantsCounterOffer: patch.wantsCounterOffer || base.wantsCounterOffer,
  }
}

/** Domain words that make a vague sentence still a play brief ("help with churn"). */
const DOMAIN_MENTION = /\bchurn\b|\bcancel|subscriber|retention|\bsave\b|\bplay\b|\bflow\b|\boffer\b/i

/** True when the prompt says enough to be worth treating as a play brief. */
export function looksLikeBrief(intent: PlayIntent): boolean {
  return (
    intent.workflow !== null ||
    intent.outcome !== null ||
    intent.segmentId !== null ||
    intent.stepCount !== null ||
    intent.offerIds.length > 0 ||
    DOMAIN_MENTION.test(intent.prompt)
  )
}
