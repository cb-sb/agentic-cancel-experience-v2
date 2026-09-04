import type { Experience, SurveyComponent } from '../types/experience'
import { offerVariantLabel } from './offerVariants'

/** Distinct, legible colors for reason→offer mapping (line + dots + badges). */
export const MAPPING_COLORS = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#f59e0b', // amber
  '#ec4899', // pink
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#ef4444', // red
]

/** Neutral color for an offer that isn't (yet) a mapping target. */
export const MAPPING_NEUTRAL = '#94a3b8'

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim()

/** The single survey component in an experience, if any. */
export function surveyOf(exp: Experience): SurveyComponent | null {
  for (const step of exp.steps) {
    for (const c of step.components) if (c.kind === 'survey') return c
  }
  return null
}

/** Offers a survey can route to = offers on steps AFTER the survey step. */
export function linkableOffers(exp: Experience): { id: string; title: string }[] {
  const surveyIdx = exp.steps.findIndex((s) => s.components.some((c) => c.kind === 'survey'))
  if (surveyIdx < 0) return []
  const offers: { id: string; title: string }[] = []
  exp.steps.forEach((s, i) => {
    if (i <= surveyIdx) return
    s.components.forEach((c) => {
      if (c.kind === 'offer') offers.push({ id: c.id, title: stripTags(c.title) || 'Offer' })
    })
  })
  return offers
}

/** Stable color per linkable offer id (order-based), gray for anything else. */
export function colorForOfferFactory(exp: Experience): (offerId: string) => string {
  const order = new Map(linkableOffers(exp).map((o, i) => [o.id, i]))
  return (offerId: string) => {
    const i = order.get(offerId)
    return i === undefined ? MAPPING_NEUTRAL : MAPPING_COLORS[i % MAPPING_COLORS.length]
  }
}

/**
 * Short name per offer id — the variant ("Discount", "Pause"), not its headline.
 *
 * A card naming where a reason routes to has one line's worth of room for it, so
 * it needs the offer's *type* rather than its copy: "50% off for 3 months" is
 * the offer talking to the subscriber, and there is no room for it here.
 */
export function offerNameFactory(exp: Experience): (offerId: string) => string {
  const names = new Map<string, string>()
  exp.steps.forEach((s) =>
    s.components.forEach((c) => {
      if (c.kind === 'offer') names.set(c.id, offerVariantLabel(c.category))
    }),
  )
  return (offerId: string) => names.get(offerId) ?? 'Offer'
}

/** Reasons routed to each offer id: { offerId: [{id,label}, …] }. */
export function reasonsByOffer(exp: Experience): Record<string, { id: string; label: string }[]> {
  const survey = surveyOf(exp)
  const out: Record<string, { id: string; label: string }[]> = {}
  if (!survey) return out
  for (const o of survey.options) {
    if (o.linkedOfferId) (out[o.linkedOfferId] ??= []).push({ id: o.id, label: stripTags(o.label) || 'Reason' })
  }
  return out
}

/** Map every offer id in the experience to the step it lives on. */
export function offerStepIndex(exp: Experience): Map<string, string> {
  const m = new Map<string, string>()
  exp.steps.forEach((s) => s.components.forEach((c) => c.kind === 'offer' && m.set(c.id, s.id)))
  return m
}
