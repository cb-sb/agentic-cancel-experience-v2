import { blueprintMeta } from '../../lib/blueprints'
import { AUDIENCE_LIBRARY, conditionExpression } from '../../types/orchestration'
import { GAP_TURN_ID, PLAN_CARD_TURN_ID, PUSHBACK_TURN_ID, ENTRY_TURN_ID } from './ids'
import { nextGap } from './intent'
import { questionFor } from './questions'
import { recommendBlueprint, recommendationMessage, stepDown, stepSummaryLine, stepUp } from './recommend'
import type { ApplyOp, AssistantOption, AssistantTurn } from './types'

/** Build an audience apply-op from a saved-library entry so agent picks carry rules. */
function savedAudienceOp(id: string): ApplyOp {
  const a = AUDIENCE_LIBRARY.find((x) => x.id === id)!
  return {
    t: 'audience',
    name: a.name,
    ruleType: 'TARGETING',
    savedAudienceId: a.id,
    match: a.match,
    conditions: a.conditions,
    expression: conditionExpression(a.conditions, a.match),
  }
}

export { ENTRY_TURN_ID }

const DEFAULT_TRIGGER: ApplyOp = {
  t: 'trigger',
  triggerType: 'page_load',
  moment: 'custom_page',
  label: 'Custom page load',
  expression: '/account/cancel',
}
const DEFAULT_AUDIENCE: ApplyOp = {
  t: 'audience',
  name: 'All subscribers',
  ruleType: 'ALL_AUDIENCE',
  targetAll: true,
  savedAudienceId: null,
  conditions: [],
  expression: 'Everyone who reaches the cancel button',
}
const DEFAULT_SPLIT: ApplyOp = { t: 'split', treatment: 90, holdout: 10 }

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const entry: AssistantTurn = {
  id: ENTRY_TURN_ID,
  phase: 'entry',
  message:
    "Hi — I'll help you publish a cancel experience. Most merchants finish in under two minutes. How would you like to start?",
  options: [
    { id: 'guide', label: 'Guide me — recommend a flow', variant: 'primary', recommended: true, next: 'A_goal' },
    { id: 'template', label: 'Start from a template', apply: [{ t: 'openTemplates' }], advance: false },
    { id: 'power', label: 'Power setup — I know what I want', next: 'C_intent' },
    {
      id: 'quick',
      label: 'Use the recommended default',
      variant: 'ghost',
      apply: [{ t: 'blueprint', id: 'balanced' }, DEFAULT_TRIGGER, DEFAULT_AUDIENCE, DEFAULT_SPLIT],
      confirmReplace: true,
      next: 'PLAN',
    },
  ],
}

// ---------------------------------------------------------------------------
// Pathway A — Guide me
// ---------------------------------------------------------------------------

const A: AssistantTurn[] = [
  {
    id: 'A_goal',
    phase: 'consult',
    message: "What's the primary goal for this cancel experience?",
    options: [
      { id: 'clean', label: 'Respect the exit — minimize friction', setSignals: { goal: 'clean_exit' }, next: 'A_clean_survey' },
      { id: 'balanced', label: 'Balance saves with a fair exit', setSignals: { goal: 'balanced' }, next: 'A_balanced_comp' },
      { id: 'max', label: 'Maximize save rate', setSignals: { goal: 'max_save' }, next: 'A_aggr' },
      { id: 'unsure', label: "Not sure — ask me a few questions", variant: 'ghost', next: 'A_industry' },
    ],
  },
  {
    id: 'A_clean_survey',
    phase: 'consult',
    message: 'Got it — a clean, low-friction exit. Do you need to learn why people cancel?',
    options: [
      { id: 'no', label: 'No — just confirm and cancel', setSignals: { survey: 'none' }, next: 'A_rec' },
      { id: 'value', label: 'Just a value reminder, no survey', setSignals: { survey: 'low' }, next: 'A_rec' },
      { id: 'survey', label: 'Yes — a short reason survey', setSignals: { survey: 'high' }, next: 'A_rec' },
    ],
  },
  {
    id: 'A_balanced_comp',
    phase: 'consult',
    message: 'Balanced is a strong default. Any compliance constraints I should factor in?',
    options: [
      { id: 'standard', label: 'Standard — no special rules', setSignals: { compliance: 'standard' }, next: 'A_rec' },
      { id: 'strict', label: 'Strict — FTC click-to-cancel sensitivity', setSignals: { compliance: 'high' }, next: 'A_rec' },
      { id: 'more', label: 'Tell me more before deciding', variant: 'ghost', next: 'A_industry' },
    ],
  },
  {
    id: 'A_aggr',
    phase: 'consult',
    message: 'To maximize saves we can use multiple touchpoints. How aggressive is acceptable?',
    options: [
      { id: 'five', label: 'Standard save flow (5 steps)', setSignals: { saveAppetite: 'high' }, next: 'A_rec' },
      { id: 'six', label: 'Maximum allowed (6 steps, FTC cap)', setSignals: { saveAppetite: 'max' }, next: 'A_rec' },
      { id: 'less', label: 'That’s too much — show balanced', variant: 'ghost', setSignals: { goal: 'balanced', saveAppetite: 'moderate' }, next: 'A_rec' },
    ],
  },
  {
    id: 'A_industry',
    phase: 'consult',
    message: 'Let’s narrow it down. What best describes your business?',
    options: [
      { id: 'b2b', label: 'B2B SaaS / productivity', setSignals: { industry: 'b2b_saas' }, next: 'A_survey2' },
      { id: 'consumer', label: 'Consumer subscription', setSignals: { industry: 'consumer' }, next: 'A_survey2' },
      { id: 'regulated', label: 'Regulated (finance, health, telecom)', setSignals: { industry: 'regulated' }, next: 'A_survey2' },
      { id: 'marketplace', label: 'Marketplace / usage-based', setSignals: { industry: 'marketplace' }, next: 'A_survey2' },
    ],
  },
  {
    id: 'A_survey2',
    phase: 'consult',
    message: 'What do you most want to get out of cancellations?',
    options: [
      { id: 'compliance', label: 'Compliance-first — easy cancel is the priority', setSignals: { compliance: 'high' }, next: 'A_tone' },
      { id: 'reasons', label: 'Reason codes for the product roadmap', setSignals: { survey: 'high' }, next: 'A_tone' },
      { id: 'saves', label: 'Save offers / deflection', setSignals: { saveAppetite: 'high' }, next: 'A_tone' },
      { id: 'both', label: 'Insight and saves equally', setSignals: { goal: 'balanced' }, next: 'A_tone' },
    ],
  },
  {
    id: 'A_tone',
    phase: 'consult',
    message: 'Last one — how should this feel to subscribers?',
    options: [
      { id: 'direct', label: 'Direct and minimal', setSignals: { tone: 'direct' }, next: 'A_rec' },
      { id: 'friendly', label: 'Friendly-professional', setSignals: { tone: 'friendly' }, next: 'A_rec' },
      { id: 'formal', label: 'Formal / trust-first', setSignals: { tone: 'formal' }, next: 'A_rec' },
    ],
  },
  {
    id: 'A_rec',
    phase: 'recommend',
    onEnter: (ctx) => ({
      recommendedBlueprintId: ctx.recommendedBlueprintId ?? recommendBlueprint(ctx.signals),
    }),
    message: (ctx) =>
      recommendationMessage(ctx.recommendedBlueprintId ?? recommendBlueprint(ctx.signals), ctx.signals),
    options: (ctx) => {
      const id = ctx.recommendedBlueprintId ?? recommendBlueprint(ctx.signals)
      const opts: AssistantOption[] = [
        {
          id: 'apply',
          label: 'Apply this flow',
          variant: 'primary',
          recommended: true,
          apply: [{ t: 'blueprint', id }],
          confirmReplace: true,
          next: 'S_trigger',
        },
        { id: 'alts', label: 'See alternatives', next: 'A_alt' },
      ]
      if (blueprintMeta(id).stepCount > 1) opts.push({ id: 'fewer', label: 'Fewer steps', variant: 'ghost', adjust: 'down' })
      if (blueprintMeta(id).stepCount < 6) opts.push({ id: 'more', label: 'More save attempts', variant: 'ghost', adjust: 'up' })
      return opts
    },
  },
  {
    id: 'A_alt',
    phase: 'recommend',
    message: 'Here are two other fits — tap one to apply, or go back.',
    options: (ctx) => {
      const id = ctx.recommendedBlueprintId ?? recommendBlueprint(ctx.signals)
      const alts = Array.from(new Set([stepDown(id), stepUp(id)])).filter((a) => a !== id)
      const opts: AssistantOption[] = alts.map((alt) => ({
        id: `alt_${alt}`,
        label: stepSummaryLine(alt),
        apply: [{ t: 'blueprint', id: alt }],
        confirmReplace: true,
        next: 'S_trigger',
      }))
      opts.push({ id: 'back', label: 'Back to recommendation', variant: 'ghost', next: 'A_rec' })
      return opts
    },
  },
]

// ---------------------------------------------------------------------------
// Pathway B — Start from a template
// ---------------------------------------------------------------------------

const B: AssistantTurn[] = [
  {
    id: 'B_posture',
    phase: 'blueprint',
    message: 'Pick a starting posture — you can swap templates anytime.',
    options: [
      { id: 'clean', label: 'Clean exit', next: 'B_clean' },
      { id: 'balanced', label: 'Balanced', recommended: true, next: 'B_balanced' },
      { id: 'save', label: 'Save-focused', next: 'B_save' },
      { id: 'browse', label: 'Browse all templates', variant: 'ghost', apply: [{ t: 'openTemplates' }], advance: false },
    ],
  },
  {
    id: 'B_clean',
    phase: 'blueprint',
    message: 'Clean-exit templates — lowest friction, best for compliance-sensitive brands.',
    options: [
      { id: 'one', label: 'One step — click to cancel', pickBlueprint: 'click_to_cancel', next: 'B_confirm' },
      { id: 'two', label: 'Two steps — value reminder → confirm', pickBlueprint: 'clean_exit_1', next: 'B_confirm' },
      { id: 'three', label: 'Three steps — value → survey → confirm', pickBlueprint: 'clean_exit_2', next: 'B_confirm' },
    ],
  },
  {
    id: 'B_balanced',
    phase: 'blueprint',
    message: 'Balanced — one reason-linked save, then confirmation. Our default recommendation.',
    options: [
      { id: 'four', label: 'Four-step balanced flow', recommended: true, pickBlueprint: 'balanced', next: 'B_confirm' },
    ],
  },
  {
    id: 'B_save',
    phase: 'blueprint',
    message: 'Save-focused — multiple offers and routing.',
    options: [
      { id: 'five', label: 'Five-step save flow', pickBlueprint: 'save_aggressive', next: 'B_confirm' },
      { id: 'six', label: 'Six-step maximum (FTC cap)', pickBlueprint: 'custom_6', next: 'B_confirm' },
    ],
  },
  {
    id: 'B_confirm',
    phase: 'blueprint',
    message: (ctx) => {
      const id = ctx.recommendedBlueprintId ?? 'balanced'
      const meta = blueprintMeta(id)
      return `${meta.name} — ${meta.description}\n\nI'll also set the usual defaults: cancel-button trigger, all subscribers, 90/10 split.`
    },
    options: (ctx) => {
      const id = ctx.recommendedBlueprintId ?? 'balanced'
      return [
        {
          id: 'apply_defaults',
          label: 'Apply template + defaults',
          variant: 'primary',
          recommended: true,
          apply: [{ t: 'blueprint', id }, DEFAULT_TRIGGER, DEFAULT_AUDIENCE, DEFAULT_SPLIT],
          confirmReplace: true,
          next: 'PLAN',
        },
        {
          id: 'apply_only',
          label: 'Apply template only',
          apply: [{ t: 'blueprint', id }, { t: 'focus', node: 'flow' }],
          confirmReplace: true,
          next: 'B_orch',
        },
        { id: 'different', label: 'Pick a different template', variant: 'ghost', next: 'B_posture' },
      ]
    },
  },
  {
    id: 'B_orch',
    phase: 'review',
    message: 'Template applied. Want to adjust routing?',
    options: [
      { id: 'done', label: 'Looks good — review the plan', variant: 'primary', next: 'PLAN' },
      { id: 'trigger', label: 'Change trigger', next: 'S_trigger' },
      { id: 'audience', label: 'Change audience', next: 'S_audience' },
      { id: 'split', label: 'Change split', next: 'S_split' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Pathway C — Power setup
// ---------------------------------------------------------------------------

const C: AssistantTurn[] = [
  {
    id: 'C_intent',
    phase: 'blueprint',
    message: 'Power setup — what are you building?',
    options: [
      { id: 'assemble', label: 'Assemble step count & posture', next: 'C_bp' },
      { id: 'split', label: 'Configure traffic split & holdout', next: 'C_split' },
      { id: 'ab', label: 'Set up an A/B test (two experiences)', next: 'C_ab' },
      { id: 'jump', label: 'Jump to a canvas node', variant: 'ghost', next: 'C_jump' },
    ],
  },
  {
    id: 'C_bp',
    phase: 'blueprint',
    message: 'Choose the base step count (confirmation + outcome are always included).',
    options: [
      { id: 'b1', label: '1 step', apply: [{ t: 'blueprint', id: 'click_to_cancel' }], confirmReplace: true, next: 'C_shell' },
      { id: 'b2', label: '2 steps', apply: [{ t: 'blueprint', id: 'clean_exit_1' }], confirmReplace: true, next: 'C_shell' },
      { id: 'b3', label: '3 steps', apply: [{ t: 'blueprint', id: 'clean_exit_2' }], confirmReplace: true, next: 'C_shell' },
      { id: 'b4', label: '4 steps', apply: [{ t: 'blueprint', id: 'balanced' }], confirmReplace: true, next: 'C_shell' },
      { id: 'b5', label: '5 steps', apply: [{ t: 'blueprint', id: 'save_aggressive' }], confirmReplace: true, next: 'C_shell' },
      { id: 'b6', label: '6 steps (max)', apply: [{ t: 'blueprint', id: 'custom_6' }], confirmReplace: true, next: 'C_shell' },
    ],
  },
  {
    id: 'C_shell',
    phase: 'blueprint',
    message: 'How should the experience render?',
    options: [
      { id: 'modal', label: 'Modal overlay', recommended: true, apply: [{ t: 'shell', shell: 'modal' }], next: 'C_orch' },
      { id: 'fullpage', label: 'Full page', apply: [{ t: 'shell', shell: 'fullpage' }], next: 'C_orch' },
      { id: 'scroll', label: 'Full-page scroll', apply: [{ t: 'shell', shell: 'fullpage_scroll' }], next: 'C_orch' },
    ],
  },
  {
    id: 'C_split',
    phase: 'split',
    message: 'Set treatment vs holdout.',
    options: [
      { id: 's90', label: '90 / 10', recommended: true, apply: [{ t: 'split', treatment: 90, holdout: 10 }], next: 'C_bp' },
      { id: 's50', label: '50 / 50', apply: [{ t: 'split', treatment: 50, holdout: 50 }], next: 'C_bp' },
      { id: 's100', label: '100% treatment (no holdout)', apply: [{ t: 'split', treatment: 100, holdout: 0 }], next: 'C_bp' },
    ],
  },
  {
    id: 'C_ab',
    phase: 'split',
    message: 'A/B mode duplicates the current experience onto a second treatment branch.',
    options: [
      { id: 'ab_hold', label: 'Duplicate → 45/45/10 vs holdout', variant: 'primary', apply: [{ t: 'abTest', holdout: 10 }], next: 'PLAN' },
      { id: 'ab_5050', label: 'Duplicate → 50/50 A vs B', apply: [{ t: 'abTest', holdout: 0 }], next: 'PLAN' },
      { id: 'ab_no', label: 'Not yet — single treatment', variant: 'ghost', next: 'C_bp' },
    ],
  },
  {
    id: 'C_jump',
    phase: 'blueprint',
    message: 'Jump to:',
    options: [
      { id: 'j_trigger', label: 'Trigger', apply: [{ t: 'focus', node: 'trigger' }], advance: false },
      { id: 'j_audience', label: 'Audience', apply: [{ t: 'focus', node: 'audience' }], advance: false },
      { id: 'j_split', label: 'Traffic split', apply: [{ t: 'focus', node: 'split' }], advance: false },
      { id: 'j_flow', label: 'Save flow', apply: [{ t: 'focus', node: 'flow' }], advance: false },
      { id: 'j_holdout', label: 'Holdout', apply: [{ t: 'focus', node: 'holdout' }], advance: false },
      { id: 'j_templates', label: 'Template library', variant: 'ghost', apply: [{ t: 'openTemplates' }], advance: false },
      { id: 'j_continue', label: 'Continue power setup', variant: 'ghost', next: 'C_intent' },
    ],
  },
  {
    id: 'C_orch',
    phase: 'review',
    message: 'Defaults OK? I can set a cancel-button trigger and all-subscriber audience.',
    options: [
      { id: 'apply', label: 'Apply defaults', variant: 'primary', apply: [DEFAULT_TRIGGER, DEFAULT_AUDIENCE], next: 'PLAN' },
      { id: 'trigger', label: 'Configure trigger', next: 'S_trigger' },
      { id: 'audience', label: 'Configure audience', next: 'S_audience' },
      { id: 'skip', label: 'Skip', variant: 'ghost', next: 'PLAN' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Shared orchestration turns (reused by A, B, C)
// ---------------------------------------------------------------------------

const SHARED: AssistantTurn[] = [
  {
    id: 'S_trigger',
    phase: 'trigger',
    message: 'When should subscribers enter this cancel experience?',
    options: [
      { id: 'page', label: 'On the cancel page', variant: 'primary', recommended: true, apply: [DEFAULT_TRIGGER], next: 'S_audience' },
      { id: 'any', label: 'On any page load', apply: [{ t: 'trigger', triggerType: 'page_load', moment: 'any_page', label: 'Any page load' }], next: 'S_audience' },
      { id: 'skip', label: 'Skip for now', variant: 'ghost', next: 'S_audience' },
    ],
  },
  {
    id: 'S_audience',
    phase: 'audience',
    message: 'Who should see this experience?',
    options: [
      { id: 'all', label: 'All subscribers', variant: 'primary', recommended: true, apply: [DEFAULT_AUDIENCE], next: 'S_split' },
      { id: 'paying', label: 'Paying subscribers only', apply: [savedAudienceOp('all_paying')], next: 'S_split' },
      { id: 'highvalue', label: 'High-value subscribers', apply: [savedAudienceOp('high_value')], next: 'S_split' },
      { id: 'skip', label: 'Skip for now', variant: 'ghost', next: 'S_split' },
    ],
  },
  {
    id: 'S_split',
    phase: 'split',
    message: 'How much traffic hits your new flow vs. a holdout control? A holdout lets you measure lift.',
    options: [
      { id: 's90', label: '90% treatment / 10% holdout', variant: 'primary', recommended: true, apply: [{ t: 'split', treatment: 90, holdout: 10 }], next: 'PLAN' },
      { id: 's80', label: '80 / 20 — stronger measurement', apply: [{ t: 'split', treatment: 80, holdout: 20 }], next: 'PLAN' },
      { id: 's100', label: '100% treatment — no holdout yet', apply: [{ t: 'split', treatment: 100, holdout: 0 }], next: 'PLAN' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Conversational pathway — one gap per turn, then a plan card
// ---------------------------------------------------------------------------

/**
 * A single dynamic turn that asks about whatever is still missing. `onEnter`
 * records the gap on the intent so it is never asked twice, and each option's
 * `resolveNext` sends the merchant either back here or on to the plan card.
 */
const gapTurn: AssistantTurn = {
  id: GAP_TURN_ID,
  phase: 'consult',
  onEnter: (ctx) => {
    const gap = nextGap(ctx.intent)
    if (!gap) return { currentGap: null }
    return { currentGap: gap, intent: { ...ctx.intent, asked: [...ctx.intent.asked, gap] } }
  },
  message: (ctx) => (ctx.currentGap ? questionFor(ctx.currentGap, ctx.intent).message : 'Let me draft that.'),
  options: (ctx) => (ctx.currentGap ? questionFor(ctx.currentGap, ctx.intent).options : []),
}

/**
 * The agent declines an ask it cannot honour, explains why, and offers the
 * nearest buildable alternative (PRD sample D).
 */
const pushbackTurn: AssistantTurn = {
  id: PUSHBACK_TURN_ID,
  phase: 'consult',
  message: (ctx) => {
    const p = ctx.pushback
    if (!p) return 'Let me draft that.'
    return `I can't build ${p.requested}.\n\n${p.reason}\n\n${p.counter}`
  },
  options: (ctx) => [
    {
      id: 'pb_accept',
      label: ctx.pushback?.accept ?? 'Draft the plan',
      variant: 'primary',
      recommended: true,
      setIntent: ctx.pushback?.patch,
      resolveNext: (next) => (nextGap(next.intent) ? GAP_TURN_ID : PLAN_CARD_TURN_ID),
    },
    {
      id: 'pb_rethink',
      label: 'Let me describe it differently',
      variant: 'ghost',
      setIntent: { stepCount: null },
      next: ctx.intent.prompt ? GAP_TURN_ID : ENTRY_TURN_ID,
    },
  ],
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TURNS: Record<string, AssistantTurn> = Object.fromEntries(
  [entry, gapTurn, pushbackTurn, ...A, ...B, ...C, ...SHARED].map((t) => [t.id, t]),
)

/** Infer which pathway a turn belongs to from its id prefix. */
export function pathwayOf(turnId: string): 'guide_me' | 'from_template' | 'power_setup' | null {
  if (turnId.startsWith('A_')) return 'guide_me'
  if (turnId.startsWith('B_')) return 'from_template'
  if (turnId.startsWith('C_')) return 'power_setup'
  return null
}
