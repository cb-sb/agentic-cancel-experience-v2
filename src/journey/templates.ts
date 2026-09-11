import { isTailKind, type JourneyFile, type JourneyStepFile, type JourneyTemplate, type OfferKey } from './types'

function s(
  id: string,
  kind: JourneyStepFile['kind'],
  extra: Partial<JourneyStepFile> = {},
): JourneyStepFile {
  return { id, kind, live: false, ...extra }
}

const TAIL: JourneyStepFile[] = [
  s('confirm', 'confirmation', { headline: 'Are you sure you want to cancel?' }),
  s('saved', 'outcome_saved', { headline: 'Your plan is staying active' }),
  s('cancelled', 'outcome_cancelled', { headline: 'Your plan has been cancelled' }),
]

/** Skeleton steps for a template — gray on the canvas until the prompt fills them. */
export function skeletonSteps(template: JourneyTemplate): JourneyStepFile[] {
  switch (template) {
    case 'cancel_1':
      return [...TAIL]
    case 'cancel_2':
      return [s('value', 'loss_aversion', { headline: "Before you go" }), ...TAIL]
    case 'cancel_3':
      return [
        s('value', 'loss_aversion', { headline: 'Before you go' }),
        s('survey', 'survey', { headline: 'Why are you cancelling?' }),
        ...TAIL,
      ]
    case 'cancel_4':
      return [
        s('value', 'loss_aversion', { headline: 'Before you go' }),
        s('survey', 'survey', { headline: 'Why are you cancelling?' }),
        s('offer', 'offer', { offer: 'discount', headline: '50% off for 3 months' }),
        ...TAIL,
      ]
    case 'cancel_5':
      return [
        s('value', 'loss_aversion', { headline: 'Before you go' }),
        s('entry', 'offer', { offer: 'extension', headline: '1 month on us' }),
        s('survey', 'survey', { headline: 'Why are you cancelling?' }),
        s('offer', 'offer', { offer: 'discount', headline: '50% off for 3 months' }),
        ...TAIL,
      ]
    case 'cancel_plan_change':
      return [
        s('value', 'loss_aversion', { headline: 'Before you go' }),
        s('survey', 'survey', { headline: 'Why are you cancelling?' }),
        s('pricing', 'pricing_table', { headline: 'Choose a plan' }),
        s('checkout', 'checkout', { headline: 'Complete your change' }),
        ...TAIL,
      ]
    case 'acquire_2':
      return [
        s('pricing', 'pricing_table', { headline: 'Choose a plan' }),
        s('checkout', 'checkout', { headline: 'Complete checkout' }),
        s('saved', 'outcome_saved', { headline: 'You are in' }),
      ]
    default:
      return []
  }
}

export function templateLabel(template: JourneyTemplate): string {
  switch (template) {
    case 'cancel_1':
      return '1-step click to cancel'
    case 'cancel_2':
      return '2-step clean exit'
    case 'cancel_3':
      return '3-step with survey'
    case 'cancel_4':
      return '4-step balanced'
    case 'cancel_5':
      return '5-step save-aggressive'
    case 'cancel_plan_change':
      return 'Plan change to save'
    case 'acquire_2':
      return '2-step pricing to checkout'
    default:
      return 'Untitled'
  }
}

export type LibraryKind = 'cancel' | 'acquisition'

/** Consultative catalog for the Copilot template library — one card per journey Copilot already knows. */
export interface LibraryEntry {
  id: Exclude<JourneyTemplate, 'none'>
  title: string
  why: string
  /** Captions under the thumbnail strip, in screen order. */
  stepLabels: string[]
  kind: LibraryKind
  stepCount: number
}

export const LIBRARY: LibraryEntry[] = [
  {
    id: 'cancel_1',
    title: '1-step click to cancel',
    why: 'Use this when the law or your brand asks for a frictionless exit. The subscriber confirms once and is done — no survey, no save offer. Best for FTC-style click-to-cancel, and for merchants who would rather lose the revenue than add friction.',
    stepLabels: ['Confirm', 'Saved', 'Cancelled'],
    kind: 'cancel',
    stepCount: 1,
  },
  {
    id: 'cancel_2',
    title: '2-step clean exit',
    why: 'Remind them what they keep on this plan, then let them confirm. Two screens make the cost of leaving visible without asking why or putting an offer in the way — a clean exit that still feels considered.',
    stepLabels: ['What you keep', 'Confirm'],
    kind: 'cancel',
    stepCount: 2,
  },
  {
    id: 'cancel_3',
    title: '3-step with survey',
    why: 'Learn why they are leaving, then let them go. The survey is for you — it does not gate the cancel. Use this when you want the reason data and a short value reminder, but you are not ready to put a save offer on the path.',
    stepLabels: ['What you keep', 'Survey', 'Confirm'],
    kind: 'cancel',
    stepCount: 3,
  },
  {
    id: 'cancel_4',
    title: '4-step balanced',
    why: 'The default cancel journey: show what they lose, ask why, make one save offer, then confirm. One offer after the reason is enough to be consultative without stacking discounts. Start here unless you already know you need more or less.',
    stepLabels: ['What you keep', 'Survey', 'Save offer', 'Confirm'],
    kind: 'cancel',
    stepCount: 4,
  },
  {
    id: 'cancel_5',
    title: '5-step save-aggressive',
    why: 'Lead with an entry offer, then survey, then a second save offer before confirmation. Use this when the account is high value and you are willing to ask twice. Heavier than most merchants need — pick it on purpose, not by habit.',
    stepLabels: ['What you keep', 'Entry offer', 'Survey', 'Save offer', 'Confirm'],
    kind: 'cancel',
    stepCount: 5,
  },
  {
    id: 'cancel_plan_change',
    title: 'Plan change to save',
    why: 'Keep them as a subscriber by letting them pick a cheaper plan, then hand off to hosted checkout. They can still confirm and leave — this is a save mechanic on a cancel path, not acquiring a new subscriber.',
    stepLabels: ['What you keep', 'Survey', 'Choose a plan', 'Checkout', 'Confirm'],
    kind: 'cancel',
    stepCount: 5,
  },
  {
    id: 'acquire_2',
    title: 'Pricing table → checkout',
    why: 'Not a cancel flow. Put a pricing table in front of hosted checkout so a new subscriber can pick a plan and pay. Use this when you are acquiring, not retaining.',
    stepLabels: ['Pricing', 'Checkout'],
    kind: 'acquisition',
    stepCount: 2,
  },
]

export function withLive(steps: JourneyStepFile[], live: boolean): JourneyStepFile[] {
  return steps.map((s) => ({ ...s, live }))
}

export function applyOffers(steps: JourneyStepFile[], offers: OfferKey[]): JourneyStepFile[] {
  let i = 0
  return steps.map((step) => {
    if (step.kind !== 'offer') return step
    const offer = offers[i] ?? step.offer ?? 'discount'
    i += 1
    return { ...step, offer, live: true }
  })
}

export function setStepOffer(steps: JourneyStepFile[], stepId: string, offer: OfferKey): JourneyStepFile[] {
  return steps.map((step) =>
    step.id === stepId && step.kind === 'offer'
      ? { ...step, offer, headline: undefined, live: true }
      : step,
  )
}

const CANCEL_TEMPLATES: JourneyTemplate[] = ['cancel_1', 'cancel_2', 'cancel_3', 'cancel_4', 'cancel_5']

export function templateForCount(count: number): JourneyTemplate {
  const n = Math.min(Math.max(count, 1), 5)
  return CANCEL_TEMPLATES[n - 1]
}

export function cancelStepCount(template: JourneyTemplate): number {
  const i = CANCEL_TEMPLATES.indexOf(template)
  return i < 0 ? 0 : i + 1
}

/** Keep shell, audience, brand and offers while swapping the skeleton. */
export function switchTemplate(file: JourneyFile, template: JourneyTemplate): JourneyFile {
  const offers = file.steps
    .filter((s) => s.kind === 'offer' && s.offer)
    .map((s) => s.offer as OfferKey)
  const next = startFromTemplate(file, template)
  return { ...next, steps: withLive(applyOffers(next.steps, offers), true) }
}

export function hasPlanChangeBlocks(file: JourneyFile): boolean {
  return (
    file.kind === 'cancel' &&
    file.steps.some((step) => step.kind === 'pricing_table') &&
    file.steps.some((step) => step.kind === 'checkout')
  )
}

/**
 * Insert a plan picker and hosted-checkout handoff before the cancel tail.
 * Keeps existing value / survey / offer steps instead of swapping the whole
 * file to the acquisition template.
 */
export function insertPlanChangeBlocks(file: JourneyFile): JourneyFile {
  if (file.source === 'uploaded' || file.steps.length === 0 || file.template === 'none') {
    return startFromTemplate({ ...file, kind: 'cancel' }, 'cancel_plan_change')
  }

  let steps = [...file.steps]
  const hasPricing = steps.some((step) => step.kind === 'pricing_table')
  const hasCheckout = steps.some((step) => step.kind === 'checkout')
  const hasConfirm = steps.some((step) => step.kind === 'confirmation')

  if (!hasConfirm) {
    const savedIdx = steps.findIndex((step) => step.kind === 'outcome_saved')
    const insertAt = savedIdx >= 0 ? savedIdx : steps.length
    const extra: JourneyStepFile[] = [
      s('confirm', 'confirmation', { headline: 'Are you sure you want to cancel?', live: true }),
    ]
    if (!steps.some((step) => step.kind === 'outcome_cancelled')) {
      extra.push(s('cancelled', 'outcome_cancelled', { headline: 'Your plan has been cancelled', live: true }))
    }
    steps = [...steps.slice(0, insertAt), ...extra, ...steps.slice(insertAt)]
  }

  if (!hasPricing || !hasCheckout) {
    const tailStart = steps.findIndex((step) => isTailKind(step.kind))
    const at = tailStart >= 0 ? tailStart : steps.length
    const extra: JourneyStepFile[] = []
    if (!hasPricing) extra.push(s('pricing', 'pricing_table', { headline: 'Choose a plan', live: true }))
    if (!hasCheckout) extra.push(s('checkout', 'checkout', { headline: 'Complete your change', live: true }))
    steps = [...steps.slice(0, at), ...extra, ...steps.slice(at)]
  }

  return {
    ...file,
    kind: 'cancel',
    template: 'cancel_plan_change',
    steps: withLive(steps, true),
  }
}

export function startFromTemplate(
  base: JourneyFile,
  template: JourneyTemplate,
): JourneyFile {
  const acquire = template === 'acquire_2'
  return {
    ...base,
    kind: acquire ? 'acquisition' : 'cancel',
    template,
    source: 'authored',
    artifact: undefined,
    manifest: undefined,
    name: acquire
      ? 'Acquire subscribers'
      : template === 'cancel_plan_change'
        ? 'Plan change to save'
        : 'Cancel experience',
    steps: skeletonSteps(template),
  }
}
