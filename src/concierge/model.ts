import type { SIconName } from '@chargebee/sting-react'

export type Objective = 'acquisition' | 'expansion' | 'retention'
export type ExperienceType = 'cancel_page' | 'in_app_offer' | 'pricing_table'
export type ExperienceStatus = 'draft' | 'live' | 'inactive' | 'archived'

export const OBJECTIVES: { id: Objective; label: string; blurb: string }[] = [
  { id: 'acquisition', label: 'Acquisition', blurb: 'Turn trials and visitors into paying subscribers.' },
  { id: 'expansion', label: 'Expansion', blurb: 'Move subscribers to bigger plans, annual terms and add-ons.' },
  { id: 'retention', label: 'Retention', blurb: 'Keep subscribers who are about to leave.' },
]

export const TYPE_LABEL: Record<ExperienceType, string> = {
  cancel_page: 'Cancel page',
  in_app_offer: 'In-app offer',
  pricing_table: 'Pricing table',
}

export const TYPE_ICON: Record<ExperienceType, SIconName> = {
  cancel_page: 'log-out',
  in_app_offer: 'layout',
  pricing_table: 'table',
}

/** Cancel pages only exist for retention. */
export function typesFor(objective: Objective): ExperienceType[] {
  return objective === 'retention' ? ['cancel_page', 'in_app_offer', 'pricing_table'] : ['in_app_offer', 'pricing_table']
}

export function objectiveLabel(o: Objective): string {
  return OBJECTIVES.find((x) => x.id === o)?.label ?? o
}

// ---------- Library: offers ----------

export type OfferWidget = 'modal' | 'popup' | 'banner' | 'la_card'
export type OfferCategory =
  | 'discount'
  | 'pause'
  | 'plan_change'
  | 'extension'
  | 'skip'
  | 'addon'
  | 'trial_conversion'
  | 'annual_upgrade'
  | 'support'
  | 'feedback'
  | 'credits'
  | 'multi'
export type OfferProcessing = 'billing_update' | 'checkout' | 'url_redirect' | 'webhook' | 'email'
export type AcceptStep = 'confirmation' | 'link' | 'feedback' | 'dismiss'
export type LibraryStatus = 'draft' | 'published' | 'archived'

export const WIDGET_LABEL: Record<OfferWidget, string> = {
  modal: 'Modal',
  popup: 'Pop-up',
  banner: 'Banner',
  la_card: 'Loss aversion card',
}

export const CATEGORY_LABEL: Record<OfferCategory, string> = {
  discount: 'Discount',
  pause: 'Pause',
  plan_change: 'Plan change',
  extension: 'Extension',
  skip: 'Skip a cycle',
  addon: 'Add-on',
  trial_conversion: 'Trial conversion',
  annual_upgrade: 'Annual upgrade',
  support: 'Support',
  feedback: 'Feedback',
  credits: 'Credits',
  multi: 'Multiple offers',
}

export const PROCESSING_LABEL: Record<OfferProcessing, string> = {
  billing_update: 'Update the subscription in Billing',
  checkout: 'Send to hosted checkout',
  url_redirect: 'Redirect to a URL',
  webhook: 'Send a webhook',
  email: 'Email your team',
}

export const ACCEPT_LABEL: Record<AcceptStep, string> = {
  confirmation: 'Show a confirmation',
  link: 'Open a link',
  feedback: 'Ask for feedback',
  dismiss: 'Close the offer',
}

export interface LibOffer {
  id: string
  name: string
  objective: Objective
  widget: OfferWidget
  category: OfferCategory
  title: string
  description: string
  cta: string
  processing: OfferProcessing
  acceptStep: AcceptStep
  /** The value the subscriber gets, in words ("25% off for 3 months"). */
  value: string
  redemptions: number
  languages: string[]
  status: LibraryStatus
  updatedAt: number
}

// ---------- Library: pricing tables ----------

export interface PricingPlan {
  id: string
  name: string
  price: number
  period: 'month' | 'year'
  features: string[]
  highlight?: boolean
}

export interface LibPricingTable {
  id: string
  name: string
  objective: Objective
  plans: PricingPlan[]
  frequency: 'monthly' | 'yearly' | 'both'
  hideCurrentPlan: boolean
  cta: 'checkout' | 'contact'
  /** Overrides the account brand colour on this table only. */
  accent?: string
  status: LibraryStatus
  updatedAt: number
}

export const CATALOG_PLANS: PricingPlan[] = [
  { id: 'starter-m', name: 'Starter', price: 19, period: 'month', features: ['1 workspace', 'Email support'] },
  { id: 'growth-m', name: 'Growth', price: 49, period: 'month', features: ['5 workspaces', 'Priority support', 'Reports'], highlight: true },
  { id: 'scale-m', name: 'Scale', price: 129, period: 'month', features: ['Unlimited workspaces', 'SSO', 'Dedicated manager'] },
  { id: 'starter-y', name: 'Starter annual', price: 190, period: 'year', features: ['1 workspace', 'Email support', '2 months free'] },
  { id: 'growth-y', name: 'Growth annual', price: 490, period: 'year', features: ['5 workspaces', 'Priority support', 'Reports', '2 months free'], highlight: true },
  { id: 'scale-y', name: 'Scale annual', price: 1290, period: 'year', features: ['Unlimited workspaces', 'SSO', 'Dedicated manager', '2 months free'] },
]

// ---------- Library: components ----------

export interface RedirectPage {
  id: string
  name: string
  headline: string
  body: string
  buttonLabel: string
  url: string
}

export interface SurveyReason {
  code: string
  label: string
}

export interface LossAversionCard {
  id: string
  name: string
  title: string
  items: string[]
}

// ---------- Experiences (in-app offers and pricing tables) ----------

export type TriggerKind = 'any_page' | 'url' | 'event'

export interface Trigger {
  kind: TriggerKind
  /** URL fragment or event name. */
  value?: string
}

/** Acquisition and Expansion. Retention is the cancel experience, which has its own model. */
export type GrowthObjective = Exclude<Objective, 'retention'>
export type GrowthType = Exclude<ExperienceType, 'cancel_page'>

export const GROWTH_OBJECTIVES: GrowthObjective[] = ['acquisition', 'expansion']

/** What a subscriber sees and when. Who sees it, the split and the control group live on the play. */
export interface GrowthExperience {
  id: string
  name: string
  /** Home tab: where it shows while no play uses it. Plays in either tab can use it. */
  objective: GrowthObjective
  type: GrowthType
  /** The Library offer or pricing table it shows. Null until one is picked. */
  refId: string | null
  trigger: Trigger
  updatedAt: number
  /** When it was put in the archive. */
  archivedAt?: number
}

export const TRIGGER_LABEL: Record<TriggerKind, string> = {
  any_page: 'Any page in your app',
  url: 'A page URL contains',
  event: 'A tracked event fires',
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  if (days < 60) return `${days} d ago`
  return `${Math.round(days / 30)} months ago`
}
