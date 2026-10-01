import { CATALOG_PLANS, type GrowthObjective, type GrowthType, type LibOffer, type LibPricingTable } from '../model'

type OfferBody = Omit<LibOffer, 'id' | 'name' | 'objective' | 'updatedAt' | 'redemptions' | 'status' | 'languages'>
type TableBody = Omit<LibPricingTable, 'id' | 'name' | 'objective' | 'updatedAt' | 'status'>

export interface GrowthTemplate {
  id: string
  objective: GrowthObjective
  type: GrowthType
  name: string
  does: string
  offer?: OfferBody
  table?: TableBody
}

const plans = (...ids: string[]) => ids.map((id) => CATALOG_PLANS.find((p) => p.id === id)!)

export const GROWTH_TEMPLATES: GrowthTemplate[] = [
  {
    id: 'tpl_trial_discount',
    objective: 'acquisition',
    type: 'in_app_offer',
    name: 'Trial ending discount',
    does: 'A modal a few days before the trial ends, with a discount on the first months.',
    offer: {
      widget: 'modal',
      category: 'trial_conversion',
      title: 'Your trial ends in 3 days',
      description: 'Keep everything you set up. Upgrade now and get 20% off your first 3 months.',
      cta: 'Upgrade now',
      processing: 'checkout',
      acceptStep: 'confirmation',
      value: '20% off the first 3 months',
    },
  },
  {
    id: 'tpl_feature_banner',
    objective: 'acquisition',
    type: 'in_app_offer',
    name: 'Paid feature banner',
    does: 'A banner on a page with paid features, linking to your plans.',
    offer: {
      widget: 'banner',
      category: 'trial_conversion',
      title: 'Reports are on paid plans',
      description: 'Upgrade to see every report and export your data.',
      cta: 'See plans',
      processing: 'checkout',
      acceptStep: 'link',
      value: 'Unlock reports',
    },
  },
  {
    id: 'tpl_trial_extend',
    objective: 'acquisition',
    type: 'in_app_offer',
    name: 'Extend the trial',
    does: 'A pop-up that gives people who are still exploring a few more days.',
    offer: {
      widget: 'popup',
      category: 'extension',
      title: 'Need a little more time?',
      description: 'Get 7 more days to try everything before you decide.',
      cta: 'Extend my trial',
      processing: 'billing_update',
      acceptStep: 'confirmation',
      value: '7 more days',
    },
  },
  {
    id: 'tpl_three_plans',
    objective: 'acquisition',
    type: 'pricing_table',
    name: 'Three plans',
    does: 'Starter, Growth and Scale side by side, with Growth highlighted.',
    table: { plans: plans('starter-m', 'growth-m', 'scale-m'), frequency: 'both', hideCurrentPlan: false, cta: 'checkout' },
  },
  {
    id: 'tpl_annual_first',
    objective: 'acquisition',
    type: 'pricing_table',
    name: 'Annual first',
    does: 'Yearly prices up front, with two months free on every plan.',
    table: { plans: plans('starter-y', 'growth-y', 'scale-y'), frequency: 'yearly', hideCurrentPlan: false, cta: 'checkout' },
  },
  {
    id: 'tpl_switch_annual',
    objective: 'expansion',
    type: 'in_app_offer',
    name: 'Switch to annual',
    does: 'A modal for monthly payers, with two months free for paying yearly.',
    offer: {
      widget: 'modal',
      category: 'annual_upgrade',
      title: 'Get 2 months free',
      description: 'Pay yearly and get 2 months free. Same plan, same features.',
      cta: 'Switch to annual',
      processing: 'billing_update',
      acceptStep: 'confirmation',
      value: '2 months free',
    },
  },
  {
    id: 'tpl_addon',
    objective: 'expansion',
    type: 'in_app_offer',
    name: 'Add-on upsell',
    does: 'A banner where the add-on helps, with the price on the button.',
    offer: {
      widget: 'banner',
      category: 'addon',
      title: 'Add advanced reports',
      description: 'Scheduled exports and custom dashboards for $15 a month.',
      cta: 'Add for $15/month',
      processing: 'billing_update',
      acceptStep: 'confirmation',
      value: 'Advanced reports add-on',
    },
  },
  {
    id: 'tpl_seat_limit',
    objective: 'expansion',
    type: 'in_app_offer',
    name: 'Seat limit nudge',
    does: 'A pop-up when a team hits its seat limit, pointing to the next plan.',
    offer: {
      widget: 'popup',
      category: 'plan_change',
      title: 'Your team is growing',
      description: 'You have used every seat on your plan. Move up to add more people.',
      cta: 'See bigger plans',
      processing: 'checkout',
      acceptStep: 'link',
      value: 'Move up a plan',
    },
  },
  {
    id: 'tpl_upgrade_options',
    objective: 'expansion',
    type: 'pricing_table',
    name: 'Upgrade options',
    does: 'Only the plans above theirs, so the choice is about moving up.',
    table: { plans: plans('growth-m', 'scale-m'), frequency: 'monthly', hideCurrentPlan: true, cta: 'checkout' },
  },
  {
    id: 'tpl_annual_upgrade',
    objective: 'expansion',
    type: 'pricing_table',
    name: 'Annual upgrade',
    does: 'Yearly prices for the bigger plans, for teams ready to commit.',
    table: { plans: plans('growth-y', 'scale-y'), frequency: 'yearly', hideCurrentPlan: true, cta: 'checkout' },
  },
]

export function templatesFor(objective: GrowthObjective, type: GrowthType | 'all'): GrowthTemplate[] {
  return GROWTH_TEMPLATES.filter((t) => t.objective === objective && (type === 'all' || t.type === type))
}

/** A full Library item for previewing a template before it is used. */
export function previewOffer(t: GrowthTemplate): LibOffer {
  return { ...t.offer!, id: t.id, name: t.name, objective: t.objective, redemptions: 0, languages: ['English'], status: 'draft', updatedAt: Date.now() }
}

export function previewTable(t: GrowthTemplate): LibPricingTable {
  return { ...t.table!, id: t.id, name: t.name, objective: t.objective, status: 'draft', updatedAt: Date.now() }
}
