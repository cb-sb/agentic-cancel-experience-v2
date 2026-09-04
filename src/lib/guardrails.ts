import {
  COMPONENT_CAPS,
  LA_MAX_ITEMS,
  MAX_STEPS,
  SURVEY_MAX_OPTIONS,
  SURVEY_MIN_OPTIONS,
  type ComponentKind,
  type Experience,
  type ExperienceComponent,
  type Step,
} from '../types/experience'
import { blueprintMeta } from './blueprints'
import { usedLAVariants } from './laVariants'
import { logicalStepCount } from './stepColumns'

export interface GuardrailIssue {
  level: 'error' | 'warning'
  message: string
  stepId?: string
}

/** Count how many components of a kind exist across the whole experience. */
export function countKind(experience: Experience, kind: ComponentKind): number {
  return experience.steps.reduce(
    (n, step) => n + step.components.filter((c) => c.kind === kind).length,
    0,
  )
}

function hasMediaLossAversion(step: Step): boolean {
  return step.components.some((c) => c.kind === 'loss_aversion' && !!c.media)
}

/**
 * Whether `kind` may be added to `step` given current per-step composition
 * rules from the guidelines (allowed combinations, media-standalone, etc.).
 */
export function canAddToStep(
  step: Step,
  kind: ComponentKind,
): { ok: boolean; reason?: string } {
  const kinds = step.components.map((c) => c.kind)

  // Confirmation & outcome are always standalone on their own dedicated steps.
  if (kinds.includes('confirmation') || kinds.includes('outcome') || kinds.includes('checkout')) {
    return { ok: false, reason: 'This step cannot hold other components.' }
  }
  if (kind === 'confirmation' || kind === 'outcome' || kind === 'checkout') {
    return { ok: false, reason: 'This component lives on its own dedicated step.' }
  }

  // A media loss-aversion card may only be paired with another loss-aversion
  // card (e.g. Messaging-with-media beside a benefits card) — never with a
  // survey, offer, or pricing table.
  if (hasMediaLossAversion(step) && kind !== 'loss_aversion') {
    return { ok: false, reason: 'A loss-aversion card with media can only sit beside another loss-aversion card.' }
  }

  // Pricing table cannot be combined with an offer, and vice-versa.
  if (kind === 'pricing_table' && kinds.includes('offer')) {
    return { ok: false, reason: 'Pricing table and Offer cannot share a step.' }
  }
  if (kind === 'offer' && kinds.includes('pricing_table')) {
    return { ok: false, reason: 'Offer and Pricing table cannot share a step.' }
  }

  // Survey can only be combined with a loss-aversion card.
  if (kind === 'survey' && kinds.some((k) => k !== 'loss_aversion')) {
    return { ok: false, reason: 'Survey can only be paired with a loss-aversion card.' }
  }
  if (kinds.includes('survey') && kind !== 'loss_aversion') {
    return { ok: false, reason: 'A survey step only accepts an extra loss-aversion card.' }
  }

  // Per-step count sanity: at most 2 components on a step.
  if (step.components.length >= 2) {
    return { ok: false, reason: 'A step supports at most two complementary components.' }
  }

  return { ok: true }
}

/** Whether the experience-wide cap for a kind still has room. */
export function hasCapRoom(experience: Experience, kind: ComponentKind): boolean {
  const cap = (COMPONENT_CAPS as Record<string, number>)[kind]
  if (cap === undefined) return true
  return countKind(experience, kind) < cap
}

function stageIndex(experience: Experience, predicate: (s: Step) => boolean): number {
  return experience.steps.findIndex(predicate)
}

/** Full compliance + guardrail sweep used by the composer status panel. */
export function validateExperience(experience: Experience): GuardrailIssue[] {
  const issues: GuardrailIssue[] = []
  const { steps } = experience

  // The FTC cap counts pre-cancellation steps the subscriber actually clicks
  // through; interchangeable save offers collapse into one logical step (only
  // one is ever shown), and the terminal outcome screen is not counted.
  const flowStepCount = logicalStepCount(steps.filter((s) => s.stage !== 'outcome'))
  if (flowStepCount > MAX_STEPS) {
    issues.push({
      level: 'error',
      message: `Flow exceeds the ${MAX_STEPS}-step FTC maximum (currently ${flowStepCount}).`,
    })
  }

  // Caps.
  ;(['loss_aversion', 'offer', 'survey'] as const).forEach((kind) => {
    const count = countKind(experience, kind)
    const cap = COMPONENT_CAPS[kind]
    if (count > cap) {
      issues.push({
        level: 'error',
        message: `Too many ${labelFor(kind)} components (${count}/${cap} allowed).`,
      })
    }
  })

  // Confirmation stage mandatory, followed by its outcome step as the finale.
  const confirmationIdx = stageIndex(experience, (s) =>
    s.components.some((c) => c.kind === 'confirmation'),
  )
  // The flow ends in outcomes — plural, since a saved subscriber and a
  // cancelled one do not end up on the same screen. They are alternatives at
  // the same moment, so they occupy the trailing block of steps together.
  const outcomeIdxs = steps
    .map((s, i) => (s.components.some((c) => c.kind === 'outcome') ? i : -1))
    .filter((i) => i !== -1)
  const firstOutcome = outcomeIdxs[0] ?? -1
  if (confirmationIdx === -1) {
    issues.push({
      level: 'error',
      message: 'Every experience must end with an impact + confirmation step.',
    })
  }
  if (firstOutcome === -1) {
    issues.push({
      level: 'error',
      message: 'Every experience must end with an outcome step.',
    })
  } else if (outcomeIdxs[outcomeIdxs.length - 1] !== steps.length - 1) {
    issues.push({
      level: 'error',
      message: 'The outcome steps must be the final steps.',
    })
  }
  if (confirmationIdx !== -1 && firstOutcome !== -1 && firstOutcome !== confirmationIdx + 1) {
    issues.push({
      level: 'error',
      message: 'The outcome steps must come directly after confirmation.',
    })
  }

  // Reason-linked offers must follow the survey step.
  const surveyIdx = stageIndex(experience, (s) => s.components.some((c) => c.kind === 'survey'))
  steps.forEach((step, idx) => {
    const hasReasonLinkedOffer = step.components.some(
      (c) => c.kind === 'offer' && c.reasonLinked,
    )
    if (hasReasonLinkedOffer && (surveyIdx === -1 || idx <= surveyIdx)) {
      issues.push({
        level: 'error',
        message: 'A reason-linked offer must appear on a step after the survey.',
        stepId: step.id,
      })
    }
  })

  // Survey option count + "Other" placement.
  steps.forEach((step) => {
    step.components.forEach((c) => {
      if (c.kind !== 'survey' || c.presentation === 'free_text') return
      if (c.options.length < SURVEY_MIN_OPTIONS || c.options.length > SURVEY_MAX_OPTIONS) {
        issues.push({
          level: 'error',
          message: `Survey needs ${SURVEY_MIN_OPTIONS}-${SURVEY_MAX_OPTIONS} options (has ${c.options.length}).`,
          stepId: step.id,
        })
      }
      const otherIdx = c.options.findIndex((o) => o.isOther)
      if (c.randomize && otherIdx !== -1 && otherIdx !== c.options.length - 1) {
        issues.push({
          level: 'warning',
          message: '"Other" should be the last option when randomizing.',
          stepId: step.id,
        })
      }
      const followUpCount = c.options.filter((o) => o.followUp?.enabled).length
      if (followUpCount > 2) {
        issues.push({
          level: 'warning',
          message: 'Follow-up free text is enabled on more than 2 reasons.',
          stepId: step.id,
        })
      }
    })
  })

  // Loss-aversion feature-list item cap + media-standalone rule.
  steps.forEach((step) => {
    if (hasMediaLossAversion(step) && step.components.some((c) => c.kind !== 'loss_aversion')) {
      issues.push({
        level: 'error',
        message: 'A loss-aversion card with media can only sit beside another loss-aversion card.',
        stepId: step.id,
      })
    }
    // Two loss-aversion cards on a step must be different variants.
    const laCards = step.components.filter((c) => c.kind === 'loss_aversion')
    if (laCards.length > 1 && usedLAVariants(laCards).size < laCards.length) {
      issues.push({
        level: 'error',
        message: 'A step cannot repeat the same loss-aversion variant.',
        stepId: step.id,
      })
    }
    step.components.forEach((c) => {
      if (c.kind !== 'loss_aversion' || c.cardType !== 'feature_list') return
      if ((c.keepItems?.length ?? 0) > LA_MAX_ITEMS || (c.loseItems?.length ?? 0) > LA_MAX_ITEMS) {
        issues.push({
          level: 'error',
          message: `A feature list allows at most ${LA_MAX_ITEMS} items.`,
          stepId: step.id,
        })
      }
    })
  })

  // 30-day undo is mandatory on Balanced & Save Aggressive blueprints.
  if (blueprintMeta(experience.blueprint).posture !== 'clean_exit') {
    // The undo belongs on the cancelled terminal; the saved one has nothing to
    // undo, so its variant is not what this rule is about.
    const oc = steps
      .flatMap((s) => s.components)
      .find((c) => c.kind === 'outcome' && c.forResult === 'cancelled')
    if (oc?.kind === 'outcome' && oc.variant !== 'reactivation') {
      issues.push({
        level: 'warning',
        message: 'A reactivation (one-click undo) outcome is recommended on Balanced & Save Aggressive blueprints.',
      })
    }
  }

  return issues
}

export function labelFor(kind: ComponentKind): string {
  switch (kind) {
    case 'loss_aversion':
      return 'Loss aversion'
    case 'survey':
      return 'Survey'
    case 'offer':
      return 'Offer'
    case 'pricing_table':
      return 'Pricing table'
    case 'checkout':
      return 'Checkout'
    case 'confirmation':
      return 'Confirmation'
    case 'outcome':
      return 'Outcome'
  }
}

export function componentTitle(component: ExperienceComponent): string {
  switch (component.kind) {
    case 'loss_aversion':
      return `Loss aversion · ${component.cardType.replace('_', ' ')}`
    case 'survey':
      return `Survey · ${component.presentation.replace('_', ' ')}`
    case 'offer':
      return `Offer · ${component.category.replace('_', ' ')}`
    case 'pricing_table':
      return 'Pricing table'
    case 'checkout':
      return 'Checkout'
    case 'confirmation':
      return 'Confirmation'
    case 'outcome':
      return `Outcome · ${component.variant}`
  }
}
