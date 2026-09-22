/**
 * The widths of the three columns the shell is made of.
 *
 * Here rather than inline in the grid because other things have to reason about
 * them: focus geometry measures around them, and the auto-pan needs to know how
 * much of the canvas the folded assistant is standing on *after* the column has
 * finished animating, which it cannot get by measuring mid-flight.
 */

/** Chargebee Copilot, reduced rail — keeps more of the workflow canvas in view. */
export const ASSISTANT_W = 400

/**
 * Center Copilot on a blank start. 75% of the near-full overlay width and 80%
 * of the guttered height, so more dotted canvas stays visible around it.
 */
export const COPILOT_CENTER_W = 'calc((100% - 48px) * 0.75)'
export const COPILOT_CENTER_H = 'calc((100% - 48px) * 0.8)'

/**
 * Expanded rail after a journey lands. Narrower than center Copilot so the
 * workflow canvas has room; the merchant can switch back to `ASSISTANT_W`.
 */
export const ASSISTANT_EXPANDED_W = '50vw'

/**
 * Chargebee Copilot, folded. A narrow right rail that holds the launcher icon
 * so the canvas is pushed rather than covered.
 */
export const ASSISTANT_FOLDED_W = 72

/** Growth product nav, open — labels and nested items, matching the live app. */
export const NAV_W = 232

/**
 * Growth product nav, folded. Same Copilot pattern: a slim column that always
 * occupies width, and opens only when the merchant clicks it.
 */
export const NAV_FOLDED_W = 56

/** The settings pane. Brand is narrower — its rows are shorter. */
export const SETTINGS_W = 360
export const SETTINGS_BRAND_W = 340
