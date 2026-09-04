import { blueprintMeta, BLUEPRINTS } from '../../lib/blueprints'
import type { BlueprintId } from '../../types/experience'
import type { ConsultingSignals } from './types'

const ORDER: BlueprintId[] = [
  'click_to_cancel',
  'clean_exit_1',
  'clean_exit_2',
  'balanced',
  'save_aggressive',
  'custom_6',
]

/** Signal → recommended blueprint. Mirrors the consulting matrix. */
export function recommendBlueprint(s: ConsultingSignals): BlueprintId {
  if (s.compliance === 'high' || (s.goal === 'clean_exit' && s.survey === 'none')) return 'click_to_cancel'
  if (s.goal === 'clean_exit' && s.survey === 'low') return 'clean_exit_1'
  if (s.goal === 'clean_exit') return 'clean_exit_2'
  if (s.saveAppetite === 'max') return 'custom_6'
  if (s.saveAppetite === 'high' || s.goal === 'max_save') return 'save_aggressive'
  // Industry modifier: regulated stays clean (an explicit high save appetite is
  // already handled above).
  if (s.industry === 'regulated') return 'clean_exit_2'
  if (s.survey === 'high') return 'clean_exit_2'
  return 'balanced'
}

export function stepDown(id: BlueprintId): BlueprintId {
  const i = ORDER.indexOf(id)
  return ORDER[Math.max(0, i - 1)]
}

export function stepUp(id: BlueprintId): BlueprintId {
  const i = ORDER.indexOf(id)
  return ORDER[Math.min(ORDER.length - 1, i + 1)]
}

/** Map a desired step count (1–6) to its blueprint. */
export function blueprintForStepCount(n: number): BlueprintId {
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, n - 1))]
}

/** "Why this fits you" copy, per blueprint. */
export const RATIONALE: Record<BlueprintId, string> = {
  click_to_cancel:
    "It's the lowest-friction option — impact summary plus confirmation, no surveys or offers before the cancel. That's the safest posture for FTC click-to-cancel compliance. You trade away reason capture and deflection, but exit trust stays highest.",
  clean_exit_1:
    'Adds a single value-reinforcement moment — the subscriber sees what they lose — then goes straight to confirmation. A respectful pause without feeling salesy. Compliance-safe, with a modest lift from loss aversion alone.',
  clean_exit_2:
    'Keeps the exit clean but adds a reason survey before confirmation, so you get structured churn insight without presenting save offers. Best when analytics matter more than deflection.',
  balanced:
    'Value reinforcement → reason survey → one reason-linked save offer → confirmation. It balances subscriber respect with measurable save lift, and one offer keeps friction reasonable. The right default for most subscriptions.',
  save_aggressive:
    'Adds an entry offer before the survey, then a second reason-linked save. Use it when save rate is a top KPI and your brand can sustain multiple touchpoints — expect stronger deflection at the cost of more friction.',
  custom_6:
    'The FTC six-step maximum: value → entry offer → survey → targeted offer → pricing downgrade → confirmation. Highest save potential and highest friction — pick it only when downgrade paths are core to your strategy.',
}

const INDUSTRY_ADDON: Partial<Record<NonNullable<ConsultingSignals['industry']>, string>> = {
  regulated: 'Regulated categories benefit from fewer pre-cancel steps, so I biased toward a lower step count.',
  b2b_saas: 'For B2B SaaS, the reason survey pays off in roadmap signal.',
  consumer: 'For consumer subscriptions, a reason-linked offer tends to recover meaningful revenue.',
  marketplace: 'For marketplaces, a downgrade/pricing path often beats a hard churn.',
}

export function recommendationMessage(id: BlueprintId, s: ConsultingSignals): string {
  const meta = blueprintMeta(id)
  const addon = s.industry ? INDUSTRY_ADDON[s.industry] : undefined
  const posture = meta.posture.replace('_', ' ')
  return [
    `My recommendation: ${meta.name} — ${meta.stepCount} step${meta.stepCount > 1 ? 's' : ''}, ${posture} posture.`,
    RATIONALE[id],
    addon,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function stepSummaryLine(id: BlueprintId): string {
  const meta = blueprintMeta(id)
  return `${meta.name} · ${meta.stepCount} step${meta.stepCount > 1 ? 's' : ''}`
}

export { BLUEPRINTS }
