import type { Step } from '../../../types/experience'
import { compactStepLabel, stepLabel } from '../../../lib/stepLabels'
import { clamp } from '../canvasTokens'
import { ACCENTS, leadComponent, terminalOf } from './stepFacts'
import { StepIcon } from './stepIcons'

/**
 * Width of one character at font-size 1, for a semibold label. Measured off the
 * longest name this tier ever shows rather than guessed, and rounded up: it is
 * used to *avoid* an ellipsis, so erring wide is erring safe.
 */
const CHAR_W = 0.6
const MAX_FONT = 10.5
/** Below this the name is a grey smear; nothing this tier shows needs to go there. */
const MIN_FONT = 8.5
const PAD_X = 4

/**
 * T0 — the map. A card this small on screen cannot carry copy, so it carries
 * identity: the kind's glyph and its shortest name. Reading the shape of the
 * flow is the only thing this tier is for.
 *
 * Stacked rather than in a row, and fitted rather than truncated. The card is
 * 52px wide on screen at the minimum zoom — a row of icon *and* name in there
 * leaves the name about twenty pixels, which is an ellipsis, and widening the
 * card to fit would mean a card whose size depends on its label. So the two
 * pieces take a line each, and the name takes whatever type size clears the
 * width it has. "Discount" at 20% is the tightest case this has to hold.
 */
export function StepPill({ step, w, selected }: { step: Step; w: number; selected: boolean }) {
  const lead = leadComponent(step)
  const accent = lead ? ACCENTS[lead.kind] : '#94a3b8'
  const label = compactStepLabel(step)
  const fontSize = clamp((w - PAD_X * 2) / (label.length * CHAR_W), MIN_FONT, MAX_FONT)

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-[3px] rounded-lg border ${
        terminalOf(step) ? 'bg-slate-50' : 'bg-white'
      } ${selected ? 'border-indigo-500' : 'border-slate-300'}`}
      style={{ paddingLeft: PAD_X, paddingRight: PAD_X }}
      title={stepLabel(step)}
    >
      <span style={{ color: accent }}>
        <StepIcon step={step} size={Math.round(fontSize * 1.3)} />
      </span>
      <span
        className="whitespace-nowrap font-semibold leading-none text-slate-700"
        style={{ fontSize }}
      >
        {label}
      </span>
    </div>
  )
}
