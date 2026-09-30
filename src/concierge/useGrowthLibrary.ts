import { create } from 'zustand'
import {
  CATALOG_PLANS,
  newId,
  type LibOffer,
  type LibPricingTable,
  type LossAversionCard,
  type RedirectPage,
  type SurveyReason,
} from './model'

const KEY = 'cancel-experience:library:concierge'
const DAY = 86_400_000

const SEED_OFFERS: LibOffer[] = [
  {
    id: 'off_trial7',
    name: 'Trial to paid: 20% off first 3 months',
    objective: 'acquisition',
    widget: 'modal',
    category: 'trial_conversion',
    title: 'Keep everything you set up',
    description: 'Your trial ends in 3 days. Upgrade now and get 20% off your first 3 months.',
    cta: 'Upgrade now',
    processing: 'checkout',
    acceptStep: 'confirmation',
    value: '20% off for 3 months',
    redemptions: 412,
    languages: ['English'],
    status: 'published',
    updatedAt: Date.now() - 40 * DAY,
  },
  {
    id: 'off_trialext',
    name: 'Trial extension: 7 more days',
    objective: 'acquisition',
    widget: 'banner',
    category: 'extension',
    title: 'Need a little more time?',
    description: 'Take 7 more days to try everything.',
    cta: 'Extend my trial',
    processing: 'billing_update',
    acceptStep: 'confirmation',
    value: '7 extra trial days',
    redemptions: 128,
    languages: ['English'],
    status: 'published',
    updatedAt: Date.now() - 22 * DAY,
  },
  {
    id: 'off_annual',
    name: 'Switch to annual: 2 months free',
    objective: 'expansion',
    widget: 'popup',
    category: 'annual_upgrade',
    title: 'Get 2 months free',
    description: 'Pay yearly and save the cost of 2 months.',
    cta: 'Switch to annual',
    processing: 'checkout',
    acceptStep: 'confirmation',
    value: '2 months free on annual',
    redemptions: 236,
    languages: ['English', 'German'],
    status: 'published',
    updatedAt: Date.now() - 14 * DAY,
  },
  {
    id: 'off_addon',
    name: 'Reports add-on',
    objective: 'expansion',
    widget: 'modal',
    category: 'addon',
    title: 'See where revenue comes from',
    description: 'Add advanced reports to your plan for $9 a month.',
    cta: 'Add reports',
    processing: 'billing_update',
    acceptStep: 'confirmation',
    value: '$9/month add-on',
    redemptions: 61,
    languages: ['English'],
    status: 'draft',
    updatedAt: Date.now() - 3 * DAY,
  },
  {
    id: 'off_save25',
    name: 'Save offer: 25% off for 3 months',
    objective: 'retention',
    widget: 'la_card',
    category: 'discount',
    title: 'Stay and save 25%',
    description: 'Keep your plan at 25% off for the next 3 months.',
    cta: 'Keep my plan',
    processing: 'billing_update',
    acceptStep: 'confirmation',
    value: '25% off for 3 months',
    redemptions: 893,
    languages: ['English', 'French', 'German'],
    status: 'published',
    updatedAt: Date.now() - 60 * DAY,
  },
  {
    id: 'off_pause',
    name: 'Pause for up to 2 months',
    objective: 'retention',
    widget: 'la_card',
    category: 'pause',
    title: 'Take a break instead',
    description: 'Pause billing for up to 2 months. Everything stays as you left it.',
    cta: 'Pause my plan',
    processing: 'billing_update',
    acceptStep: 'confirmation',
    value: 'Pause up to 2 months',
    redemptions: 540,
    languages: ['English'],
    status: 'published',
    updatedAt: Date.now() - 31 * DAY,
  },
  {
    id: 'off_support',
    name: 'Talk to support',
    objective: 'retention',
    widget: 'modal',
    category: 'support',
    title: 'Something not working?',
    description: 'Our team can usually fix it in a day.',
    cta: 'Talk to us',
    processing: 'url_redirect',
    acceptStep: 'link',
    value: 'Support call',
    redemptions: 74,
    languages: ['English'],
    status: 'published',
    updatedAt: Date.now() - 9 * DAY,
  },
]

const SEED_TABLES: LibPricingTable[] = [
  {
    id: 'pt_signup',
    name: 'Sign-up pricing',
    objective: 'acquisition',
    plans: CATALOG_PLANS.filter((p) => p.period === 'month'),
    frequency: 'both',
    hideCurrentPlan: false,
    cta: 'checkout',
    status: 'published',
    updatedAt: Date.now() - 50 * DAY,
  },
  {
    id: 'pt_upgrade',
    name: 'Upgrade to Scale',
    objective: 'expansion',
    plans: CATALOG_PLANS.filter((p) => p.id === 'growth-m' || p.id === 'scale-m'),
    frequency: 'monthly',
    hideCurrentPlan: true,
    cta: 'checkout',
    status: 'published',
    updatedAt: Date.now() - 12 * DAY,
  },
  {
    id: 'pt_downgrade',
    name: 'Cheaper plans for leavers',
    objective: 'retention',
    plans: CATALOG_PLANS.filter((p) => p.id === 'starter-m' || p.id === 'starter-y'),
    frequency: 'both',
    hideCurrentPlan: true,
    cta: 'checkout',
    status: 'draft',
    updatedAt: Date.now() - 5 * DAY,
  },
]

const SEED_REASONS: SurveyReason[] = [
  { code: 'too_expensive', label: 'It costs too much' },
  { code: 'not_using', label: 'I’m not using it enough' },
  { code: 'missing_feature', label: 'It’s missing something I need' },
  { code: 'switching', label: 'I’m switching to another product' },
  { code: 'technical', label: 'Something isn’t working' },
  { code: 'temporary', label: 'I only needed it for a while' },
  { code: 'other', label: 'Something else' },
]

const SEED_CARDS: LossAversionCard[] = [
  {
    id: 'la_keep',
    name: 'What you keep',
    title: 'Here’s what you’ll lose',
    items: ['Your saved projects', 'Team access for 5 people', 'Your reports history'],
  },
  {
    id: 'la_usage',
    name: 'Your usage this year',
    title: 'You’ve done a lot this year',
    items: ['1,240 invoices sent', '38 hours saved', '12 teammates invited'],
  },
]

const SEED_REDIRECTS: RedirectPage[] = [
  {
    id: 'rd_help',
    name: 'Help centre',
    headline: 'Let’s fix it first',
    body: 'Most problems are solved in our help centre in a few minutes.',
    buttonLabel: 'Open the help centre',
    url: 'https://example.com/help',
  },
]

interface LibraryState {
  offers: LibOffer[]
  pricingTables: LibPricingTable[]
  reasons: SurveyReason[]
  cards: LossAversionCard[]
  redirects: RedirectPage[]
  addOffer: (o: Omit<LibOffer, 'id' | 'updatedAt' | 'redemptions'>) => LibOffer
  updateOffer: (id: string, patch: Partial<LibOffer>) => void
  addPricingTable: (t: Omit<LibPricingTable, 'id' | 'updatedAt'>) => LibPricingTable
  updatePricingTable: (id: string, patch: Partial<LibPricingTable>) => void
  setReasons: (reasons: SurveyReason[]) => void
  updateCard: (id: string, patch: Partial<LossAversionCard>) => void
  addRedirect: (r: Omit<RedirectPage, 'id'>) => RedirectPage
  updateRedirect: (id: string, patch: Partial<RedirectPage>) => void
}

type Persisted = Pick<LibraryState, 'offers' | 'pricingTables' | 'reasons' | 'cards' | 'redirects'>

function load(): Persisted {
  const seed = { offers: SEED_OFFERS, pricingTables: SEED_TABLES, reasons: SEED_REASONS, cards: SEED_CARDS, redirects: SEED_REDIRECTS }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed
    return { ...seed, ...(JSON.parse(raw) as Partial<Persisted>) }
  } catch {
    return seed
  }
}

export const useGrowthLibrary = create<LibraryState>((set) => ({
  ...load(),
  addOffer: (o) => {
    const offer: LibOffer = { ...o, id: newId('off'), redemptions: 0, updatedAt: Date.now() }
    set((s) => ({ offers: [offer, ...s.offers] }))
    return offer
  },
  updateOffer: (id, patch) =>
    set((s) => ({ offers: s.offers.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: Date.now() } : o)) })),
  addPricingTable: (t) => {
    const table: LibPricingTable = { ...t, id: newId('pt'), updatedAt: Date.now() }
    set((s) => ({ pricingTables: [table, ...s.pricingTables] }))
    return table
  },
  updatePricingTable: (id, patch) =>
    set((s) => ({
      pricingTables: s.pricingTables.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)),
    })),
  setReasons: (reasons) => set({ reasons }),
  updateCard: (id, patch) => set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
  addRedirect: (r) => {
    const page = { ...r, id: newId('rd') }
    set((s) => ({ redirects: [...s.redirects, page] }))
    return page
  },
  updateRedirect: (id, patch) =>
    set((s) => ({ redirects: s.redirects.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
}))

useGrowthLibrary.subscribe((s) => {
  const { offers, pricingTables, reasons, cards, redirects } = s
  try {
    localStorage.setItem(KEY, JSON.stringify({ offers, pricingTables, reasons, cards, redirects }))
  } catch {
    /* storage full or blocked */
  }
})
