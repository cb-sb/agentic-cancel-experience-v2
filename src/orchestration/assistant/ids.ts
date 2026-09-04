/**
 * Turn ids shared between the flow registry and the modules that route into it.
 * Kept separate so `questions.ts` can name its next turn without importing
 * `flows.ts`, which imports it back.
 */

export const ENTRY_TURN_ID = 'entry'

/** The dynamic one-gap-at-a-time question turn. */
export const GAP_TURN_ID = 'Q_GAP'

/** The agent declined an unbuildable ask. */
export const PUSHBACK_TURN_ID = 'PUSHBACK'

/** Sentinel: the drafted plan card panel. */
export const PLAN_CARD_TURN_ID = 'PLAN_CARD'

/** Sentinel: the editable plan panel used by the manual pathways. */
export const PLAN_TURN_ID = 'PLAN'

/** Sentinel: the all-set panel. */
export const DONE_TURN_ID = 'DONE'
