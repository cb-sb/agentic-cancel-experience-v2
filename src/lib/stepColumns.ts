import type { Step } from '../types/experience'

/**
 * A column in an experience's step layout. Unique steps get their own column
 * (laid out horizontally on the canvas); consecutive interchangeable steps
 * collapse into one column whose cards stack vertically — the subscriber only
 * ever sees one of them.
 */
export interface StepColumn {
  steps: { step: Step; index: number }[]
  isStack: boolean
}

/**
 * The two kinds of "one of these, not all of these".
 *
 * Save offers are chosen by the subscriber's reason; outcomes are chosen by how
 * the journey ended. Both are alternatives at a single moment, so both stack in
 * one column rather than reading as steps you pass through in turn — which is
 * exactly what three offers in a row did read as.
 */
export type AlternativeKind = 'offer' | 'outcome'

export function alternativeKind(step: Step): AlternativeKind | null {
  if (!step.components.length) return null
  if (step.stage === 'save_mechanic' && step.components.every((c) => c.kind === 'offer')) {
    return 'offer'
  }
  if (step.components.every((c) => c.kind === 'outcome')) return 'outcome'
  return null
}

/** A save-offer step is an interchangeable variation (one offer, reason-routed). */
export function isOfferVariationStep(step: Step): boolean {
  return alternativeKind(step) === 'offer'
}

/** A terminal: where the journey ended, not a stop along it. */
export function isOutcomeStep(step: Step): boolean {
  return alternativeKind(step) === 'outcome'
}

/** Group steps into columns — consecutive alternatives of one kind share one. */
export function buildStepColumns(steps: Step[]): StepColumn[] {
  const cols: StepColumn[] = []
  let openKind: AlternativeKind | null = null
  steps.forEach((step, index) => {
    const kind = alternativeKind(step)
    const last = cols[cols.length - 1]
    if (kind && kind === openKind && last) last.steps.push({ step, index })
    else cols.push({ steps: [{ step, index }], isStack: kind !== null })
    openKind = kind
  })
  return cols
}

/** Logical step count = number of columns (interchangeable offers count once).
 *  Disabled steps are skipped since they never render for the subscriber. */
export function logicalStepCount(steps: Step[]): number {
  return buildStepColumns(steps.filter((s) => !s.disabled)).length
}
