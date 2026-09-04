import { offerVariantLabel } from './offerVariants'
import type { OfferCategory, Step } from '../types/experience'

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim()

export const stageLabel: Record<Step['stage'], string> = {
  value_reinforcement: 'Loss aversion',
  entry_offer: 'Entry offer',
  route_detection: 'Survey reasons',
  save_mechanic: 'Offer',
  checkout: 'Checkout',
  confirmation: 'Confirmation',
  outcome: 'Outcome',
}

/**
 * What to call a step: the offer variant or card identity, before the stage.
 *
 * The survey is checked before the loss-aversion card because the two can share
 * a step, and when they do the survey is the thing being asked — a step that
 * collects a reason and shows some stats beside it is a survey step, not a
 * loss-aversion one.
 */
export function stepLabel(step: Step): string {
  const outcome = step.components.find((c) => c.kind === 'outcome')
  // Two outcomes both called "Outcome" is the fan-out problem again, in words.
  if (outcome && outcome.kind === 'outcome')
    return outcome.forResult === 'saved' ? 'Saved' : 'Cancelled'
  const offer = step.components.find((c) => c.kind === 'offer')
  if (offer && offer.kind === 'offer') return offerVariantLabel(offer.category)
  if (step.components.some((c) => c.kind === 'pricing_table')) return 'Pricing table'
  if (step.components.some((c) => c.kind === 'checkout')) return 'Checkout'
  if (step.components.some((c) => c.kind === 'survey')) return stripTags(step.title) || 'Survey reasons'
  if (step.components.some((c) => c.kind === 'loss_aversion')) return 'Loss aversion'
  return stageLabel[step.stage]
}

const compactStage: Record<Step['stage'], string> = {
  value_reinforcement: 'Value',
  entry_offer: 'Offer',
  route_detection: 'Survey',
  save_mechanic: 'Offer',
  checkout: 'Pay',
  confirmation: 'Confirm',
  outcome: 'Outcome',
}

/** Offer variants whose full label is too long for a zoomed-out card. */
const compactOffer: Partial<Record<OfferCategory, string>> = {
  plan_change: 'Plan',
  extension: 'Extend',
  skip: 'Skip',
}

/**
 * Short form of `stepLabel`, for when the card is too small on screen to carry
 * the full name at a legible size. Offer variants keep their own name, since
 * "Discount" or "Pause" is both short and the most useful thing to know.
 */
/**
 * Name for a step in a compact strip. Every step name is short except a
 * survey's, which is the question itself — a sentence, which would either
 * dominate the strip or be truncated into nonsense. That one falls back to the
 * short form; the full question is still there as the tooltip.
 */
export function tabLabel(step: Step): string {
  const full = stepLabel(step)
  return full.length > 18 ? compactStepLabel(step) : full
}

export function compactStepLabel(step: Step): string {
  const outcome = step.components.find((c) => c.kind === 'outcome')
  if (outcome && outcome.kind === 'outcome')
    return outcome.forResult === 'saved' ? 'Saved' : 'Cancelled'
  const offer = step.components.find((c) => c.kind === 'offer')
  if (offer && offer.kind === 'offer')
    return compactOffer[offer.category] ?? offerVariantLabel(offer.category)
  if (step.components.some((c) => c.kind === 'pricing_table')) return 'Pricing'
  if (step.components.some((c) => c.kind === 'checkout')) return 'Pay'
  if (step.components.some((c) => c.kind === 'survey')) return 'Survey'
  if (step.components.some((c) => c.kind === 'loss_aversion')) return 'Value'
  return compactStage[step.stage]
}
