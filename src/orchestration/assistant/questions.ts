/**
 * One question per gap, as chip answer cards (PRD §8).
 *
 * Every option carries a data-backed hint drawn from the merchant's own numbers
 * — segment cancel volume and ARPU, or the posture benchmark bands — and the
 * default option is badged as suggested. Picking an option patches the intent;
 * it never mutates a store.
 */

import { POSTURE_BENCHMARKS, featuredSegments, rankedReasons, segment } from '../../lib/growthContext'
import { count, money, pctRange } from '../../lib/num'
import { GAP_TURN_ID, PLAN_CARD_TURN_ID } from './ids'
import { nextGap, type Gap, type Intensity, type Outcome, type PlayIntent, type Workflow } from './intent'
import type { AssistantOption } from './types'

export interface GapQuestion {
  message: string
  options: AssistantOption[]
}

/** After an answer: ask the next gap, or draft. */
const CONTINUE = (ctx: { intent: PlayIntent }): string =>
  nextGap(ctx.intent) ? GAP_TURN_ID : PLAN_CARD_TURN_ID

function chip(o: Omit<AssistantOption, 'resolveNext'>): AssistantOption {
  return { ...o, resolveNext: CONTINUE }
}

// ---------------------------------------------------------------------------
// Outcome — "what does success look like?"
// ---------------------------------------------------------------------------

/** The outcome chip also fixes the posture, since the two are one decision. */
const OUTCOME_CHOICES: { id: string; label: string; outcome: Outcome; intensity: Intensity }[] = [
  { id: 'revenue_balanced', label: 'Retain revenue where it is cheap to do so', outcome: 'revenue', intensity: 'balanced' },
  { id: 'revenue_max', label: 'Push hard on save rate', outcome: 'revenue', intensity: 'save_aggressive' },
  { id: 'insight', label: 'Learn why people leave', outcome: 'insight', intensity: 'clean_exit' },
  { id: 'compliance', label: 'Keep the exit clean and compliant', outcome: 'compliance', intensity: 'clean_exit' },
]

function outcomeQuestion(): GapQuestion {
  return {
    message: 'What does a good outcome look like for this flow?',
    options: OUTCOME_CHOICES.map((c) => {
      const bench = POSTURE_BENCHMARKS[c.intensity]
      return chip({
        id: c.id,
        label: c.label,
        hint: `${pctRange(bench.save)} save · ${pctRange(bench.cost)} margin cost`,
        recommended: c.id === 'revenue_balanced',
        variant: c.id === 'revenue_balanced' ? 'primary' : 'secondary',
        setIntent: { outcome: c.outcome, intensity: c.intensity },
      })
    }),
  }
}

// ---------------------------------------------------------------------------
// Workflow — "which play is this?"
// ---------------------------------------------------------------------------

const WORKFLOW_CHOICES: { id: string; label: string; workflow: Workflow; available: boolean }[] = [
  { id: 'wf_cancel', label: 'Cancel deflection', workflow: 'cancel', available: true },
  { id: 'wf_dunning', label: 'Dunning / failed payments', workflow: 'dunning', available: false },
  { id: 'wf_at_risk', label: 'Proactive at-risk outreach', workflow: 'at_risk', available: false },
  { id: 'wf_upsell', label: 'Upsell / expansion', workflow: 'upsell', available: false },
]

function workflowQuestion(intent: PlayIntent): GapQuestion {
  const seg = segment(intent.segmentId ?? 'all')
  return {
    message: 'Which workflow is this? Cancel experiences are the only kind I can build here today.',
    options: WORKFLOW_CHOICES.map((c) =>
      chip({
        id: c.id,
        label: c.label,
        hint: c.available
          ? `${count(seg.cancelsPerMonth)} cancels/mo reach this surface today`
          : 'Not buildable here yet — I would draft the cancel flow and flag it',
        recommended: c.available,
        variant: c.available ? 'primary' : 'secondary',
        setIntent: { workflow: c.workflow },
      }),
    ),
  }
}

// ---------------------------------------------------------------------------
// Segment — "who should see it?"
// ---------------------------------------------------------------------------

function segmentQuestion(): GapQuestion {
  const segments = featuredSegments().sort((a, b) => b.cancelsPerMonth - a.cancelsPerMonth)
  const top = segments[0]
  return {
    message: 'Who should see it? Here is where your cancels actually come from.',
    options: segments.map((s) => {
      const lead = rankedReasons(s.id)[0]
      return chip({
        id: `seg_${s.id}`,
        label: s.name,
        hint: `${count(s.cancelsPerMonth)} cancels/mo · ${money(s.arpu)} ARPU · mostly "${
          lead ? lead.code.replace(/_/g, ' ') : 'mixed'
        }"`,
        recommended: s.id === top.id,
        variant: s.id === top.id ? 'primary' : 'secondary',
        setIntent: { segmentId: s.id },
      })
    }),
  }
}

// ---------------------------------------------------------------------------
// Intensity — "how hard should it push?"
// ---------------------------------------------------------------------------

const INTENSITY_STEPS: Record<Intensity, string> = {
  clean_exit: '3 steps, no offers',
  balanced: '4 steps, one offer per reason',
  save_aggressive: '5 steps, entry offer plus reason routing',
}

function intensityQuestion(): GapQuestion {
  const order: Intensity[] = ['clean_exit', 'balanced', 'save_aggressive']
  return {
    message: 'How hard should it push before letting someone go?',
    options: order.map((i) => {
      const bench = POSTURE_BENCHMARKS[i]
      return chip({
        id: `int_${i}`,
        label: bench.label,
        hint: `${INTENSITY_STEPS[i]} · ${pctRange(bench.save)} save · ${pctRange(bench.cost)} margin cost`,
        recommended: i === 'balanced',
        variant: i === 'balanced' ? 'primary' : 'secondary',
        setIntent: { intensity: i },
      })
    }),
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function questionFor(gap: Gap, intent: PlayIntent): GapQuestion {
  switch (gap) {
    case 'outcome':
      return outcomeQuestion()
    case 'workflow':
      return workflowQuestion(intent)
    case 'segment':
      return segmentQuestion()
    case 'intensity':
      return intensityQuestion()
  }
}
