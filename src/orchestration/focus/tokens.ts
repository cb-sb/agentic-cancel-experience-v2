import { DEVICE_WIDTHS } from '../../render/DeviceFrame'

/** Breathing room either side of the card inside the drawer. */
export const DRAWER_PAD = 30

/**
 * Enter and exit timings. Leaving is quicker than arriving: once a merchant has
 * decided to go, the animation is in the way, and a fast exit is most of what
 * "snappy" means.
 */
export const DRAWER_IN_MS = 220
export const DRAWER_OUT_MS = 150

/**
 * How far the drawer travels. A 1280px panel sliding in from off-screen is a
 * sweep across the whole window for something that is only ever a keystroke
 * away; a short move plus a fade says the same thing and arrives sooner.
 */
export const DRAWER_SLIDE = 44

/** The drawer moves on the same curves as the rest of the shell. */
export { EASE_ENTER, EASE_LEAVE } from '../../lib/motion'

/**
 * The share of the viewport the drawer aims for. Enough that the card is the
 * subject and not a preview, while the play stays legible behind the scrim as
 * the thing being worked on rather than a thing that vanished.
 */
export const DRAWER_FRACTION = 0.7

/**
 * The least canvas worth leaving beside the drawer, and a cap on the share
 * above rather than a nicety. Below roughly this, what shows is a sliver of an
 * enclosure instead of the shape of the play — the drawer would be charging for
 * context it is not delivering, which is the whole argument for the variant.
 */
export const CANVAS_PEEK_MIN = 280

/**
 * The drawer's floor, derived rather than picked: the widest card it has to
 * hold, plus its padding. Narrower than this and the desktop preview stops
 * being 1:1, at which point the card can no longer be edited in place and the
 * drawer has quietly become a form with a thumbnail — a different product, not
 * a smaller one. So on a narrow screen the share above gives way to this.
 */
export const DRAWER_W = DEVICE_WIDTHS.desktop + DRAWER_PAD * 2
