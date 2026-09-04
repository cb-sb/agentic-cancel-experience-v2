/**
 * Orchestration model for the agentic cancel experience.
 *
 * Mirrors the brightback-server "Play" domain so the prototype speaks the same
 * language. A Play targets an audience on a trigger and routes traffic through a
 * routing tree. There is no standalone "variant" entity — A/B tests and holdouts
 * are branches of a percent split, exactly as the real product models them.
 *
 *   Trigger → Audience → Targeting (routing tree)
 *                              ├── control (holdout, NONE)
 *                              └── all_other_offers (treatment → flow)
 *
 * A `flow` leaf deep-links into the step composer (the existing Experience).
 */

/** Delivery surface for the play (brightback: PlayPresentation). */
export type Presentation = 'modal' | 'cancel_page' | 'pricing_page' | 'pop_up' | 'banner' | 'card'

/** Publish lifecycle (brightback: EntityPublishState). */
export type PublishState = 'draft' | 'live'

/** Business category (brightback: PlayType). */
export type PlayType = 'CHURN_PREVENTION' | 'RETENTION' | 'UPSELL' | 'ACQUISITION'

/**
 * Trigger type (brightback: PlayTriggerEventType). Only `page_load` is available
 * today; the rest are previewed as "coming soon" in the product.
 */
export type TriggerType =
  | 'page_load'
  | 'usage_threshold'
  | 'button_click'
  | 'subscription_renewal'
  | 'custom_event'

/** For a page-load trigger: fire on any page, or a specific page URL. */
export type TriggerMoment = 'any_page' | 'custom_page'

/** Audience rule kind (brightback: RuleType). */
export type RuleType = 'TARGETING' | 'SPLIT' | 'ALL_AUDIENCE' | 'LOCALE_MATCHING'

/** What a routing leaf resolves to (brightback: TargetType). NONE = holdout. */
export type TargetType = 'OFFER' | 'CANCEL_PAGE' | 'PRICING_PAGE' | 'HOSTED_PAGE' | 'NONE'

/** Reserved branch name for the holdout, per brightback convention. */
export const CONTROL = 'control'
/** Reserved branch name for the treatment bucket, per brightback convention. */
export const ALL_OTHER_OFFERS = 'all_other_offers'
/** Reserved branch name for the sub-audience fallback (unmatched subscribers). */
export const FALLBACK = 'fallback'

/**
 * How the targeting split routes traffic:
 * - `single`   — one cancel experience shown to everyone in the audience.
 * - `percent`  — A/B test: one control + N variants split by traffic %.
 * - `audience` — sub-audiences: rule-based segments + a fallback for unmatched.
 */
export type SplitMode = 'single' | 'percent' | 'audience'

/** The role a branch plays, used to drive labels and styling. */
export type BranchRole = 'control' | 'variant' | 'segment' | 'fallback'

/** How a single targeting condition compares a property to a value. */
export type RuleOperator = 'is' | 'is_not' | 'contains' | 'gt' | 'lt' | 'is_any_of'

export const RULE_OPERATOR_LABELS: Record<RuleOperator, string> = {
  is: 'Is',
  is_not: 'Is not',
  contains: 'Contains',
  gt: 'Greater than',
  lt: 'Less than',
  is_any_of: 'Is any of',
}

/** Subscriber properties available for targeting (mock of the product's list). */
export const SUBSCRIBER_PROPERTIES: string[] = [
  'Country',
  'Owner First Name',
  'Billing ID',
  'Plan',
  'Subscription status',
  'MRR',
  'Lifetime value',
  'Coupon Codes',
  'Coupon IDs',
  'Contract Term End',
  'Days since signup',
  'Trial status',
]

/** A single rule row: WHEN <property> <operator> <value> (mock BrightbackExpression atom). */
export interface AudienceCondition {
  id: string
  property: string
  operator: RuleOperator
  value: string
  /**
   * Rules that qualify this one. They bracket with their parent — "(Plan is
   * Enterprise AND Currency is USD) OR …" — which is the only reason nesting
   * exists: without it, a mixed AND/OR list has no unambiguous reading.
   *
   * One level deep on purpose. Deeper trees are a query builder, and a targeting
   * rule that needs one is better written as an expression.
   */
  children?: AudienceCondition[]
  /** How this rule's sub-rules join to it, and to each other. Defaults to AND. */
  join?: MatchJoin
}

/** How custom conditions combine. */
export type MatchJoin = 'AND' | 'OR'

export interface Audience {
  id: string
  name: string
  ruleType: RuleType
  /** Human-readable targeting expression (mock — real product uses BrightbackExpression). */
  expression?: string
  /** True → every subscriber is eligible (no rules). */
  targetAll?: boolean
  /** How custom conditions combine. */
  match?: MatchJoin
  /** Custom targeting rules (when neither targetAll nor a bare saved reference). */
  conditions?: AudienceCondition[]
  /** Id of a chosen saved audience from the library, or null/undefined for custom. */
  savedAudienceId?: string | null
}

/** A reusable, pre-defined audience the merchant can pick (mock library). */
export interface SavedAudience {
  id: string
  name: string
  match: MatchJoin
  conditions: AudienceCondition[]
}

/** Mock library of existing audiences (mirrors the product's saved audiences). */
export const AUDIENCE_LIBRARY: SavedAudience[] = [
  {
    id: 'all_paying',
    name: 'Paying subscribers',
    match: 'AND',
    conditions: [
      { id: 'ap-1', property: 'Subscription status', operator: 'is', value: 'Active' },
      { id: 'ap-2', property: 'MRR', operator: 'gt', value: '0' },
    ],
  },
  {
    id: 'high_value',
    name: 'High-value subscribers',
    match: 'AND',
    conditions: [{ id: 'hv-1', property: 'Lifetime value', operator: 'gt', value: '1000' }],
  },
  {
    id: 'high_risk',
    name: 'High risk customers',
    match: 'OR',
    conditions: [
      { id: 'hr-1', property: 'Days since signup', operator: 'lt', value: '30' },
      { id: 'hr-2', property: 'Plan', operator: 'is', value: 'Starter' },
    ],
  },
  {
    id: 'annual',
    name: 'Annual customers',
    match: 'AND',
    conditions: [{ id: 'an-1', property: 'Plan', operator: 'contains', value: 'Annual' }],
  },
  {
    id: 'in_trial',
    name: 'In-trial (active)',
    match: 'AND',
    conditions: [{ id: 'it-1', property: 'Trial status', operator: 'is', value: 'Active' }],
  },
]

function ruleAtom(c: AudienceCondition): string {
  return `${c.property} ${RULE_OPERATOR_LABELS[c.operator]} ${c.value || '…'}`
}

/** A rule and its sub-rules, bracketed so the reading order is never in doubt. */
function ruleClause(c: AudienceCondition): string {
  const kids = (c.children ?? []).filter((k) => k.property)
  if (!kids.length) return ruleAtom(c)
  return `(${[c, ...kids].map(ruleAtom).join(` ${c.join ?? 'AND'} `)})`
}

/** Compact human expression for a set of conditions, e.g. "Country Is USA OR Plan Is Starter". */
export function conditionExpression(conditions: AudienceCondition[], match: MatchJoin): string {
  return conditions
    .filter((c) => c.property)
    .map(ruleClause)
    .join(` ${match} `)
}

/** One-line summary used on the audience node card and elsewhere. */
export function audienceSummary(a: Audience): string {
  if (a.targetAll) return 'All subscribers'
  if (a.conditions && a.conditions.length > 0) {
    return conditionExpression(a.conditions, a.match ?? 'AND')
  }
  return a.expression || 'Who is eligible'
}

export interface Trigger {
  /** Which trigger type fires the play. Only `page_load` is selectable today. */
  type: TriggerType
  /** For a page-load trigger: any page or a specific page. */
  moment: TriggerMoment
  /** Merchant-facing label for the trigger. */
  label: string
  /** Page URL/pattern when `moment === 'custom_page'`. */
  expression?: string
}

/** Metadata for a trigger type, including whether it's shippable today. */
export interface TriggerTypeDef {
  type: TriggerType
  label: string
  description: string
  available: boolean
}

/** Trigger types shown in the picker — one available, the rest "coming soon". */
export const TRIGGER_TYPES: TriggerTypeDef[] = [
  { type: 'page_load', label: 'Page load', description: 'Trigger when a specific page is loaded', available: true },
  { type: 'usage_threshold', label: 'Usage threshold alert', description: 'Trigger when usage reaches a specified threshold', available: false },
  { type: 'button_click', label: 'Button click', description: 'Trigger when a specific button is clicked', available: false },
  { type: 'subscription_renewal', label: 'Subscription renewal', description: 'Trigger when a subscription is renewed', available: false },
  { type: 'custom_event', label: 'Custom event / Webhook', description: 'Trigger based on custom event tracking', available: false },
]

/** Auto label for a page-load trigger based on its moment. */
export function triggerLabel(t: Pick<Trigger, 'moment' | 'expression'>): string {
  return t.moment === 'custom_page' ? 'Custom page load' : 'Any page load'
}

/** One-line summary used on the trigger node card. */
export function triggerSummary(t: Trigger): string {
  if (t.type !== 'page_load') {
    return TRIGGER_TYPES.find((x) => x.type === t.type)?.description ?? 'Coming soon'
  }
  return t.moment === 'custom_page'
    ? `Fires on ${t.expression || 'a specific page'}`
    : 'Fires on any page load'
}

/**
 * Per-node performance. Rates are 0..1; formulas mirror the real reports.
 * Absent until a play has actually run — nothing here is projected or seeded.
 */
export interface NodeMetrics {
  /** Sessions routed to this node. */
  sessions: number
  /** saved / (saved + canceled). */
  saveRate: number
  /** acceptedOffers / views. */
  acceptRate: number
  /** deflects / sessions. */
  deflectRate: number
}

export type RoutingNode = SplitNode | FlowNode | HoldoutNode

/**
 * Targeting split. In `percent` mode this is an A/B experiment whose branch
 * percents sum to 100 (brightback: percentRoutingNode). In `audience` mode the
 * branches are rule-based sub-audiences plus a fallback. In `single` mode there
 * is exactly one branch shown to everyone.
 */
export interface SplitNode {
  id: string
  kind: 'split'
  name: string
  /** Routing strategy for this split. Defaults to `percent` when absent. */
  mode: SplitMode
  branches: RoutingBranch[]
}

export interface RoutingBranch {
  id: string
  /** 'control' | 'all_other_offers' | 'fallback' | custom treatment name. */
  name: string
  /** Share of traffic 0..100 (used in `percent` mode). */
  percent: number
  /** What this branch represents — drives labels/styling. */
  role?: BranchRole
  /** Sub-audience rules for this branch (used in `audience` mode). */
  audience?: Audience
  node: RoutingNode
}

/** A live cancel flow — deep-links into the step composer (an Experience). */
export interface FlowNode {
  id: string
  kind: 'flow'
  name: string
  target: TargetType
  /** Reference to the Experience edited in the composer. */
  experienceId: string
  /** Only set once the flow has measured traffic. */
  metrics?: NodeMetrics
}

/** Holdout — no treatment shown, tagged "control" for lift reporting. */
export interface HoldoutNode {
  id: string
  kind: 'holdout'
  name: typeof CONTROL
  target: 'NONE'
  /** Only set once the holdout has measured traffic. */
  metrics?: NodeMetrics
}

export interface Play {
  id: string
  name: string
  playType: PlayType
  presentation: Presentation
  /** Lower = higher priority when multiple plays match. */
  priority: number
  active: boolean
  enabled: boolean
  publishState: PublishState
  audience: Audience
  trigger: Trigger
  targeting: RoutingNode
}

/** Human labels for the target enum. */
export const TARGET_LABELS: Record<TargetType, string> = {
  OFFER: 'Save flow',
  CANCEL_PAGE: 'Cancel page',
  PRICING_PAGE: 'Pricing page',
  HOSTED_PAGE: 'Hosted page',
  NONE: 'Holdout (no treatment)',
}

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  ALL_AUDIENCE: 'All subscribers',
  TARGETING: 'Targeted segment',
  SPLIT: 'Split audience',
  LOCALE_MATCHING: 'Locale match',
}

/** Short label for a branch, depending on the split mode. */
export function branchLabel(branch: RoutingBranch, mode: SplitMode): string {
  if (branch.role === 'fallback') return 'Fallback'
  if (mode === 'audience') {
    return branch.audience ? audienceSummary(branch.audience) : 'Everyone in audience'
  }
  return `${Math.round(branch.percent)}%`
}

/** Human name for a branch card header. */
export function branchName(branch: RoutingBranch): string {
  if (branch.role === 'fallback') return 'Fallback experience'
  if (branch.node.kind === 'holdout') return 'Control (holdout)'
  if (branch.node.kind === 'flow') return branch.node.name
  return branch.name.replace(/_/g, ' ')
}

/**
 * Title for the targeting/split node.
 *
 * Named for what it does to traffic, because in single mode it is the only card
 * on the spine: everyone who reaches cancel arrives here and goes on to one
 * experience. Splitting is the thing this node can do, not the thing it always
 * is, so the name only says "split" once it actually is one.
 */
export function experimentTitle(split: SplitNode): string {
  if (split.mode === 'single') return 'All cancel traffic'
  if (split.mode === 'audience') return 'Split by sub-audience'
  return 'Split by percentage'
}

/** Kicker for the targeting/split node. */
export function experimentKicker(split: SplitNode): string {
  return split.mode === 'single' ? 'Traffic' : 'Traffic split'
}
