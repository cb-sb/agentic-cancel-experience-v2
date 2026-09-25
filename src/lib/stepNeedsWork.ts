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
  return stepReadiness(step, file).ready === false
}

/**
 * System readiness for one screen. The merchant does not tick this.
 * Confirmation and outcome screens are ready by being on the path.
 */
export function stepReadiness(step: Step, file: JourneyFile): { ready: boolean; reason: string } {
  const reasons = stepNeedsWorkReasons(step, file)
  const la = step.components.find((c) => c.kind === 'loss_aversion')
  if (la && la.kind === 'loss_aversion') {
    const bullets = (la.keepItems?.length ?? 0) + (la.loseItems?.length ?? 0) + (la.stats?.length ?? 0)
    const headline = (step.title ?? '').trim() || (la.message ?? '').trim()
    if (!headline) reasons.push('Needs a headline')
    if (la.cardType !== 'message' && bullets === 0) reasons.push('Needs at least one point')
  }
  if (reasons.length === 0) return { ready: true, reason: 'Ready' }
  return { ready: false, reason: reasons[0] }
}

export function anyStepNeedsWork(steps: Step[], file: JourneyFile): boolean {
  return steps.some((step) => stepNeedsWork(step, file))
}
