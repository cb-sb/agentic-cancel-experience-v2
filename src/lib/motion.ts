/**
 * The two curves everything in the shell moves on.
 *
 * Arriving decelerates, so a panel looks like it settles into place rather than
 * stopping dead. Leaving does the opposite and is quicker: once a merchant has
 * decided to close something, the animation is only in the way.
 */
export const EASE_ENTER = 'cubic-bezier(0.22, 0.68, 0, 1)'
export const EASE_LEAVE = 'cubic-bezier(0.4, 0, 0.9, 0.6)'

/** How long a pane takes to fold or unfold. */
export const PANEL_MS = 200
