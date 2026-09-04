/**
 * The widths of the three columns the shell is made of.
 *
 * Here rather than inline in the grid because other things have to reason about
 * them: focus geometry measures around them, and the auto-pan needs to know how
 * much of the canvas the folded assistant is standing on *after* the column has
 * finished animating, which it cannot get by measuring mid-flight.
 */

/**
 * The assistant, open. The card inside is the 360px a conversation was built
 * for; the column is wider by its gutter so that floating the card costs the
 * conversation nothing — trimming those 24px off the card instead truncated the
 * assistant's own heading.
 */
export const ASSISTANT_GUTTER = 12
export const ASSISTANT_W = 400 + ASSISTANT_GUTTER * 2

/**
 * The assistant, folded. Zero: it hands its column back to the canvas and
 * becomes a pill in the corner of the play instead of a rail beside it.
 */
export const ASSISTANT_FOLDED_W = 0

/** The settings pane. Brand is narrower — its rows are shorter. */
export const SETTINGS_W = 360
export const SETTINGS_BRAND_W = 340
