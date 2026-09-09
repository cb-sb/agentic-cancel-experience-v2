/**
 * The canvas layout contract. Every number that decides where something sits or
 * how big it is lives here — nowhere else on the canvas should hold a geometry
 * literal.
 *
 * Two coordinate systems, kept strictly apart:
 *
 * - WORLD units are what React Flow transforms. Node positions, node sizes and
 *   the gaps between them are world units, so the composition holds its shape at
 *   every zoom.
 * - SCREEN pixels never pass through the zoom. Toolbars, borders, labels and
 *   card interiors are authored in screen pixels and placed inside a world-sized
 *   box by `ScreenBox`, so 12px type is 12px at 40% and at 160%.
 *
 * The load-bearing rule: **a node's world size never changes**. Not with zoom,
 * not with tier, not with the device being previewed. Zooming therefore cannot
 * trigger a relayout, which is the entire class of bug where a fix at one zoom
 * broke the next one. Tiers change what is drawn inside the box, never the box.
 */

/* ─────────────────────────── World: step grid ─────────────────────────── */

/** Every step card, at every tier, forever. */
export const STEP_W = 260
export const STEP_H = 168
/**
 * Between step columns — the subscriber's path, left to right. Sized by the
 * event chip that has to sit in it rather than picked; see `CHIP_ALLOWANCE`,
 * below the tier ladder it depends on.
 */
/**
 * Between interchangeable offer variants stacked in one column. Sized by the
 * toolbar that has to fit in it, so it is derived rather than picked — see
 * `TOOLBAR_ALLOWANCE`, below the tier ladder it depends on.
 */
/** The add-step slot that sits before the closing steps. */
export const ADD_STEP_W = 112

/* ────────────────────────── World: the play graph ─────────────────────── */

export const CARD_W = 244
export const CARD_H = 112
/** Horizontal pitch of the split and branch columns. */
export const COL_GAP = 116
/**
 * Between branch rows. Sized by the enclosure title, which hangs off the top
 * edge of a row and grows up into this gap as the canvas zooms out: the gap has
 * to hold a title still legible at MIN_ZOOM, or the title's ceiling becomes the
 * thing that makes it unreadable. See TITLE_MAX_SCALE.
 */
export const ROW_GAP = 168
/** Vertical anchor the whole play is centred on. */
export const Y_MID = 280
/** Left margin of the first column. */
export const LANE_X0 = 40
/**
 * Inset between an enclosure's edge and the cards inside it. Generous on
 * purpose: the frame reads as an artboard the steps sit on, and cards crowding
 * its edge read as clipped — and it has to hold the toolbar of a card on the
 * top row, so it is derived from that. See `TOOLBAR_ALLOWANCE`.
 */
/** Between a branch card and the enclosure it points at. */
export const ENCLOSURE_GAP = 80
/** Room above an enclosure for its title, which floats outside the frame. */
export const TITLE_ALLOWANCE = 48
export const ADD_BRANCH_H = 52
/** A collapsed enclosure is a fixed card; its contents adapt, its box does not. */
export const COLLAPSED_W = 340
export const COLLAPSED_H = 208
/** Non-experience branch targets (a bare offer, a pricing page). */
export const TARGET_W = 300
export const TARGET_H = 200

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 1.6

/* ───────────────────────── Screen: constant chrome ────────────────────── */

/** Floating toolbar above a step card. */
export const TOOLBAR_H = 34
export const TOOLBAR_GAP = 10
/** Enclosure title pill, as it actually renders: 3px of padding around a 28px row. */
export const TITLE_PILL_H = 34
export const TITLE_PILL_GAP = 10
/** Kept clear between a title at full stretch and the enclosure above it. */
const TITLE_CLEARANCE = 8
/**
 * Counter-scale ceilings. Both are derived from the room the thing actually has
 * rather than picked, which is what the five hand-tuned caps they replaced were
 * papering over. Transient chrome (the step toolbar) has no ceiling at all,
 * because it does not live in the world; it floats in the screen-space overlay.
 *
 * The title's room is the whole clearance above an enclosure — the row gap plus
 * the title band — because the pill hangs off the top edge and grows upward into
 * that gap, less the margin that keeps it off the enclosure above. Measuring the
 * band alone put the ceiling at 1.2, so at the minimum zoom the title rendered
 * about seven pixels tall. ROW_GAP is in turn sized so this lands near 1/MIN_ZOOM
 * and the title's 12.5px type stays around 10px on screen at every zoom.
 */
export const TITLE_MAX_SCALE =
  (ROW_GAP + TITLE_ALLOWANCE - TITLE_CLEARANCE / MIN_ZOOM) / (TITLE_PILL_H + TITLE_PILL_GAP)
/**
 * A wire's origin dot is bounded by the card edge it sits on, not by the canvas:
 * held at full size on a card shrunk to a tenth it stops reading as a dot on the
 * card and starts reading as a blob beside it. Half again is as far as it goes.
 */
export const DOT_MAX_SCALE = 1.5
/** The enclosure frame's stroke. Two world px, so it survives being zoomed out. */
export const FRAME_BORDER = 2
/**
 * Wire weights, on screen. Non-scaling, so none of them thin out.
 *
 * Ordered by how much each one carries. The spine is traffic and reads first;
 * a reason's route to an offer is the decision drawn on top of it; the wires
 * between steps are the default path, which is the quietest thing on the canvas
 * but still has to be a line rather than a hairline — at a third of a hair it
 * disappears into the dot grid, and the shape of the flow goes with it.
 */
export const WIRE_W = 2.25
export const LINK_W = 2.25
export const LINK_W_HOT = 3.75
export const STEP_WIRE_W = 2

/**
 * Routing wires. Deliberately the one saturated colour on the canvas: the flow
 * of traffic is the only thing a merchant needs to trace at a glance when
 * zoomed out, and everything else is greyscale so it can.
 */
export const WIRE_COLOR = '#f0501e'
/** Step-to-step wires: grey, so they stay behind the routing, but not a ghost. */
export const STEP_WIRE_COLOR = '#94a3b8'

/* ──────────────────────────────── Ports ───────────────────────────────── */

/**
 * Reason and offer ports sit at fixed world offsets down a card's edge, and the
 * card's interior draws its rows at those same offsets. Because the offsets are
 * world units, a port and the row it belongs to cannot drift apart when the
 * interior re-flows at a different tier — and because every port is mounted at
 * every tier, changing tier can never orphan an edge.
 */
export const PORT_TOP = 102
export const PORT_PITCH = 20
/** Rows a card shows before the rest bundle into one "+N more" port. */
export const PORT_MAX = 3
/** World space above the first port row — the card's header lives here. */
export const HEADER_H = PORT_TOP - PORT_PITCH / 2

export const portY = (index: number) => PORT_TOP + index * PORT_PITCH

/* ───────────────────────────── The tier ladder ────────────────────────── */

/**
 * Four fidelities. The tier is chosen from how wide a card is *on screen*, not
 * from the raw zoom: it is the honest measure of how much room the interior has,
 * and — unlike measuring the mounted node — it cannot feed back into itself and
 * oscillate, because the world size it derives from is constant.
 */
export type Tier = 't0' | 't1' | 't2' | 't3'

/**
 * Screen width, in px, at which each tier becomes legible. Derived from what
 * actually fits rather than picked: a name row plus wireframe bars needs ~112px,
 * an eyebrow with a two-line headline needs ~164px, and labelled reason rows on
 * a `PORT_PITCH` rhythm only clear 11px type from ~214px.
 */
export const TIER_MIN_W: Record<Exclude<Tier, 't0'>, number> = {
  t1: 112,
  t2: 164,
  t3: 214,
}

export const TIER_LABEL: Record<Tier, string> = {
  t0: 'Map',
  t1: 'Outline',
  t2: 'Summary',
  t3: 'Detail',
}

export const TIER_HINT: Record<Tier, string> = {
  t0: 'names only',
  t1: 'shape of each step',
  t2: 'what each step says',
  t3: 'full detail — click to edit',
}

export const TIERS: Tier[] = ['t0', 't1', 't2', 't3']

export function tierForWidth(screenW: number): Tier {
  if (screenW < TIER_MIN_W.t1) return 't0'
  if (screenW < TIER_MIN_W.t2) return 't1'
  if (screenW < TIER_MIN_W.t3) return 't2'
  return 't3'
}

export function tierForZoom(zoom: number, worldW: number = STEP_W): Tier {
  return tierForWidth(worldW * zoom)
}

/* ───────────────────── World sized by the chrome over it ──────────────── */

/**
 * The world room a step's floating toolbar needs above it, and the two gaps
 * sized by it. The one place a world number is derived from a screen one, which
 * is why it sits after both.
 *
 * The toolbar floats in screen space above a card, so whatever world gap is
 * above that card has to be wide enough to hold it — otherwise the toolbar is
 * drawn over what is up there, which is what it did to the card above it in a
 * stack of offer variants at every zoom it appeared at. A world gap buys fewer
 * screen pixels the further out the canvas is zoomed, so it is sized at the
 * *lowest* zoom the toolbar exists at: t3, where it is first drawn. Above that
 * zoom the same gap only gets roomier, and below it there is no toolbar to fit.
 */
const TOOLBAR_MIN_ZOOM = TIER_MIN_W.t3 / STEP_W
/** Kept clear between the toolbar and whatever sits above it. */
const TOOLBAR_CLEARANCE = 8

export const TOOLBAR_ALLOWANCE = Math.ceil(
  (TOOLBAR_GAP + TOOLBAR_H + TOOLBAR_CLEARANCE) / TOOLBAR_MIN_ZOOM,
)

/** Above a stacked variant is the card it stacks under. */
export const STEP_GAP_Y = TOOLBAR_ALLOWANCE

/* ─────────────────────────── Event chips on wires ─────────────────────── */

/**
 * The chip on a wire, and the column gap sized to hold it.
 *
 * Same derivation as the toolbar: the chip is screen-space, so the world gap it
 * has to fit inside buys the fewest screen pixels at the lowest zoom the chip
 * is drawn at its full size — the summary tier. `No matching offer` is the
 * widest label at 105px measured, plus its dot and the inset either side.
 *
 * It used to be sized for the *short* labels instead, which is what made the
 * chips shrink their wording as the canvas pulled back and clip it on the way.
 * The event is the thing worth reading when the whole play is on screen, so the
 * gap is sized for the words rather than the words trimmed for the gap.
 */
/** Off the source card's edge, and above the wire it labels. */
export const CHIP_INSET = 10
/** Its own height, which the vertical placement is reckoned from. */
export const CHIP_H = 19
/** Widest label, measured, plus the leading dot. */
const CHIP_FULL_W = 118
const CHIP_MIN_ZOOM = TIER_MIN_W.t2 / STEP_W

export const CHIP_ALLOWANCE = Math.ceil((CHIP_FULL_W + CHIP_INSET * 2) / CHIP_MIN_ZOOM)

export const STEP_GAP_X = CHIP_ALLOWANCE

/**
 * How wide a chip is, without measuring one.
 *
 * The label is known and the type is fixed, so its width is arithmetic: 6px a
 * character plus the dot, the padding and the border. Derived rather than read
 * off the DOM because a chip that measures itself inside a transform it also
 * sizes is a feedback loop, and this whole file exists to keep world geometry
 * out of that argument.
 */
export function chipWidth(label: string): number {
  return label.length * 6 + 15
}

/**
 * Above the top row is the frame's own inset. Sizing it to the same allowance
 * keeps the toolbar inside the enclosure at every zoom it is drawn at, which is
 * what stops it grazing the title pill hanging off the frame's top edge — one
 * rule, rather than the toolbar and the title negotiating over a shared band.
 */
export const ENCLOSURE_PAD = TOOLBAR_ALLOWANCE

/** Zoom that lands comfortably inside a tier's band — the zoom-bar shortcuts. */
export function zoomForTier(tier: Tier): number {
  switch (tier) {
    case 't0':
      return 0.32
    case 't1':
      return 0.52
    case 't2':
      return 0.8
    case 't3':
      return 1.15
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/* ───────────────────────── World → screen projection ──────────────────── */

export interface Transform {
  x: number
  y: number
  zoom: number
}

/**
 * Where a world point lands in the pane, in screen pixels. Overlay chrome is
 * positioned with this rather than being parented to a node, so it can live in
 * an untransformed layer and still track what it points at.
 */
export function projectToScreen(point: { x: number; y: number }, t: Transform) {
  return { x: point.x * t.zoom + t.x, y: point.y * t.zoom + t.y }
}
