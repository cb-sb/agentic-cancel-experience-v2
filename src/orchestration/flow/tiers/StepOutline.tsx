import type { ReactNode } from 'react'
import type { ExperienceComponent, Step } from '../../../types/experience'
import { compactStepLabel, stepLabel } from '../../../lib/stepLabels'
import { ACCENTS, leadComponent, terminalOf } from './stepFacts'
import { StepIcon } from './stepIcons'

/** The kind glyph beside the name, and the space it takes from it. */
const ICON = 11
const ICON_GAP = 4

/**
 * Wireframe rhythm, in screen pixels. Two bar weights — a heading and a line of
 * copy — one action height and one gap, so every silhouette is built from the
 * same handful of parts instead of per-card guesses.
 */
const LEAD_H = 5
const TEXT_H = 4
const ACTION_H = 9
const GAP = 4

/** A heading plus one line of copy: the block a step's title renders as. */
const COPY_H = LEAD_H + GAP + TEXT_H
/** Below this a component silhouette is a smudge rather than a shape. */
const MIN_SHAPE_H = 10
/** Three stacked lines — enough shape to tell a survey from an offer. */
const READABLE_SHAPE_H = 3 * LEAD_H + 2 * GAP
/** The card's 1px border, top and bottom. */
const BORDER_H = 2
/** The name row: `pt-1.5` + `pb-1` + one line of an 11px font at leading-tight. */
const TITLE_H = 6 + 4 + 13.5

/**
 * Bar widths as a coarse scale. Lengths picked off a scale read as a set; free
 * percentages read as noise, which is what makes a wireframe look accidental.
 */
const W = {
  full: '100%',
  wide: '88%',
  mid: '72%',
  half: '56%',
  narrow: '40%',
  tight: '26%',
} as const

interface BarSpec {
  w: string
  h: number
  tone?: keyof typeof TONES
}

/** Survey options, cycled so they read as copy of varying length, not a grid. */
const OPTION_BARS: BarSpec[] = [W.wide, W.mid, W.full, W.half, W.mid].map((w) => ({ w, h: LEAD_H }))

const OFFER_BARS: BarSpec[] = [
  { w: W.mid, h: LEAD_H, tone: 'base' },
  { w: W.full, h: TEXT_H },
  { w: W.wide, h: TEXT_H },
]

const PLAIN_BARS: BarSpec[] = [
  { w: W.mid, h: TEXT_H },
  { w: W.half, h: TEXT_H },
]

/**
 * The leading bars that fit in `h`, stacked with `GAP` between them. Rendering a
 * short list beats letting the tail overflow: the box clips, so an unfitted bar
 * is drawn sliced in half against its bottom edge.
 */
function fitBars(bars: BarSpec[], h: number): BarSpec[] {
  const out: BarSpec[] = []
  let used = 0
  for (const bar of bars) {
    const next = out.length === 0 ? bar.h : used + GAP + bar.h
    if (next > h) break
    out.push(bar)
    used = next
  }
  return out
}

/**
 * T1 — the outline. Real copy is illegible at this size, so the card shows its
 * name and the *shape* of what it holds: enough to read the flow's structure
 * without pretending to render six screens.
 *
 * `w` and `h` are screen pixels — the box is authored at the size it is actually
 * seen at — so every piece is either rendered at a legible size or dropped. What
 * it never does is shrink type or let a bar spill past the bottom edge.
 */
export function StepOutline({
  step,
  w,
  h,
  selected,
}: {
  step: Step
  w: number
  h: number
  selected: boolean
}) {
  const label = stepLabel(step)
  // Padding costs width the name needs, so it is the first thing to give up;
  // below what even a tight name needs, the short form beats an ellipsis. The
  // glyph is charged for here too — it is beside the name, so it is width the
  // name does not have.
  const lead = leadComponent(step)
  const accent = lead ? ACCENTS[lead.kind] : '#94a3b8'
  const tight = w < 132
  const room = w - (tight ? 12 : 20) - (ICON + ICON_GAP)
  const text = label.length * (tight ? 6.1 : 6.4) <= room ? label : compactStepLabel(step)
  const avail = h - BORDER_H - TITLE_H - (tight ? 6 : 8)

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-xl border ${
        terminalOf(step) ? 'bg-slate-50' : 'bg-white'
      } ${selected ? 'border-indigo-500' : terminalOf(step) ? 'border-slate-300' : 'border-slate-200'}`}
    >
      <div
        className={`flex flex-none items-center pb-1 pt-1.5 font-semibold leading-tight ${
          tight ? 'px-1.5 text-[10.5px]' : 'px-2.5 text-[11px]'
        } ${selected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}
        style={{ gap: ICON_GAP }}
        title={label}
      >
        <span style={{ color: accent }}>
          <StepIcon step={step} size={ICON} />
        </span>
        <span className="min-w-0 truncate">{text}</span>
      </div>
      <Body step={step} avail={avail} selected={selected} tight={tight} />
    </div>
  )
}

/**
 * Copy above, actions pinned below — the silhouette of a real screen, which is
 * what makes a card read as a card rather than a swatch.
 *
 * Each piece is rendered only if it fits: copy goes first, then the actions, and
 * the component silhouette is given the remainder to fit itself into.
 */
function Body({
  step,
  avail,
  selected,
  tight,
}: {
  step: Step
  avail: number
  selected: boolean
  tight: boolean
}) {
  const actions = avail >= MIN_SHAPE_H + GAP + ACTION_H
  // Copy is generic — every card has some. The silhouette is what tells one card
  // from another, so copy is only worth its height once the shape keeps enough
  // to still read as itself.
  const copy =
    hasTitleBlock(step) &&
    avail - (COPY_H + GAP) - (actions ? GAP + ACTION_H : 0) >= READABLE_SHAPE_H
  const shapeH = avail - (copy ? COPY_H + GAP : 0) - (actions ? GAP + ACTION_H : 0)

  /**
   * A step can hold two components, and each silhouette has to be given its
   * share of what is left rather than all of it: handing both the full height
   * is how the second one ended up drawn through the bottom edge of the card.
   * When there is not enough for a share each, the lead one takes the room and
   * the outline says one thing well instead of two badly.
   */
  const fits = (n: number) => (shapeH - GAP * (n - 1)) / n >= MIN_SHAPE_H
  const count = shapeH < LEAD_H ? 0 : fits(step.components.length) ? step.components.length : 1
  const shown = step.components.slice(0, count)
  const each = count > 1 ? (shapeH - GAP * (count - 1)) / count : shapeH

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col gap-1 overflow-hidden ${
        tight ? 'px-1.5 pb-1.5' : 'px-2.5 pb-2'
      }`}
    >
      {copy && (
        <>
          <Bar w={W.half} h={LEAD_H} tone="base" />
          <Bar w={W.wide} h={TEXT_H} />
        </>
      )}
      {shown.map((c) => (
        <ComponentSkeleton key={c.id} component={c} maxH={each} />
      ))}
      {actions && (
        <div className="mt-auto flex flex-none gap-1.5">
          <Bar w={W.narrow} h={ACTION_H} tone={selected ? 'accent' : 'base'} />
          {twoActions(step) && <Bar w={W.tight} h={ACTION_H} />}
        </div>
      )}
    </div>
  )
}

/**
 * Mirrors `CanvasStep`'s `hideTitleBlock`: offer, confirmation and outcome steps
 * carry their copy inside the component itself, so their wireframes should not
 * imply a title block above it.
 */
function hasTitleBlock(step: Step): boolean {
  const kinds = step.components.map((c) => c.kind)
  if (kinds.length === 0) return true
  if (kinds.every((k) => k === 'offer')) return false
  return !kinds.some((k) => k === 'confirmation' || k === 'outcome')
}

/** Confirmation asks twice — keep or cancel. Every other step has one CTA. */
const twoActions = (step: Step) => step.components.some((c) => c.kind === 'confirmation')

function ComponentSkeleton({ component, maxH }: { component: ExperienceComponent; maxH: number }) {
  switch (component.kind) {
    case 'survey':
      return (
        <Stack>
          {fitBars(OPTION_BARS.slice(0, component.options.length), maxH).map((bar, i) => (
            <div key={i} className="flex flex-none items-center gap-1.5">
              <span
                className="flex-none rounded-full bg-slate-300"
                style={{ width: LEAD_H, height: LEAD_H }}
              />
              {/* Widths are a share of the room left beside the dot, not of the row. */}
              <span className="flex min-w-0 flex-1">
                <Bar {...bar} />
              </span>
            </div>
          ))}
        </Stack>
      )
    case 'offer':
      return (
        <div className="flex min-h-0 flex-1 items-stretch gap-2 overflow-hidden">
          <Block className="w-1/3 flex-none" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {fitBars(OFFER_BARS, maxH).map((bar, i) => (
              <Bar key={i} {...bar} />
            ))}
          </div>
        </div>
      )
    case 'loss_aversion':
      return (
        <Stack>
          <Block className="flex-1" />
          {maxH >= MIN_SHAPE_H + GAP + TEXT_H && <Bar w={W.wide} h={TEXT_H} />}
        </Stack>
      )
    case 'pricing_table':
      return (
        <div className="flex min-h-0 flex-1 items-stretch gap-1.5 overflow-hidden">
          {component.plans.slice(0, 3).map((p) => (
            <Block key={p.id} className="flex-1" />
          ))}
        </div>
      )
    default:
      return (
        <Stack>
          {fitBars(PLAIN_BARS, maxH).map((bar, i) => (
            <Bar key={i} {...bar} />
          ))}
        </Stack>
      )
  }
}

function Stack({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">{children}</div>
}

const TONES = {
  base: 'bg-slate-300',
  light: 'bg-slate-200',
  accent: 'bg-indigo-500',
}

/** A line of copy or an action, depending on its height. */
function Bar({ w, h, tone = 'light' }: BarSpec) {
  return <div className={`flex-none rounded-full ${TONES[tone]}`} style={{ width: w, height: h }} />
}

/** A filled area — media, or a plan column. */
function Block({ className }: { className: string }) {
  return <span className={`min-h-[10px] rounded-md bg-slate-100 ${className}`} />
}
