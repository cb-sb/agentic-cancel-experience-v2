import type { Experience, ExperienceComponent, Step } from '../../../types/experience'
import { colorForOfferFactory, offerNameFactory } from '../../../lib/mapping'
import { HEADER_H, PORT_PITCH } from '../canvasTokens'
import { useSetHotPort } from '../linkHover'
import { portRows, type PortRow } from '../ports'
import {
  ACCENTS,
  TERMINAL_CAPTION,
  componentHeadline,
  headlineOf,
  kindLabel,
  leadComponent,
  modeLabel,
  subtextOf,
  terminalOf,
} from './stepFacts'
import { KindIcon, StepIcon } from './stepIcons'

/** Header pieces, in screen pixels — the budget the header is fitted against. */
const PAD_T = 7
const EYEBROW_H = 16
const HEAD_LINE_H = 16
const SUB_H = 18
/** One row of the contents list. */
const LIST_ROW_H = 17

/**
 * T2 and T3 — the working tiers.
 *
 * Both draw the same skeleton: an eyebrow saying what the card is, a headline
 * saying what it does, and a rhythm of rows down the lower half. The rows sit at
 * `PORT_TOP + i * PORT_PITCH` in world units, which is exactly where the node's
 * handles are, so a connector always lands on the row it belongs to however the
 * interior re-flows.
 *
 * T3 adds the two things a row of cards is compared on: a line of supporting
 * copy, and labels on the rows. T2 keeps the rows as bare markers, because below
 * ~214px on screen a label on a `PORT_PITCH` row cannot clear 11px type.
 */
export function StepDetail({
  step,
  experience,
  k,
  rich,
  selected,
}: {
  step: Step
  experience: Experience
  /** Interior pixels per world unit — where world offsets land in here. */
  k: number
  rich: boolean
  selected: boolean
}) {
  const lead = leadComponent(step)
  const accentOf = (c: ExperienceComponent) =>
    c.kind === 'offer' ? colorForOfferFactory(experience)(c.id) : ACCENTS[c.kind]
  const accent = lead ? accentOf(lead) : '#94a3b8'
  const headline = headlineOf(step)
  const subtext = subtextOf(step)
  const rows = portRows(step, experience)
  const terminal = terminalOf(step)
  const many = step.components.length > 1

  const pitch = PORT_PITCH * k
  const headerH = HEADER_H * k

  // What the header can carry, worked out rather than hoped for. The rows below
  // start at a fixed offset, so a header that overruns lands on top of them —
  // this is where the "fix one zoom, break the next" bugs used to come from.
  const room = headerH - PAD_T - EYEBROW_H
  const wantsSub = rich && Boolean(subtext)
  const headLines = room - 2 * HEAD_LINE_H >= (wantsSub ? SUB_H : 0) ? 2 : 1
  const showSub = wantsSub && room - headLines * HEAD_LINE_H >= SUB_H
  /**
   * A multi-component card still leads with the step's own headline where there
   * is room for it — the step is the thing the subscriber sees, and its title is
   * the question being asked. The contents list goes under it, and takes what is
   * left of the header rather than assuming there is room for all of it.
   */
  const listHead = many && rich && Boolean(headline)
  const listCap = Math.max(
    1,
    Math.floor((headerH - PAD_T - EYEBROW_H - (listHead ? HEAD_LINE_H : 0)) / LIST_ROW_H),
  )

  return (
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl border ${
        terminal ? 'bg-slate-50' : 'bg-white'
      } ${selected ? 'border-indigo-500' : terminal ? 'border-slate-300' : 'border-slate-200'}`}
    >
      <div
        className="absolute inset-x-0 top-0 flex flex-col gap-1 overflow-hidden px-2.5"
        style={{ height: headerH, paddingTop: PAD_T }}
      >
        <div className="flex flex-none items-center gap-1">
          {/* The kind's glyph, in the kind's colour — it used to be a bare dot,
              which carried the colour but said nothing on its own. */}
          <span className="flex-none" style={{ color: accent }}>
            <StepIcon step={step} size={11} />
          </span>
          <span
            className="flex-none truncate text-[10px] font-bold uppercase tracking-wider"
            style={{ color: accent }}
          >
            {many ? `${step.components.length} components` : lead ? kindLabel(lead) : 'Step'}
          </span>
          {!many && lead && modeLabel(lead) && (
            <span className="min-w-0 truncate text-[9.5px] font-semibold text-slate-400">
              {modeLabel(lead)}
            </span>
          )}
          {/* What sort of node this is, where it is not one the merchant
              sequenced: said on the card rather than left to the wires. */}
          {terminal && rich && (
            <span className="ml-auto flex-none rounded-full bg-white px-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 ring-1 ring-slate-200">
              {TERMINAL_CAPTION[terminal]}
            </span>
          )}
        </div>

        {many ? (
          // Every component it holds, in the order the subscriber meets them.
          // The step's own title is what the header used to show; with two
          // components that title described half the card.
          <div className="flex min-h-0 flex-col overflow-hidden">
            {listHead && (
              <div className="flex-none truncate text-[12px] font-bold leading-4 text-slate-900">
                {headline}
              </div>
            )}
            {step.components.slice(0, listCap).map((c) => (
              <div
                key={c.id}
                className="flex flex-none items-center gap-1.5"
                style={{ height: LIST_ROW_H }}
              >
                <span className="flex-none" style={{ color: accentOf(c) }}>
                  <KindIcon kind={c.kind} size={10} />
                </span>
                <span
                  className="flex-none text-[9.5px] font-bold uppercase tracking-wide"
                  style={{ color: accentOf(c) }}
                >
                  {kindLabel(c)}
                </span>
                {rich && (
                  <span className="min-w-0 flex-1 truncate text-[10.5px] font-medium text-slate-600">
                    {componentHeadline(c)}
                  </span>
                )}
              </div>
            ))}
            {step.components.length > listCap && (
              <span className="flex-none text-[9.5px] font-semibold text-slate-400">
                +{step.components.length - listCap} more
              </span>
            )}
          </div>
        ) : (
          <>
            {headline && (
              <div
                className="flex-none overflow-hidden text-[12.5px] font-bold leading-tight text-slate-900"
                style={{
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: headLines,
                }}
              >
                {headline}
              </div>
            )}
            {showSub && (
              <div className="line-clamp-1 flex-none text-[10.5px] leading-tight text-slate-500">
                {subtext}
              </div>
            )}
          </>
        )}
      </div>

      <div className="absolute inset-x-0" style={{ top: headerH }}>
        {rows.map((row) => (
          <Row key={row.id} row={row} height={pitch} labelled={rich} experience={experience} />
        ))}
      </div>

    </div>
  )
}

/**
 * The offers a row's reasons route to, in the order the row's wires leave it.
 * A bundled row can carry several, which is exactly what its one port hides.
 */
function destinations(row: PortRow): string[] {
  if (row.kind === 'reason') return row.linkedOfferId ? [row.linkedOfferId] : []
  if (row.kind === 'overflow') {
    const ids = (row.bundled ?? []).map((o) => o.linkedOfferId).filter(Boolean) as string[]
    return [...new Set(ids)]
  }
  return []
}

function Row({
  row,
  height,
  labelled,
  experience,
}: {
  row: PortRow
  height: number
  labelled: boolean
  experience: Experience
}) {
  const setHotPort = useSetHotPort()
  const colorFor = colorForOfferFactory(experience)
  const nameFor = offerNameFactory(experience)
  const dests = destinations(row)
  const color = dests.length ? colorFor(dests[0]) : '#cbd5e1'
  const port = row.kind === 'fact' ? null : row.id

  return (
    <div
      className="flex items-center gap-1.5 px-2.5"
      style={{ height }}
      onPointerEnter={port ? () => setHotPort(port) : undefined}
      onPointerLeave={port ? () => setHotPort(null) : undefined}
    >
      <span
        className="flex-none rounded-full"
        style={{
          width: row.kind === 'overflow' ? 5 : 6,
          height: row.kind === 'overflow' ? 5 : 6,
          background: row.kind === 'overflow' ? '#cbd5e1' : color,
        }}
      />
      {labelled ? (
        <>
          <span
            className={`min-w-0 flex-1 truncate text-[10.5px] leading-tight ${
              row.kind === 'overflow' ? 'font-semibold text-slate-400' : 'font-medium text-slate-600'
            }`}
          >
            {row.label}
          </span>
          {/* Where this reason goes, said rather than drawn — and said at the
              edge the wire leaves from, so the name and the line that carries
              it start in the same place. Tracing a curve through four others
              was the only way to read this before. */}
          {dests.length > 0 && (
            <span
              className="flex flex-none items-center gap-0.5 text-[10px] font-semibold leading-tight"
              style={{ color }}
              title={dests.map(nameFor).join(', ')}
            >
              <ArrowIcon />
              {nameFor(dests[0])}
              {dests.length > 1 && (
                <span className="font-bold text-slate-400">+{dests.length - 1}</span>
              )}
            </span>
          )}
        </>
      ) : (
        // Not yet legible, but the row is still saying something: how many
        // things there are and roughly how long each one is. A bare dot on an
        // empty row reads as a card that failed to load.
        <span
          className="h-[4px] flex-none rounded-full bg-slate-200"
          style={{ width: `${barWidth(row.label)}%` }}
        />
      )}
    </div>
  )
}

function ArrowIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

/** Label length, quantised to a coarse scale so the rows read as a set. */
function barWidth(label: string): number {
  const steps = [42, 56, 70, 84]
  return steps[Math.min(steps.length - 1, Math.floor(label.length / 9))]
}
