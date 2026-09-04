import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  useStore,
  type EdgeProps,
} from '@xyflow/react'
import {
  CHIP_H,
  CHIP_INSET,
  STEP_GAP_X,
  STEP_H,
  STEP_W,
  chipWidth,
  tierForZoom,
} from './canvasTokens'

export interface JourneyEdgeData {
  /** The event that traverses this wire. `short` is kept for the focus rail. */
  event?: { label: string; short: string }
  /** Reason routing hides with the routing toggle; structure never does. */
  kind?: 'mapping' | 'journey'
  /** Which way the wire is drawn. Routing links curve; structure turns. */
  curve?: 'bezier' | 'smoothstep'
  /** How far past the card the turn is made, so a stack's runs stay apart. */
  offset?: number
  /** Set while some reason row is being pointed at: this one is, or is not, it. */
  hot?: boolean
  cold?: boolean
  /** A single reason's route, editable in place (see `FlowCanvas.onEdgeClick`). */
  expId?: string
  optId?: string
}

/**
 * A wire that says what happens on it.
 *
 * The chip is authored in screen pixels and counter-scaled out of the canvas
 * transform, so `Offer accepted` is 10.5px type at 60% zoom and at 160% — the
 * same rule the step toolbars and enclosure titles follow. It is anchored just
 * past the source handle rather than at the middle of the path: the event is
 * something the subscriber did *on the card it leaves*, and a mid-path label on
 * a wire that skips a column lands on top of the card it skips.
 *
 * Every tier carries the same wording. Which decision leads where is the shape
 * of the play as much as the cards are, so the chips stay when the canvas pulls
 * back; what gives at the far end is their size, not their words.
 *
 * Reason wires are the exception: their ports are 20 world units apart, so
 * labelling all of them at once stacks four chips in the space of one. Theirs
 * appears when the row is pointed at, which is when the question is being asked.
 */
export function JourneyEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  sourceHandleId,
  style,
  data,
}: EdgeProps) {
  const zoom = useStore((s) => s.transform[2])
  const d = (data ?? {}) as JourneyEdgeData

  const geometry = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }
  const [path] =
    d.curve === 'bezier'
      ? getBezierPath(geometry)
      : getSmoothStepPath({ ...geometry, borderRadius: 10, offset: d.offset })

  const mapping = d.kind === 'mapping'
  const shows = d.event && (mapping ? d.hot : true)
  const stroke = (style as { stroke?: string } | undefined)?.stroke

  /**
   * Same type size at every zoom; the wording is what gives at the map tier.
   *
   * The chip is screen-space, so the gap it sits in shrinks as the canvas pulls
   * back while the chip does not — and at the map tier the whole play is 500px
   * wide, which five 110px labels cannot share with the cards. Shrinking the
   * type instead made them unreadable exactly where they matter most, so the
   * short form does the map tier: `Declined` is still the event, where
   * `Offer decl…` would be neither the event nor a word.
   */
  const tier = tierForZoom(zoom, STEP_W)
  const label = (tier === 't0' ? d.event?.short : d.event?.label) ?? ''

  /**
   * Centred in its gap once it is wider than the gap: from the source handle it
   * grew rightwards over the card it points at, so past the point where it fits
   * it hangs off both ends of the gap instead of one.
   */
  const room = STEP_GAP_X * zoom - CHIP_INSET * 2
  const w = chipWidth(label)
  const inset = mapping || w <= room ? CHIP_INSET : CHIP_INSET - (w - room) / 2

  /**
   * The saved path's chip hangs under its wire; every other chip sits over its
   * own. The two handles are 58 world units apart, which is 12 screen px at the
   * map tier — less than a chip is tall — so `Offer accepted` and `Offer
   * declined` landed on top of each other exactly where the labels are doing
   * the most work. Splitting them across their wires separates them by their
   * own height instead, at every zoom.
   */
  const below = sourceHandleId === 'out.saved'

  /**
   * How far off its wire the chip sits.
   *
   * Just above it, normally. But a chip wider than its gap reaches across the
   * cards either side, and a wire leaves a card at the middle of its edge — so
   * at the map tier, where the card is 34px tall, "just above the wire" is on
   * top of the card's own icon. When it spills, it clears the card's top edge
   * instead of the wire's, which is a screen distance the card's world height
   * gives us exactly.
   */
  const spills = w > room
  const lift = spills && !below && !mapping ? (STEP_H / 2) * zoom + CHIP_H + 4 : CHIP_H * 1.3

  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      {shows && d.event && (
        <EdgeLabelRenderer>
          <div
            data-wire-label={d.kind ?? 'journey'}
            className="nodrag nopan pointer-events-none absolute origin-top-left"
            style={{
              transform: `translate(${sourceX}px, ${sourceY}px) scale(${1 / zoom}) translate(${inset}px, ${
                below ? CHIP_H * 0.3 : -lift
              }px)`,
              opacity: d.cold ? 0.16 : 1,
            }}
          >
            {/* Prominent enough to read as part of the diagram rather than as a
                caption on it: the wire's own colour on the dot and the border, a
                white fill that holds it off whatever it crosses, and a shadow so
                it sits above the wire instead of on it. */}
            <span
              className="flex items-center gap-1 whitespace-nowrap rounded-full border bg-white px-[5px] py-[1px] text-[10.5px] font-bold leading-[15px] tracking-[-0.01em] text-slate-700"
              style={{
                // The wire's colour goes on the dot and the edge, not on the
                // words: step wires are deliberately grey so the reason routing
                // can be the only colour on the canvas, and grey type on white
                // is what made these read as a watermark.
                borderColor: stroke ? `${stroke}80` : '#cbd5e1',
                boxShadow: '0 1px 2px rgba(15,23,42,0.10)',
              }}
            >
              <span
                aria-hidden
                className="h-[5px] w-[5px] flex-none rounded-full"
                style={{ background: stroke ?? '#94a3b8' }}
              />
              {label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
