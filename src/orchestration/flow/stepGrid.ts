import { buildStepColumns, type StepColumn } from '../../lib/stepColumns'
import { tabLabel } from '../../lib/stepLabels'
import type { Step } from '../../types/experience'
import {
  ENCLOSURE_PAD,
  STEP_GAP_X,
  STEP_GAP_Y,
  STEP_H,
  STEP_W,
} from './canvasTokens'

export interface StepSlot {
  step: Step
  /** Position within the enclosure, in world units. */
  x: number
  y: number
  /** Column index in the subscriber's path, left to right. */
  col: number
  /** Row within the column. Only offer variants ever stack. */
  row: number
  /** How many interchangeable variants share this column. */
  rows: number
  /** Every step in this column, in order — the moves available within a stack. */
  siblings: string[]
  /** Neighbours in the path, for wiring and for reordering. */
  prevCol: StepColumn | null
  nextCol: StepColumn | null
}

/**
 * A place a step can be inserted: the channel before a column.
 *
 * Every gap is one, rather than the single slot before the closing steps that
 * used to be the only way in — which is why adding a loss-aversion card
 * *before* the survey meant adding it at the end and dragging it back.
 */
export interface StepGap {
  /** Centre of the channel, in enclosure-local world units. */
  x: number
  y: number
  /** The step the new one goes in front of. */
  beforeStepId: string
  /** For the label: what it would sit before. */
  beforeLabel: string
  /** The gap in front of the closing steps — there is only ever one. */
  tail: boolean
}

export interface EnclosureGrid {
  /** Enclosure size in world units — a pure function of the step structure. */
  w: number
  h: number
  slots: StepSlot[]
  columns: StepColumn[]
  gaps: StepGap[]
}

/** Confirmation and outcome are locked to the end of the flow. */
export function isTailStep(step: Step): boolean {
  return step.components.some((c) => c.kind === 'confirmation' || c.kind === 'outcome')
}

/**
 * Where every step sits inside its enclosure, and how big that makes the
 * enclosure.
 *
 * Every card is exactly `STEP_W` x `STEP_H`, so this is arithmetic on the step
 * structure alone — no zoom, no device, no measurement, no estimate. What the
 * graph reserves is therefore precisely what the renderer draws, which is the
 * property the whole layout contract rests on.
 */
export function enclosureGrid(steps: Step[]): EnclosureGrid {
  const columns = buildStepColumns(steps)
  if (columns.length === 0) {
    return {
      w: STEP_W + ENCLOSURE_PAD * 2,
      h: STEP_H + ENCLOSURE_PAD * 2,
      slots: [],
      columns: [],
      gaps: [],
    }
  }

  const slots: StepSlot[] = []
  const gaps: StepGap[] = []
  let x = ENCLOSURE_PAD

  const place = (col: StepColumn, index: number) => {
    const siblings = col.steps.map(({ step }) => step.id)
    col.steps.forEach(({ step }, row) => {
      slots.push({
        step,
        x,
        y: ENCLOSURE_PAD + row * (STEP_H + STEP_GAP_Y),
        col: index,
        row,
        rows: col.steps.length,
        siblings,
        prevCol: columns[index - 1] ?? null,
        nextCol: columns[index + 1] ?? null,
      })
    })
    x += STEP_W + STEP_GAP_X
  }

  columns.forEach((col, index) => {
    // The channel in front of this column. Nothing is reserved for it: the
    // affordance is screen-space chrome living in the gap the wires already
    // cross, so the enclosure is exactly as wide as its cards make it.
    const lead = col.steps[0]?.step
    // One gap in front of the closing steps, not one in front of each: nothing
    // can be inserted between the confirmation and the outcomes it leads to.
    const insertable = lead && !(isTailStep(lead) && gaps.some((g) => g.tail))
    if (lead && insertable) {
      gaps.push({
        tail: isTailStep(lead),
        x: x - STEP_GAP_X / 2,
        y: ENCLOSURE_PAD + GAP_Y,
        beforeStepId: lead.id,
        // The short name: a survey's own name is the question it asks, and
        // "Insert before Help us improve — why are you cancelling?" is a
        // paragraph where a label belongs.
        beforeLabel: isTailStep(lead) ? 'the closing steps' : tabLabel(lead),
      })
    }
    place(col, index)
  })

  const deepest = columns.reduce((n, c) => Math.max(n, c.steps.length), 1)

  return {
    w: Math.max(STEP_W, x - STEP_GAP_X) + ENCLOSURE_PAD,
    h: ENCLOSURE_PAD * 2 + deepest * STEP_H + (deepest - 1) * STEP_GAP_Y,
    slots,
    columns,
    gaps,
  }
}

/**
 * Where in the channel the add affordance sits: near the top of the first row,
 * clear of the event chips, which hang off the port rows lower down.
 */
const GAP_Y = 24
