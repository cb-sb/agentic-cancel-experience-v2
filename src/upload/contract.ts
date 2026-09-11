/**
 * `data-cb-*` vocabulary. Scan prefers these; heuristics fill gaps; confirm is
 * the safety net. Static chrome is left untouched — only marked slots, fields,
 * and actions are dynamic.
 *
 * | Attribute       | On           | Meaning |
 * | `data-cb-step`  | section/page | Step id (`value`, `survey`, `offer`, `confirm`) |
 * | `data-cb-kind`  | step         | `loss_aversion` \| `survey` \| `offer` \| `confirmation` \| `outcome` |
 * | `data-cb-slot`  | region       | `offer` \| `survey` \| `la_stats` \| `media` |
 * | `data-cb-field` | text node    | Subscriber field (`credits_remaining`, `plan_name`) |
 * | `data-cb-action`| button/link  | `continue` \| `back` \| `accept_offer` \| `decline_offer` \| `keep` \| `cancel` \| `exit` |
 * | `data-cb-bind`  | offer child  | `title` \| `cta` \| `body` \| `eyebrow` |
 * | `data-cb-next`  | link         | Next zip page path, when not using `data-cb-action="continue"` |
 */
export const CB = {
  step: 'data-cb-step',
  kind: 'data-cb-kind',
  slot: 'data-cb-slot',
  field: 'data-cb-field',
  action: 'data-cb-action',
  bind: 'data-cb-bind',
  next: 'data-cb-next',
} as const

export type CbKindHint = 'loss_aversion' | 'survey' | 'offer' | 'confirmation' | 'outcome'

export const CB_KIND_HINTS: readonly CbKindHint[] = [
  'loss_aversion',
  'survey',
  'offer',
  'confirmation',
  'outcome',
]
