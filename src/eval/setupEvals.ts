/**
 * Golden-prompt evals for Copilot setup.
 *
 * Scores the shipped interpreter (`interpret`) plus compile spine invariants.
 * Media-worded briefs that the parser cannot land are `gap` cases — product
 * signal, not a broken test. `pass` cases are the regression gate.
 *
 *   npm run eval:setup
 */

import { interpret } from '../journey/intake'
import { compileJourney } from '../journey/compile'
import { isBrandIntent } from '../brand/matchSite'
import {
  EMPTY_JOURNEY,
  isTailKind,
  type AudienceKey,
  type JourneyFile,
  type JourneyKind,
  type JourneyStepKind,
  type JourneyTemplate,
  type OfferKey,
} from '../journey/types'
import { MAX_STEPS } from '../types/experience'
import type { ShellLayout } from '../types/experience'

export type EvalGrade = 'pass' | 'gap' | 'stretch'

export interface Gold {
  changed?: boolean
  rebuilt?: boolean
  kind?: JourneyKind
  template?: JourneyTemplate
  /** Minimum template rank when an exact id is too strict (survey-only briefs). */
  templateAtLeast?: JourneyTemplate
  shell?: ShellLayout
  audience?: AudienceKey
  stepKinds?: JourneyStepKind[]
  offers?: OfferKey[]
  brandMatched?: boolean
  /** Honest fallback when the parser cannot read a change. */
  unchanged?: boolean
}

export interface SetupEvalCase {
  id: string
  prompt: string
  /** Why this brief exists — merchant job, not implementation trivia. */
  why: string
  /** `pass` must match gold. `gap` / `stretch` record the miss without failing the run. */
  grade: EvalGrade
  gold: Gold
}

const RANK: JourneyTemplate[] = [
  'none',
  'cancel_1',
  'cancel_2',
  'cancel_3',
  'cancel_4',
  'cancel_5',
  'cancel_plan_change',
  'acquire_2',
]

export const SETUP_EVAL_CASES: SetupEvalCase[] = [
  {
    id: 'four-step-pause-fullpage',
    prompt: '4-step cancel with a pause, full page',
    why: 'Default balanced save, pause as the mechanic, hosted page — the one-line Growth PM brief.',
    grade: 'pass',
    gold: {
      changed: true,
      rebuilt: true,
      kind: 'cancel',
      template: 'cancel_4',
      shell: 'fullpage',
      stepKinds: [
        'loss_aversion',
        'survey',
        'offer',
        'confirmation',
        'outcome_saved',
        'outcome_cancelled',
      ],
      offers: ['pause'],
    },
  },
  {
    id: 'click-to-cancel-modal',
    prompt: 'click to cancel, modal',
    why: 'Legal / CX click-to-cancel. Should land cancel_1 without a step count.',
    grade: 'gap',
    gold: {
      changed: true,
      rebuilt: true,
      kind: 'cancel',
      template: 'cancel_1',
      shell: 'modal',
      stepKinds: ['confirmation', 'outcome_saved', 'outcome_cancelled'],
    },
  },
  {
    id: 'survey-why-they-cancel',
    prompt: 'survey why they cancel then let them go',
    why: 'Learn-then-let-go posture. The shipped parser needs the word cancel, not leave.',
    grade: 'pass',
    gold: {
      changed: true,
      rebuilt: true,
      kind: 'cancel',
      templateAtLeast: 'cancel_3',
    },
  },
  {
    id: 'survey-then-let-go',
    prompt: 'survey why they leave then let them go',
    why: 'Same job without the word cancel — parser does not start a journey.',
    grade: 'gap',
    gold: {
      changed: true,
      rebuilt: true,
      kind: 'cancel',
      templateAtLeast: 'cancel_3',
    },
  },
  {
    id: 'cheaper-plan-instead',
    prompt: 'cheaper plan instead of cancelling',
    why: 'Shipped parser treats cheaper plan as the offer slot on the balanced cancel, not the pricing-table template.',
    grade: 'pass',
    gold: {
      changed: true,
      rebuilt: true,
      kind: 'cancel',
      template: 'cancel_4',
      offers: ['plan_change'],
    },
  },
  {
    id: 'pricing-table-to-save',
    prompt: 'cancel with a pricing table and checkout',
    why: 'Plan-change template only lands when the brief names a pricing table or checkout, not cheaper plan.',
    grade: 'pass',
    gold: {
      changed: true,
      rebuilt: true,
      kind: 'cancel',
      template: 'cancel_plan_change',
    },
  },
  {
    id: 'acquisition-fullpage',
    prompt: 'acquisition, full page',
    why: 'Acquire path from Copilot, not a cancel flow.',
    grade: 'pass',
    gold: {
      changed: true,
      rebuilt: true,
      kind: 'acquisition',
      template: 'acquire_2',
      shell: 'fullpage',
    },
  },
  {
    id: 'pause-until-next-season',
    prompt: 'pause until the next season',
    why: 'Streamer seasonal pause. Pause should land; seasonal duration/copy will not.',
    grade: 'stretch',
    gold: {
      changed: true,
      kind: 'cancel',
      templateAtLeast: 'cancel_4',
      offers: ['pause'],
    },
  },
  {
    id: 'keep-print-drop-digital',
    prompt: 'keep print, drop digital',
    why: 'Magazine bundle split. No print/digital plan-change language in the parser.',
    grade: 'gap',
    gold: {
      changed: true,
      kind: 'cancel',
      template: 'cancel_plan_change',
    },
  },
  {
    id: 'cancel-one-title',
    prompt: 'cancel just one magazine title',
    why: 'Title-level cancel inside all-access. Prototype has no title picker.',
    grade: 'gap',
    gold: {
      changed: true,
      kind: 'cancel',
      template: 'cancel_plan_change',
    },
  },
  {
    id: 'gift-ended',
    prompt: 'gift subscription ended',
    why: 'Gift recipient vs purchaser. No gift audience or reason code.',
    grade: 'gap',
    gold: {
      changed: true,
      kind: 'cancel',
      audience: 'all',
    },
  },
  {
    id: 'unreadable-prompt',
    prompt: 'make it pop',
    why: 'Honest fallback — do not guess a journey from empty flavour.',
    grade: 'pass',
    gold: { unchanged: true, changed: false },
  },
  {
    id: 'brand-navy-with-four-step',
    prompt: '4-step cancel with a pause, match my site, navy #1B365D',
    why: 'Brand intent must stick when spoken alongside a journey brief.',
    grade: 'pass',
    gold: {
      changed: true,
      rebuilt: true,
      kind: 'cancel',
      template: 'cancel_4',
      offers: ['pause'],
      brandMatched: true,
    },
  },
]

export interface GoldMiss {
  field: string
  expected: string
  got: string
}

export interface InvariantIssue {
  rule: string
  detail: string
}

export interface EvalResult {
  id: string
  grade: EvalGrade
  prompt: string
  why: string
  /** pass | fail against gold. Gap cases that miss gold are `fail` with `gate: false`. */
  status: 'pass' | 'fail'
  /** True when a fail should exit the process non-zero. */
  gates: boolean
  misses: GoldMiss[]
  invariants: InvariantIssue[]
  got: {
    changed: boolean
    rebuilt: boolean
    kind: JourneyKind
    template: JourneyTemplate
    shell: ShellLayout
    audience: AudienceKey
    stepKinds: JourneyStepKind[]
    offers: OfferKey[]
    brandMatched: boolean
    reply: string
  }
}

function atLeast(got: JourneyTemplate, min: JourneyTemplate): boolean {
  return RANK.indexOf(got) >= RANK.indexOf(min)
}

function facingSteps(file: JourneyFile) {
  return file.steps.filter((s) => s.kind !== 'outcome_saved' && s.kind !== 'outcome_cancelled')
}

/** FTC / consultative spine. Empty files skip — there is nothing to guard yet. */
export function spineInvariants(file: JourneyFile): InvariantIssue[] {
  if (file.template === 'none' || file.steps.length === 0) return []

  const issues: InvariantIssue[] = []
  const facing = facingSteps(file)

  if (facing.length > MAX_STEPS) {
    issues.push({
      rule: 'max-steps',
      detail: `${facing.length} subscriber-facing steps; cap is ${MAX_STEPS}`,
    })
  }

  if (file.kind === 'acquisition') {
    const last = facing[facing.length - 1]
    if (last && last.kind !== 'checkout') {
      issues.push({
        rule: 'acquire-ends-checkout',
        detail: `last facing step is ${last.kind}, expected checkout`,
      })
    }
    return issues
  }

  const last = facing[facing.length - 1]
  if (last && last.kind !== 'confirmation') {
    issues.push({
      rule: 'confirmation-last',
      detail: `last facing step is ${last.kind}, expected confirmation`,
    })
  }

  const confirmIdx = file.steps.findIndex((s) => s.kind === 'confirmation')
  if (confirmIdx >= 0) {
    const after = file.steps.slice(confirmIdx + 1)
    const nonOutcome = after.filter((s) => !isTailKind(s.kind))
    if (nonOutcome.length) {
      issues.push({
        rule: 'confirmation-standalone',
        detail: `non-outcome steps after confirmation: ${nonOutcome.map((s) => s.kind).join(', ')}`,
      })
    }
  }

  const hasSaved = file.steps.some((s) => s.kind === 'outcome_saved')
  const hasCancelled = file.steps.some((s) => s.kind === 'outcome_cancelled')
  if (!hasSaved || !hasCancelled) {
    issues.push({
      rule: 'outcomes-present',
      detail: `saved=${hasSaved} cancelled=${hasCancelled}`,
    })
  }

  const kinds = file.steps.map((s) => s.kind)
  const surveyIdx = kinds.indexOf('survey')
  file.steps.forEach((step, i) => {
    if (step.kind !== 'offer') return
    if (surveyIdx >= 0 && i < surveyIdx && step.id !== 'entry') {
      issues.push({
        rule: 'offer-after-survey',
        detail: `offer "${step.id}" sits before the survey and is not the entry offer`,
      })
    }
  })

  return issues
}

function compareGold(gold: Gold, file: JourneyFile, changed: boolean, rebuilt: boolean): GoldMiss[] {
  const misses: GoldMiss[] = []
  const add = (field: string, expected: string, got: string) => {
    if (expected !== got) misses.push({ field, expected, got })
  }

  if (gold.unchanged === true || gold.changed === false) {
    add('changed', 'false', String(changed))
    return misses
  }
  if (gold.changed !== undefined) add('changed', String(gold.changed), String(changed))
  if (gold.rebuilt !== undefined) add('rebuilt', String(gold.rebuilt), String(rebuilt))
  if (gold.kind) add('kind', gold.kind, file.kind)
  if (gold.template) add('template', gold.template, file.template)
  if (gold.templateAtLeast && !atLeast(file.template, gold.templateAtLeast)) {
    misses.push({
      field: 'templateAtLeast',
      expected: `>= ${gold.templateAtLeast}`,
      got: file.template,
    })
  }
  if (gold.shell) add('shell', gold.shell, file.shell)
  if (gold.audience) add('audience', gold.audience, file.audience)
  if (gold.stepKinds) add('stepKinds', gold.stepKinds.join(' > '), file.steps.map((s) => s.kind).join(' > '))
  if (gold.offers) {
    const got = file.steps.filter((s) => s.kind === 'offer' && s.offer).map((s) => s.offer as OfferKey)
    add('offers', gold.offers.join(','), got.join(','))
  }
  if (gold.brandMatched !== undefined) {
    add('brandMatched', String(gold.brandMatched), String(Boolean(file.brand.matched)))
  }
  return misses
}

export function runSetupEval(c: SetupEvalCase): EvalResult {
  const { file, reply, changed, rebuilt } = interpret(c.prompt, EMPTY_JOURNEY)
  const misses = compareGold(c.gold, file, changed, rebuilt)
  const invariants = spineInvariants(file)
  const goldFail = misses.length > 0
  const status: 'pass' | 'fail' = goldFail || invariants.length > 0 ? 'fail' : 'pass'
  const gates = c.grade === 'pass' && status === 'fail'

  return {
    id: c.id,
    grade: c.grade,
    prompt: c.prompt,
    why: c.why,
    status,
    gates,
    misses,
    invariants,
    got: {
      changed,
      rebuilt,
      kind: file.kind,
      template: file.template,
      shell: file.shell,
      audience: file.audience,
      stepKinds: file.steps.map((s) => s.kind),
      offers: file.steps.filter((s) => s.kind === 'offer' && s.offer).map((s) => s.offer as OfferKey),
      brandMatched: Boolean(file.brand.matched),
      reply,
    },
  }
}

export function runAllSetupEvals(cases: SetupEvalCase[] = SETUP_EVAL_CASES): EvalResult[] {
  return cases.map(runSetupEval)
}

export function compileCheck(file: JourneyFile): { ok: true } | { ok: false; detail: string } {
  try {
    const compiled = compileJourney(file)
    if (!compiled.experience) return { ok: false, detail: 'compile returned no experience' }
    return { ok: true }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

/** Brand-intent helper exported so the runner can note speech the parser treats as branding. */
export function promptLooksLikeBrand(prompt: string): boolean {
  return isBrandIntent(prompt)
}
