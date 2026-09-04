/**
 * What a subscriber *does* in a cancel experience, as one vocabulary.
 *
 * The canvas used to draw a wire between every step and the one after it, which
 * said only that the second came later. What a merchant needs to trace is the
 * decision that moves someone along a wire — the reason they picked, whether
 * they took the offer, whether they went through with cancelling — and the
 * runtime already knows all of it.
 *
 * So the labels are bound to the store actions that raise them (`raisedBy` is
 * `keyof ExperienceState`). Rename `acceptOffer` and this file stops compiling,
 * which is the point: a canvas that describes behaviour is only worth having if
 * it cannot quietly describe behaviour the runtime no longer has.
 */

import type { ExperienceState } from '../store/useExperience'

export type PlayEventId =
  | 'reason_selected'
  | 'no_matching_offer'
  | 'offer_accepted'
  | 'plan_selected'
  | 'offer_declined'
  | 'cancel_confirmed'
  | 'subscription_kept'
  | 'continued'

export interface PlayEvent {
  id: PlayEventId
  /** What the merchant reads on the wire. */
  label: string
  /**
   * The same event in the room a column gap has one tier further out. Two
   * lengths rather than one truncated with an ellipsis: `Declined` is still the
   * event, `Offer decl…` is neither the event nor a word.
   */
  short: string
  /**
   * The runtime action that raises it, or null where the event is the *absence*
   * of a decision rather than one.
   */
  raisedBy: keyof ExperienceState | null
}

export const PLAY_EVENTS: Record<PlayEventId, PlayEvent> = {
  // Carries the reason with it, so the wire reads "It's too expensive" selected.
  reason_selected: {
    id: 'reason_selected',
    label: 'selected',
    short: 'selected',
    raisedBy: 'selectReason',
  },
  // Nobody does this: it is what happens when a reason routes to no offer.
  no_matching_offer: {
    id: 'no_matching_offer',
    label: 'No matching offer',
    short: 'No offer',
    raisedBy: null,
  },
  // Covers the checkout detour too — `completeCheckout` only resolves what
  // accepting already decided, and a wire for it would point at the same card.
  offer_accepted: {
    id: 'offer_accepted',
    label: 'Offer accepted',
    short: 'Accepted',
    raisedBy: 'acceptOffer',
  },
  plan_selected: {
    id: 'plan_selected',
    label: 'Plan selected',
    short: 'Selected',
    raisedBy: 'acceptOffer',
  },
  offer_declined: {
    id: 'offer_declined',
    label: 'Offer declined',
    short: 'Declined',
    raisedBy: 'declineOffer',
  },
  cancel_confirmed: {
    id: 'cancel_confirmed',
    label: 'Cancel confirmed',
    short: 'Confirmed',
    raisedBy: 'confirmCancel',
  },
  subscription_kept: {
    id: 'subscription_kept',
    label: 'Subscription kept',
    short: 'Kept',
    raisedBy: 'keepSubscription',
  },
  continued: { id: 'continued', label: 'Continued', short: 'Continued', raisedBy: 'goNext' },
}

/** Both lengths, so the wire can pick the one its gap has room for. */
export function eventText(id: PlayEventId): { label: string; short: string } {
  const e = PLAY_EVENTS[id]
  return { label: e.label, short: e.short }
}

/**
 * A reason's own wire says which reason it is; a bundled one says how many.
 *
 * These are only drawn on hover — four reason ports are 20 world units apart
 * and a chip is taller than that, so labelling them all at once stacks four
 * labels on top of each other and answers nobody's question.
 */
export function reasonEventText(reason: string, count = 1): { label: string; short: string } {
  if (count > 1) {
    return { label: `${count} reasons selected`, short: `${count} reasons` }
  }
  return { label: `“${reason}” selected`, short: 'Reason selected' }
}
