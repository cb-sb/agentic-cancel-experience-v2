/**
 * Growth slot contract — versioned public ingress for merchant chrome.
 *
 * Chrome (layout, type, CSS) is merchant-owned. Slots are Growth primitives
 * reused across cancel, acquire, and later plays. Scan does not guess: unmarked
 * HTML fails with a checklist. Confirm is only for catalog binds.
 *
 * External LLMs may emit marked static HTML against this schema. They must not
 * author targeting, holdout, offer selection, or publish — Copilot owns those.
 *
 * | Attribute        | On           | Meaning |
 * | `data-cb-step`   | section/page | Step id |
 * | `data-cb-kind`   | step         | Growth primitive (required) |
 * | `data-cb-slot`   | region       | `offer` \| `survey` \| `la_stats` \| `media` |
 * | `data-cb-field`  | text node    | Subscriber field |
 * | `data-cb-action` | button/link  | Known action |
 * | `data-cb-bind`   | offer child  | `title` \| `cta` \| `body` \| `eyebrow` |
 * | `data-cb-next`   | link         | Next zip page path |
 */

/** Bump when attributes, kinds, or KIND_REQUIREMENTS change. */
export const CONTRACT_VERSION = '1.0.0'

/** What this contract is — and is not — allowed to describe. */
export const INGRESS_SCOPE = {
  in: [
    'marked static HTML/CSS',
    'data-cb-* attributes',
    'JourneyStepKind / data-cb-kind',
    'starter-kit samples',
  ],
  out: [
    'audience / targeting',
    'holdout',
    'offer catalog selection',
    'publish',
    'play A/B',
    'subscriber walk',
    'brand matching',
  ],
} as const

export const CB = {
  step: 'data-cb-step',
  kind: 'data-cb-kind',
  slot: 'data-cb-slot',
  field: 'data-cb-field',
  action: 'data-cb-action',
  bind: 'data-cb-bind',
  next: 'data-cb-next',
} as const

/** Growth primitives — not cancel-only. */
export const CB_KINDS = [
  'loss_aversion',
  'survey',
  'offer',
  'pricing_table',
  'checkout',
  'confirmation',
  'outcome_saved',
  'outcome_cancelled',
] as const

export type CbKind = (typeof CB_KINDS)[number]

/** @deprecated Use CB_KINDS. Alias kept so older call sites compile. */
export type CbKindHint = CbKind
/** @deprecated Use CB_KINDS. */
export const CB_KIND_HINTS: readonly CbKind[] = CB_KINDS

export const CB_KIND_ALIASES: Record<string, CbKind> = {
  outcome: 'outcome_cancelled',
}

export const CB_SLOT_NAMES = ['offer', 'survey', 'la_stats', 'media'] as const
export type CbSlotName = (typeof CB_SLOT_NAMES)[number]

export const CB_BINDS = ['title', 'cta', 'body', 'eyebrow'] as const
export type CbBind = (typeof CB_BINDS)[number]

export const CB_ACTIONS_CONTRACT = [
  'continue',
  'back',
  'accept_offer',
  'decline_offer',
  'keep',
  'cancel',
  'exit',
] as const

export const CB_FIELDS = [
  'credits_remaining',
  'plan_name',
  'days_on_plan',
  'member_since',
  'next_renewal',
  'usage_hours',
] as const

export const CB_KIND_LABELS: Record<CbKind, string> = {
  loss_aversion: 'Loss aversion',
  survey: 'Survey',
  offer: 'Offer',
  pricing_table: 'Pricing table',
  checkout: 'Checkout',
  confirmation: 'Confirmation',
  outcome_saved: 'Saved',
  outcome_cancelled: 'Cancelled',
}

export interface KindRequirement {
  /** HTML `data-cb-slot` names that must appear on the step. */
  slots?: readonly CbSlotName[]
  /** `data-cb-action` values that must appear on the step. */
  actions?: readonly string[]
  /** At least one `data-cb-field` or `data-cb-slot="la_stats"`. */
  fieldOrLaStats?: boolean
}

export const KIND_REQUIREMENTS: Record<CbKind, KindRequirement> = {
  loss_aversion: { fieldOrLaStats: true },
  survey: { slots: ['survey'] },
  offer: { slots: ['offer'], actions: ['accept_offer'] },
  confirmation: { actions: ['keep', 'cancel'] },
  pricing_table: {},
  checkout: {},
  outcome_saved: {},
  outcome_cancelled: {},
}

export function isCbKind(value: string): value is CbKind {
  return (CB_KINDS as readonly string[]).includes(value)
}

export function parseCbKind(raw: string | null): CbKind | null {
  if (!raw) return null
  if (isCbKind(raw)) return raw
  return CB_KIND_ALIASES[raw] ?? null
}

export function isCbSlotName(value: string): value is CbSlotName {
  return (CB_SLOT_NAMES as readonly string[]).includes(value)
}

/** JSON Schema for Figma plugins, CI, or an optional AI wrapper. Not an authoring skill. */
export const GROWTH_SLOT_SCHEMA = {
  $id: 'https://chargebee.growth/slot-contract',
  version: CONTRACT_VERSION,
  title: 'Chargebee Growth slot contract',
  description:
    'Closed vocabulary for merchant HTML chrome. Growth primitives (loss aversion, survey, offer, …) bind at slots. Do not guess unmarked pages. Do not emit targeting, holdout, offers, or publish.',
  scope: INGRESS_SCOPE,
  type: 'object',
  attributes: {
    [CB.step]: { on: 'section or page', required: true, description: 'Step id' },
    [CB.kind]: { on: 'step', required: true, enum: [...CB_KINDS], aliases: CB_KIND_ALIASES },
    [CB.slot]: { on: 'region', enum: [...CB_SLOT_NAMES] },
    [CB.field]: { on: 'text node', examples: [...CB_FIELDS] },
    [CB.action]: { on: 'button or link', enum: [...CB_ACTIONS_CONTRACT] },
    [CB.bind]: { on: 'offer child', enum: [...CB_BINDS] },
    [CB.next]: { on: 'link', description: 'Next zip page path' },
  },
  kinds: Object.fromEntries(
    CB_KINDS.map((kind) => [
      kind,
      {
        label: CB_KIND_LABELS[kind],
        requires: KIND_REQUIREMENTS[kind],
      },
    ]),
  ),
} as const
