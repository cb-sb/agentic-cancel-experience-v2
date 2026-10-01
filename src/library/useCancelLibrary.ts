import { create } from 'zustand'
import type { AfterAccept, OfferFulfilment, OfferKey } from '../journey/types'
import { OFFER_VARIANTS } from '../lib/offerVariants'
import { uniqueName } from '../plays/names'

const KEY = 'cancel-experience:library:v8'

/** What billing does when an offer is accepted. */
export const OFFER_ACTIONS: { id: string; label: string }[] = [
  { id: 'coupon', label: 'Apply a coupon' },
  { id: 'pause', label: 'Pause the subscription' },
  { id: 'plan', label: 'Change the plan' },
  { id: 'extend', label: 'Extend the term' },
  { id: 'skip', label: 'Skip the next renewal' },
  { id: 'addon', label: 'Add an add-on' },
  { id: 'tag', label: 'Tag the customer' },
  { id: 'notify', label: 'Tell their account manager' },
]

const DEFAULT_ACTION: Record<OfferKey, string> = {
  discount: 'coupon',
  pause: 'pause',
  plan_change: 'plan',
  extension: 'extend',
  skip: 'skip',
  addon: 'addon',
}

export interface LibOffer {
  id: string
  name: string
  type: OfferKey
  title: string
  description: string
  cta: string
  fulfilment: OfferFulfilment
  fulfilmentTarget: string
  actions: string[]
  afterAccept: AfterAccept
}

export type ReasonKind = 'standard' | 'competitor' | 'return'

export interface LibReason {
  id: string
  label: string
  kind: ReasonKind
  /** Standard reasons: an optional question after it's picked. */
  followUp: string
  /** Competitor pulse: the products people can name. */
  options: string[]
}

export interface LibCard {
  id: string
  name: string
  title: string
  keep: string[]
  lose: string[]
}

export interface LibConfirmation {
  id: string
  name: string
  kind: 'saved' | 'cancelled'
  title: string
  body: string
  cta: string
  url: string
}

export interface LibRedirect {
  id: string
  name: string
  url: string
}

interface CancelLibrary {
  offers: LibOffer[]
  reasons: LibReason[]
  cards: LibCard[]
  confirmations: LibConfirmation[]
  redirects: LibRedirect[]
}

export type LibraryItems = CancelLibrary

let n = 0
const id = (p: string) => `${p}_${Date.now().toString(36)}${(n++).toString(36)}`

function seed(): CancelLibrary {
  return {
    offers: OFFER_VARIANTS.map((v) => ({
      id: `offer_${v.category}`,
      name: v.label,
      type: v.category as OfferKey,
      title: v.title,
      description: v.description,
      cta: v.primaryCta,
      fulfilment: 'billing',
      fulfilmentTarget: '',
      actions: [DEFAULT_ACTION[v.category as OfferKey]],
      afterAccept: 'confirmation',
    })),
    reasons: [
      { id: 'r_price', label: 'It costs too much', kind: 'standard', followUp: 'What price would feel right?', options: [] },
      { id: 'r_features', label: 'It’s missing something I need', kind: 'standard', followUp: 'What’s missing?', options: [] },
      { id: 'r_usage', label: 'I don’t use it enough', kind: 'standard', followUp: '', options: [] },
      { id: 'r_tech', label: 'Something isn’t working', kind: 'standard', followUp: 'What went wrong?', options: [] },
      { id: 'r_temp', label: 'I only needed it for a while', kind: 'standard', followUp: '', options: [] },
      { id: 'r_competitor', label: 'Which product are you moving to?', kind: 'competitor', followUp: '', options: ['Another tool', 'Building our own', 'Not moving to anything'] },
      { id: 'r_return', label: 'How likely are you to come back?', kind: 'return', followUp: '', options: [] },
    ],
    cards: [
      {
        id: 'card_default',
        name: 'What you’ll lose',
        title: 'Before you go, here’s what changes',
        keep: ['Your account and history'],
        lose: ['Saved projects', 'Team access', 'Priority support'],
      },
    ],
    confirmations: [
      { id: 'conf_saved', name: 'Thanks for staying', kind: 'saved', title: 'You’re all set', body: 'Your offer is applied. Nothing else to do.', cta: 'Back to my account', url: '' },
      { id: 'conf_cancelled', name: 'Cancel confirmed', kind: 'cancelled', title: 'Your subscription is cancelled', body: 'You’ll keep access until the end of your billing period.', cta: 'Done', url: '' },
    ],
    redirects: [
      { id: 'redirect_help', name: 'Help center', url: 'https://help.example.com' },
      { id: 'redirect_support', name: 'Talk to support', url: 'https://example.com/support' },
    ],
  }
}

function read(): CancelLibrary {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return seed()
    const saved = JSON.parse(raw) as Partial<CancelLibrary>
    const base = seed()
    return {
      offers: saved.offers ?? base.offers,
      reasons: saved.reasons ?? base.reasons,
      cards: saved.cards ?? base.cards,
      confirmations: saved.confirmations ?? base.confirmations,
      redirects: saved.redirects ?? base.redirects,
    }
  } catch {
    return seed()
  }
}

export const useCancelLibrary = create<CancelLibrary>(() => read())

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(useCancelLibrary.getState()))
  } catch {
    /* quota */
  }
}

type ListKey = keyof CancelLibrary
type ItemOf<K extends ListKey> = CancelLibrary[K][number]

export function patchItem<K extends ListKey>(list: K, itemId: string, change: Partial<ItemOf<K>>) {
  useCancelLibrary.setState((s) => ({ [list]: (s[list] as ItemOf<K>[]).map((x) => (x.id === itemId ? { ...x, ...change } : x)) }) as Partial<CancelLibrary>)
  write()
}

export function removeItem(list: ListKey, itemId: string) {
  useCancelLibrary.setState((s) => ({ [list]: (s[list] as { id: string }[]).filter((x) => x.id !== itemId) }) as Partial<CancelLibrary>)
  write()
}

function add<K extends ListKey>(list: K, item: ItemOf<K>): string {
  useCancelLibrary.setState((s) => ({ [list]: [item, ...(s[list] as ItemOf<K>[])] }) as Partial<CancelLibrary>)
  write()
  return item.id
}

const names = (items: { name?: string; label?: string }[]) => items.map((x) => x.name ?? x.label ?? '')

export function newOffer(): string {
  const v = OFFER_VARIANTS[0]
  return add('offers', {
    id: id('offer'),
    name: uniqueName('New offer', names(useCancelLibrary.getState().offers)),
    type: 'discount',
    title: v.title,
    description: v.description,
    cta: v.primaryCta,
    fulfilment: 'billing',
    fulfilmentTarget: '',
    actions: ['coupon'],
    afterAccept: 'confirmation',
  })
}

export function newReason(kind: ReasonKind = 'standard'): string {
  const label = kind === 'competitor' ? 'Which product are you moving to?' : kind === 'return' ? 'How likely are you to come back?' : 'New reason'
  return add('reasons', { id: id('reason'), label: uniqueName(label, names(useCancelLibrary.getState().reasons)), kind, followUp: '', options: kind === 'competitor' ? ['Another tool'] : [] })
}

export function newCard(): string {
  return add('cards', { id: id('card'), name: uniqueName('New card', names(useCancelLibrary.getState().cards)), title: 'Before you go', keep: [''], lose: [''] })
}

export function newConfirmation(): string {
  return add('confirmations', { id: id('conf'), name: uniqueName('New confirmation', names(useCancelLibrary.getState().confirmations)), kind: 'cancelled', title: 'Your subscription is cancelled', body: '', cta: 'Done', url: '' })
}

export function newRedirect(): string {
  return add('redirects', { id: id('redirect'), name: uniqueName('New redirect page', names(useCancelLibrary.getState().redirects)), url: '' })
}

/** Names inside one list stay unique, the same rule as plays and experiences. */
export function nameTakenIn(list: ListKey, itemId: string, name: string): boolean {
  const items = useCancelLibrary.getState()[list] as { id: string; name?: string; label?: string }[]
  const key = name.trim().toLowerCase()
  return items.some((x) => x.id !== itemId && (x.name ?? x.label ?? '').trim().toLowerCase() === key)
}
