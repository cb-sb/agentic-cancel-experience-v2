import type { JourneyFile, JourneyStepFile, JourneyTemplate, OfferKey } from './types'

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
    case 'acquire_2':
      return '2-step pricing to checkout'
    default:
      return 'Untitled'
  }
}

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

export function startFromTemplate(
  base: JourneyFile,
  template: JourneyTemplate,
): JourneyFile {
  const acquire = template === 'acquire_2'
  return {
    ...base,
    kind: acquire ? 'acquisition' : 'cancel',
    template,
    name: acquire ? 'Acquire subscribers' : 'Cancel experience',
    steps: skeletonSteps(template),
  }
}
