import type { Experience, Step, SurveyReasonOption } from '../../types/experience'
import { reasonsByOffer } from '../../lib/mapping'
import { PORT_MAX } from './canvasTokens'
import { strip, surveyOfStep } from './tiers/stepFacts'

/**
 * A row down the lower half of a step card. Rows are declared here and consumed
 * both by the card body (which draws them) and by the node (which mounts a
 * handle for each) — one list, so a connector and the row it points at cannot
 * disagree about where they are.
 */
export interface PortRow {
  /** Handle id when the row is a port; unique within the card regardless. */
  id: string
  kind: 'reason' | 'overflow' | 'fact'
  label: string
  /** Reason rows only: the offer this reason routes to. */
  linkedOfferId?: string | null
  /** Overflow rows only: the reasons folded into this one. */
  bundled?: SurveyReasonOption[]
}

export const reasonPortId = (optionId: string) => `reason:${optionId}`
export const OVERFLOW_PORT_ID = 'reason:overflow'
export const offerPortId = (offerComponentId: string) => `offer:${offerComponentId}`

/**
 * Rows for a step, capped at `PORT_MAX`.
 *
 * When a survey has more reasons than there are slots, the tail is *bundled*
 * into one row rather than dropped: the bundled row keeps a real port, so the
 * connectors for those reasons still land somewhere true instead of vanishing.
 * Silently losing a connector is the exact failure this replaces.
 *
 * `exp` only ever changes a *label*, never the list: with the experience in hand
 * an offer's row can name the reasons that route to it rather than saying that
 * some do. Callers that just need the ports can leave it out — what they must
 * not do is get a different set of rows than the card draws.
 */
export function portRows(step: Step, exp?: Experience): PortRow[] {
  const survey = surveyOfStep(step)
  if (survey) {
    const options = survey.options
    if (options.length <= PORT_MAX) {
      return options.map((o) => ({
        id: reasonPortId(o.id),
        kind: 'reason',
        label: strip(o.label) || 'Reason',
        linkedOfferId: o.linkedOfferId ?? null,
      }))
    }
    // Routed reasons take the visible slots. A row's job at this size is to say
    // where a reason goes, so a reason that goes nowhere is the one worth
    // folding away — and every wire that gets a row of its own is a wire nobody
    // has to trace. Stable within each group, so the survey's order still shows
    // through as far as the slots allow.
    const byRouted = [
      ...options.filter((o) => o.linkedOfferId),
      ...options.filter((o) => !o.linkedOfferId),
    ]
    const shown = byRouted.slice(0, PORT_MAX - 1)
    const rest = byRouted.slice(PORT_MAX - 1)
    return [
      ...shown.map<PortRow>((o) => ({
        id: reasonPortId(o.id),
        kind: 'reason',
        label: strip(o.label) || 'Reason',
        linkedOfferId: o.linkedOfferId ?? null,
      })),
      {
        id: OVERFLOW_PORT_ID,
        kind: 'overflow',
        label: `+${rest.length} more reason${rest.length === 1 ? '' : 's'}`,
        bundled: rest,
      },
    ]
  }

  return factRows(step, exp).slice(0, PORT_MAX)
}

/** Reason rows carry handles; fact rows are only ever drawn. */
export function reasonPorts(step: Step): PortRow[] {
  return portRows(step).filter((r) => r.kind !== 'fact')
}

/** The one component on this step that a reason can route to, if any. */
export function offerPortOf(step: Step): string | null {
  const offer = step.components.find((c) => c.kind === 'offer')
  return offer ? offerPortId(offer.id) : null
}

/**
 * What a non-survey card lists instead of reasons. Same rhythm, so a row of
 * cards reads as a set — and the lower half of a card is never dead space.
 */
function factRows(step: Step, exp?: Experience): PortRow[] {
  const rows: PortRow[] = []
  step.components.forEach((c) => {
    switch (c.kind) {
      case 'offer': {
        const billing = c.billingEntity ?? {}
        const entity = billing.couponId ?? billing.planId ?? billing.addonId
        if (c.primaryCta) rows.push(fact(c.id, 'cta', strip(c.primaryCta)))
        if (entity) rows.push(fact(c.id, 'entity', entity))
        if (c.reasonLinked) rows.push(fact(c.id, 'linked', shownFor(c.id, exp)))
        break
      }
      case 'confirmation':
        c.impact.forEach((i) => rows.push(fact(c.id, i.id, strip(i.label))))
        break
      case 'pricing_table':
        c.plans.forEach((p) => rows.push(fact(c.id, p.id, `${p.name} · ${p.price}`)))
        break
      case 'checkout':
        if (c.title) rows.push(fact(c.id, 'title', strip(c.title)))
        break
      case 'loss_aversion':
        if (c.cardType === 'feature_list') {
          ;(c.keepItems ?? []).forEach((i) => rows.push(fact(c.id, i.id, strip(i.label))))
        } else if (c.cardType === 'account_activity') {
          ;(c.stats ?? []).forEach((s) => rows.push(fact(c.id, s.id, `${s.value} ${strip(s.label)}`)))
        }
        break
      case 'outcome':
        if (c.undoCta) rows.push(fact(c.id, 'undo', strip(c.undoCta)))
        break
      case 'survey':
        break
    }
  })
  return rows
}

/**
 * The other end of a reason's route, on the offer that receives it.
 *
 * Named where there is room to name it: one reason gets quoted, several get
 * counted. The old line said only that this offer was reason-gated, which left
 * the mapping readable in one direction and a guess in the other.
 */
function shownFor(offerId: string, exp?: Experience): string {
  const reasons = exp ? reasonsByOffer(exp)[offerId] ?? [] : []
  if (!reasons.length) return 'Shown for matching reasons'
  if (reasons.length === 1) return `Shown for “${reasons[0].label}”`
  return `Shown for ${reasons.length} reasons`
}

const fact = (componentId: string, key: string, label: string): PortRow => ({
  id: `fact:${componentId}:${key}`,
  kind: 'fact',
  label,
})
