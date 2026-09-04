/**
 * Turns a `DraftPlan` into real composer steps.
 *
 * This generalises `seedMappingScenarioSteps()`: there, the reason subset, the
 * three offer types and the reason→offer wiring were hardcoded to demo the
 * mapping. Here all three come from the plan, so what the plan card promised is
 * exactly what lands on the canvas.
 */

import { confirmationSteps, pricingTableStep, surveyStep, valueReinforcementStep } from './blueprints'
import { makeOffer } from './factories'
import { offerDef, type OfferDef } from './growthContext'
import { uid } from './id'
import type { OfferComponent, Step, SurveyReasonOption } from '../types/experience'
import type { DraftPlan } from '../orchestration/assistant/planner'

/** An offer card templated from a catalog entry rather than the generic default. */
function offerFrom(def: OfferDef, reasonLinked: boolean): OfferComponent {
  return makeOffer({
    category: def.category,
    eyebrow: def.eyebrow,
    title: def.title,
    description: def.description,
    primaryCta: def.primaryCta,
    reasonLinked,
    fulfillment: 'billing',
    billingEntity: def.billingEntity ?? {},
  })
}

function offerStep(component: OfferComponent): Step {
  return {
    id: uid('step'),
    // Offer steps lead with the offer card itself — no step title/subtitle.
    stage: component.reasonLinked ? 'save_mechanic' : 'entry_offer',
    title: '',
    description: '',
    layout: 'single',
    components: [component],
  }
}

/**
 * Compose the plan's steps.
 *
 * Reasons sharing an offer point at the same component id, so the composer
 * renders one interchangeable offer stack rather than one step per reason.
 */
export function composeSteps(plan: DraftPlan): Step[] {
  const stages = plan.steps.map((s) => s.stage)
  const steps: Step[] = []

  if (stages.includes('value_reinforcement')) steps.push(valueReinforcementStep())

  if (stages.includes('entry_offer') && plan.entryOfferId) {
    const def = offerDef(plan.entryOfferId)
    if (def) steps.push(offerStep(offerFrom(def, false)))
  }

  // One offer step per distinct offer the plan mapped, in first-use order.
  const offerIds = plan.mappings
    .map((m) => m.offerId)
    .filter((id, i, arr): id is string => Boolean(id) && arr.indexOf(id) === i)
  const componentIdByOffer = new Map<string, string>()
  const offerSteps: Step[] = []
  for (const id of offerIds) {
    const def = offerDef(id)
    if (!def) continue
    const component = offerFrom(def, true)
    componentIdByOffer.set(id, component.id)
    offerSteps.push(offerStep(component))
  }

  if (stages.includes('survey')) {
    const step = surveyStep()
    const survey = step.components.find((c) => c.kind === 'survey')
    if (survey && survey.kind === 'survey') {
      const options: SurveyReasonOption[] = plan.mappings.map((m) => ({
        id: uid('rs'),
        label: m.label,
        code: m.code,
        followUp: null,
        linkedOfferId: m.offerId ? componentIdByOffer.get(m.offerId) ?? null : null,
      }))
      survey.options = options
    }
    steps.push(step)
  }

  if (stages.includes('save_offers')) steps.push(...offerSteps)
  if (stages.includes('pricing_table')) steps.push(pricingTableStep())

  steps.push(...confirmationSteps())
  return steps
}
