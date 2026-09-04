import { offerVariantLabel } from '../../../lib/offerVariants'
import type { ExperienceComponent, Step, SurveyComponent } from '../../../types/experience'

export const strip = (s?: string) => (s ?? '').replace(/<[^>]+>/g, '').trim()

const LA_CARD_LABEL = {
  account_activity: 'Account activity',
  feature_list: 'Keep / lose list',
  message: 'Message',
} as const

const SURVEY_PRESENTATION_LABEL = {
  radio: 'Radio list',
  dropdown: 'Dropdown',
  free_text: 'Free text',
  inline_reason: 'Inline reason',
} as const

const CONFIRMATION_LABEL = {
  simple: 'Simple',
  consent: 'Consent',
  type_confirm: 'Type to confirm',
} as const

const OUTCOME_LABEL = {
  success: 'Success',
  reactivation: 'Reactivation',
  feedback: 'Feedback',
} as const

/** Short type name for a component — the card's eyebrow. */
export function kindLabel(c: ExperienceComponent): string {
  switch (c.kind) {
    case 'offer':
      return offerVariantLabel(c.category)
    case 'survey':
      return 'Survey'
    case 'loss_aversion':
      return 'Loss aversion'
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

/** The structural choice within a kind — presentation, card type, variant. */
export function modeLabel(c: ExperienceComponent): string | null {
  switch (c.kind) {
    case 'survey':
      return SURVEY_PRESENTATION_LABEL[c.presentation]
    case 'loss_aversion':
      return LA_CARD_LABEL[c.cardType]
    case 'confirmation':
      return CONFIRMATION_LABEL[c.variant]
    case 'outcome':
      return OUTCOME_LABEL[c.variant]
    case 'pricing_table':
      return `${c.plans.length} plans`
    case 'checkout':
      return 'Secure checkout'
    case 'offer':
      return null
  }
}

export const ACCENTS: Record<ExperienceComponent['kind'], string> = {
  offer: '#6366f1',
  survey: '#0f172a',
  loss_aversion: '#8b5cf6',
  pricing_table: '#0ea5e9',
  checkout: '#0f172a',
  confirmation: '#334155',
  outcome: '#10b981',
}

/** The component a step is *about* — steps hold one, bar legacy compositions. */
export function leadComponent(step: Step): ExperienceComponent | null {
  return step.components[0] ?? null
}

/**
 * What one component says, in one line.
 *
 * A step can hold more than one, and the card used to borrow the first one's
 * headline and draw nothing at all for the second — a survey with a loss
 * aversion card under it looked exactly like a survey. So each component gets
 * its own line, and this is the line.
 */
export function componentHeadline(c: ExperienceComponent): string {
  switch (c.kind) {
    case 'offer':
      return strip(c.title)
    case 'confirmation':
      return strip(c.title)
    case 'outcome':
      return strip(c.headline)
    case 'survey':
      // The survey's own prompt lives on the step it sits in, bar free text.
      return strip(c.freeTextPrompt) || `${c.options.length} reasons`
    case 'pricing_table':
      return c.plans.map((p) => p.name).join(' · ')
    case 'checkout':
      return strip(c.title)
    case 'loss_aversion':
      return strip(
        c.cardType === 'message'
          ? c.message
          : c.cardType === 'account_activity'
            ? c.statsTitle
            : c.keepTitle,
      )
  }
}

/**
 * Closing steps, and what they are.
 *
 * Confirmation and outcome are not steps a merchant authors a path through:
 * one is always shown and one is where the journey stops. They are drawn as
 * terminals — tinted, captioned, and unnumbered — so they stop competing with
 * the authored steps for the word "step".
 */
export type TerminalKind = 'always' | 'end'

export function terminalOf(step: Step): TerminalKind | null {
  const kinds = step.components.map((c) => c.kind)
  if (kinds.some((k) => k === 'outcome')) return 'end'
  if (kinds.some((k) => k === 'confirmation')) return 'always'
  return null
}

export const TERMINAL_CAPTION: Record<TerminalKind, string> = {
  always: 'Always shown',
  end: 'Terminal',
}

/**
 * The line that says what this card does.
 *
 * Offer, confirmation and outcome carry their own copy and hide the step's
 * title block, so their headline is the component's; everything else is titled
 * by the step around it.
 */
export function headlineOf(step: Step): string {
  const c = leadComponent(step)
  const fallback = strip(step.title)
  if (!c) return fallback
  switch (c.kind) {
    case 'offer':
      return strip(c.title) || fallback
    case 'confirmation':
      return strip(c.title) || fallback
    case 'outcome':
      return strip(c.headline) || fallback
    case 'loss_aversion':
      return (
        fallback ||
        strip(c.cardType === 'message' ? c.message : c.cardType === 'account_activity' ? c.statsTitle : c.keepTitle)
      )
    default:
      return fallback
  }
}

/** One supporting line, shown only at the richest tier. */
export function subtextOf(step: Step): string {
  const c = leadComponent(step)
  const fallback = strip(step.description)
  if (!c) return fallback
  switch (c.kind) {
    case 'offer':
      return strip(c.description) || fallback
    case 'confirmation':
      return strip(c.subtitle) || fallback
    case 'outcome':
      return strip(c.body) || fallback
    case 'pricing_table':
      return c.plans.map((p) => p.name).join(' · ')
    default:
      return fallback
  }
}

/** Short terms that distinguish one variant of a step from another. */
export function factsOf(c: ExperienceComponent): string[] {
  switch (c.kind) {
    case 'offer': {
      const billing = c.billingEntity ?? {}
      const entity =
        c.category === 'discount'
          ? billing.couponId
          : c.category === 'plan_change'
          ? billing.planId
          : c.category === 'addon'
          ? billing.addonId
          : undefined
      return [c.reasonLinked ? 'Reason-linked' : '', c.consentEnabled ? 'Consent' : '', entity ?? '']
        .filter(Boolean)
        .slice(0, 2)
    }
    case 'confirmation':
      return c.impact.length ? [`${c.impact.length} impacts`] : []
    case 'loss_aversion':
      return c.cardType === 'account_activity' ? [`${c.stats?.length ?? 0} stats`] : []
    default:
      return []
  }
}

export function surveyOfStep(step: Step): SurveyComponent | null {
  return (step.components.find((c) => c.kind === 'survey') as SurveyComponent) ?? null
}

/** A step that carries exactly one save offer, and can be a link target. */
export function offerIdOfStep(step: Step): string | null {
  const offer = step.components.find((c) => c.kind === 'offer')
  return offer ? offer.id : null
}
