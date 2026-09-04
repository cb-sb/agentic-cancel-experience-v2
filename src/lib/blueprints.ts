import { uid } from './id'
import {
  makeConfirmation,
  makeLossAversion,
  makeOffer,
  makeOutcome,
  makePricingTable,
  makeSavedOutcome,
  makeSurvey,
} from './factories'
import { offerVariantPatch } from './offerVariants'
import type {
  Branding,
  BlueprintId,
  BlueprintMeta,
  Experience,
  FrameVisibility,
  OfferCategory,
  Step,
} from '../types/experience'

export const BLUEPRINTS: BlueprintMeta[] = [
  {
    id: 'click_to_cancel',
    name: 'One-Step Flow',
    stepCount: 1,
    posture: 'clean_exit',
    description: 'Click to cancel. Impact + confirmation only.',
  },
  {
    id: 'clean_exit_1',
    name: 'Two-Step Flow',
    stepCount: 2,
    posture: 'clean_exit',
    description: 'Value reinforcement, then confirmation. Respect the exit.',
  },
  {
    id: 'clean_exit_2',
    name: 'Three-Step Flow',
    stepCount: 3,
    posture: 'clean_exit',
    description: 'Value reinforcement, learn why, then confirmation.',
  },
  {
    id: 'balanced',
    name: 'Four-Step Flow',
    stepCount: 4,
    posture: 'balanced',
    description: 'One targeted save option per reason. The default posture.',
  },
  {
    id: 'save_aggressive',
    name: 'Five-Step Flow',
    stepCount: 5,
    posture: 'save_aggressive',
    description: 'Entry offer plus a reason-linked save mechanic.',
  },
  {
    id: 'custom_6',
    name: 'Six-Step Flow',
    stepCount: 6,
    posture: 'save_aggressive',
    description: 'Extended save flow — the FTC six-step maximum.',
  },
]

export function blueprintMeta(id: BlueprintId): BlueprintMeta {
  return BLUEPRINTS.find((b) => b.id === id) ?? BLUEPRINTS[0]
}

export const DEFAULT_BRANDING: Branding = {
  merchantName: 'chargebee',
  logoUrl: undefined,
  siteColor: '#ffffff',
  cardColor: '#ffffff',
  cardFillType: 'solid',
  cardGradientFrom: '#ffffff',
  cardGradientTo: '#eef2ff',
  cardGradientAngle: 135,
  cardBorderColor: '#e2e8f0',
  cardBorderType: 'solid',
  cardBorderGradientFrom: '#6366f1',
  cardBorderGradientTo: '#ec4899',
  cardBorderGradientAngle: 135,
  cardBorderWidth: 1,
  primaryColor: '#2563eb',
  secondaryColor: '#dc2626',
  accentColor: '#ea580c',
  titleColor: '#0f172a',
  textColor: '#334155',
  mutedColor: '#64748b',
  fontFamily: "'Inter', system-ui, sans-serif",
  headingFontFamily: "'Inter', system-ui, sans-serif",
  bodyFontFamily: "'Inter', system-ui, sans-serif",
  headingFontWeight: 700,
  headingFontScale: 100,
  headingLineHeight: 1.2,
  headingLetterSpacing: 0,
  buttonBorderColor: '#2563eb',
  buttonBorderWidth: 0,
  fontSizeBase: 16,
  fontLineHeight: 1.5,
  fontWeight: 400,
  letterSpacing: 0,
  textAlign: 'left',
  cornerRadius: 12,
  tone: 'Friendly-professional',
}

export const DEFAULT_FRAME: FrameVisibility = {
  logo: true,
  exitX: true,
  progress: true,
  title: true,
  description: true,
}

// --- Step builders per stage -------------------------------------------------

export function valueReinforcementStep(): Step {
  return {
    id: uid('step'),
    stage: 'value_reinforcement',
    title: "Wait — you'll lose access to everything you've built",
    description: "Before you go, here's what your Pro plan includes and what disappears when you cancel.",
    layout: 'single',
    components: [makeLossAversion()],
  }
}

function entryOfferStep(): Step {
  return {
    id: uid('step'),
    stage: 'entry_offer',
    // Offer steps lead with the offer card itself — no step title/subtitle.
    title: '',
    description: '',
    layout: 'single',
    components: [
      makeOffer({
        eyebrow: 'A GIFT FOR YOU',
        category: 'extension',
        title: '1 month on us',
        description: 'Stay another month free while you decide. We think you will want to stick around.',
        primaryCta: 'Claim my free month',
        reasonLinked: false,
      }),
    ],
  }
}

export function surveyStep(): Step {
  return {
    id: uid('step'),
    stage: 'route_detection',
    title: 'Help us improve — why are you cancelling?',
    description: 'Your feedback is valuable to us. Please select the option that best describes your situation.',
    layout: 'single',
    components: [makeSurvey()],
  }
}

function saveOfferStep(reasonLinked: boolean): Step {
  return {
    id: uid('step'),
    stage: 'save_mechanic',
    // Offer steps lead with the offer card itself — no step title/subtitle.
    title: '',
    description: '',
    layout: 'single',
    components: [makeOffer({ reasonLinked })],
  }
}

export function pricingTableStep(): Step {
  return {
    id: uid('step'),
    stage: 'save_mechanic',
    title: 'Or pick a plan that fits better',
    description: 'Downgrade instead of leaving — keep the essentials at a lower price.',
    layout: 'single',
    components: [makePricingTable()],
  }
}

function confirmationStep(): Step {
  return {
    id: uid('step'),
    stage: 'confirmation',
    title: 'Are you sure you want to cancel?',
    description: "You'll lose access to all Pro features when your billing period ends.",
    layout: 'single',
    components: [makeConfirmation()],
  }
}

function outcomeStep(): Step {
  return {
    id: uid('step'),
    stage: 'outcome',
    // The outcome card leads with its own centered headline — no step title.
    title: '',
    description: '',
    layout: 'single',
    components: [makeOutcome()],
  }
}

function savedOutcomeStep(): Step {
  return {
    id: uid('step'),
    stage: 'outcome',
    title: '',
    description: '',
    layout: 'single',
    components: [makeSavedOutcome()],
  }
}

/**
 * The closing steps: one confirmation, then both ends of the journey.
 *
 * Two outcomes rather than one card that rewrote itself depending on how it was
 * reached. They are alternatives at the same moment, so they stack in one
 * column exactly as interchangeable offers do, and the wires can say which
 * decision arrives at which — the saved one first, since the paths that reach
 * it come from the offers above.
 */
export function confirmationSteps(): Step[] {
  return [confirmationStep(), savedOutcomeStep(), outcomeStep()]
}

/** Reason codes routed to the first save offer by default (price-sensitive +
 *  low-usage churners are the strongest discount/pause candidates). */
const DEFAULT_LINKED_REASON_CODES = ['price', 'not_using']

/** Link a couple of survey reasons to the first save offer after the survey so
 *  the reason→offer mapping is populated (and visible) out of the box. */
function linkDefaultReasons(steps: Step[]): Step[] {
  const surveyIdx = steps.findIndex((s) => s.components.some((c) => c.kind === 'survey'))
  if (surveyIdx < 0) return steps
  const offer = steps
    .slice(surveyIdx + 1)
    .flatMap((s) => s.components)
    .find((c) => c.kind === 'offer')
  if (!offer) return steps
  const survey = steps[surveyIdx].components.find((c) => c.kind === 'survey')
  if (survey && survey.kind === 'survey') {
    survey.options.forEach((o) => {
      if (!o.isOther && DEFAULT_LINKED_REASON_CODES.includes(o.code)) o.linkedOfferId = offer.id
    })
  }
  return steps
}

/** Seed the default steps for a blueprint, per the guidelines' Defaults. */
export function seedSteps(blueprint: BlueprintId): Step[] {
  switch (blueprint) {
    case 'click_to_cancel':
      return [...confirmationSteps()]
    case 'clean_exit_1':
      return [valueReinforcementStep(), ...confirmationSteps()]
    case 'clean_exit_2':
      return [valueReinforcementStep(), surveyStep(), ...confirmationSteps()]
    case 'balanced':
      return linkDefaultReasons([valueReinforcementStep(), surveyStep(), saveOfferStep(true), ...confirmationSteps()])
    case 'save_aggressive':
      return linkDefaultReasons([
        valueReinforcementStep(),
        entryOfferStep(),
        surveyStep(),
        saveOfferStep(true),
        ...confirmationSteps(),
      ])
    case 'custom_6':
      // Value reinforcement → Entry offer → Survey → Offer → Pricing table → Confirmation → Outcome.
      // Reason-routed save offers count as one logical step; the pricing table is
      // a separate save mechanic (not an offer component).
      return linkDefaultReasons([
        valueReinforcementStep(),
        entryOfferStep(),
        surveyStep(),
        saveOfferStep(true),
        pricingTableStep(),
        ...confirmationSteps(),
      ])
    default:
      return [...confirmationSteps()]
  }
}

/** A standalone save-offer step of a specific type (with type-appropriate copy). */
function typedOfferStep(category: OfferCategory): Step {
  return {
    id: uid('step'),
    stage: 'save_mechanic',
    title: '',
    description: '',
    layout: 'single',
    components: [makeOffer({ reasonLinked: true, media: { type: 'image' }, ...offerVariantPatch(category) })],
  }
}

/**
 * A worked reason→offer routing scenario: three save offers of different types
 * after the survey, with two reasons intentionally sharing one offer. Used as
 * the default primary experience so the mapping is visible out of the box.
 */
export function seedMappingScenarioSteps(): Step[] {
  const survey = surveyStep()
  // A step with two components in it, out of the box. The composer has always
  // allowed a survey to carry a loss-aversion card beside it (see
  // `canAddToStep`), but nothing seeded reached for it, so the case where a
  // step holds more than one thing was invisible — including on the canvas,
  // where the card only ever drew the first.
  survey.components.push(
    makeLossAversion({
      cardType: 'account_activity',
      statsTitle: "What you've built so far",
    }),
  )
  survey.layout = 'two_column'
  survey.splitRatio = 0.58
  const discount = typedOfferStep('discount')
  const pause = typedOfferStep('pause')
  const planChange = typedOfferStep('plan_change')
  const steps = [survey, discount, pause, planChange, ...confirmationSteps()]

  const s = survey.components.find((c) => c.kind === 'survey')
  if (s && s.kind === 'survey') {
    const offA = discount.components[0].id
    const offB = pause.components[0].id
    const offC = planChange.components[0].id
    const link = (code: string, offerId: string) =>
      s.options.forEach((o) => {
        if (!o.isOther && o.code === code) o.linkedOfferId = offerId
      })
    // Price-sensitive + low-usage churners both route to the discount (2 → 1).
    link('price', offA)
    link('not_using', offA)
    // Complexity → a simpler, cheaper plan.
    link('too_complex', offC)
    // Missing features → pause while the roadmap catches up.
    link('missing_features', offB)
    // "Switching to a competitor" stays unlinked (no reason-specific save).
  }
  return steps
}

export function seedExperience(
  blueprint: BlueprintId,
  opts: { id?: string; name?: string } = {},
): Experience {
  return {
    id: opts.id ?? uid('exp'),
    name: opts.name ?? 'Cancel experience',
    blueprint,
    shell: 'modal',
    branding: { ...DEFAULT_BRANDING },
    frame: { ...DEFAULT_FRAME },
    steps: seedSteps(blueprint),
  }
}
