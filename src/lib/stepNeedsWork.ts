import type { JourneyFile } from '../journey/types'
import type { Step } from '../types/experience'

/** Why a canvas step still needs configuration. Empty array means ready. */
export function stepNeedsWorkReasons(step: Step, file: JourneyFile): string[] {
  const reasons: string[] = []
  if (file.source === 'uploaded') {
    const mapped = file.manifest?.steps.find((s) => s.id === step.id)
    if (mapped?.slots.some((slot) => !slot.bind)) reasons.push('Unbound upload slot')
  }
  const offer = step.components.find((c) => c.kind === 'offer')
  if (offer && offer.kind === 'offer' && !offer.category) reasons.push('Offer has no mechanic')
  const survey = step.components.find((c) => c.kind === 'survey')
  if (survey && survey.kind === 'survey' && survey.options.length === 0 && survey.presentation !== 'free_text') {
    reasons.push('Survey has no reasons')
  }
  return reasons
}

export function stepNeedsWork(step: Step, file: JourneyFile): boolean {
  return stepNeedsWorkReasons(step, file).length > 0
}

export function anyStepNeedsWork(steps: Step[], file: JourneyFile): boolean {
  return steps.some((step) => stepNeedsWork(step, file))
}
