import type { SIconName } from '@chargebee/sting-react'
import { CONCIERGE } from '../layout/layoutMode'

export type NavLeafId =
  | 'home'
  | 'experiences.acquisition'
  | 'experiences.expansion'
  | 'experiences.retention'
  | 'experiences.offer'
  | 'library.offers'
  | 'library.pricing_tables'
  | 'library.templates'
  | 'library.components'
  | 'library.brand'
  | 'plays.acquisition'
  | 'plays.expansion'
  | 'plays.retention'
  | 'offers.in_app'
  | 'offers.pricing_tables'
  | 'experiences.branding'
  | 'experiences.pages'
  | 'experiences.loss_aversion'
  | 'experiences.survey'
  | 'experiences.redirect'
  | 'experiences.cancel'
  | 'people.audiences'
  | 'people.engaged'
  | 'renewal'
  | 'reports.cancels'
  | 'reports.offer'
  | 'reports.experience'
  | 'reports.cohort'
  | 'reports.lift'
  | 'settings'

export type NavGroupId = 'plays' | 'offers' | 'experiences' | 'library' | 'people' | 'reports'

export interface NavLeaf {
  id: NavLeafId
  label: string
  icon: SIconName
}

export interface NavGroup {
  id: NavGroupId
  label: string
  icon: SIconName
  children: NavLeaf[]
}

export type NavEntry =
  | { kind: 'group'; group: NavGroup }
  | { kind: 'leaf'; leaf: NavLeaf }

const BASE_NAV: NavEntry[] = [
  {
    kind: 'group',
    group: {
      id: 'plays',
      label: 'Plays',
      icon: 'target',
      children: [
        { id: 'plays.acquisition', label: 'Acquisition', icon: 'rocket' },
        { id: 'plays.expansion', label: 'Expansion', icon: 'arrow-up-right' },
        { id: 'plays.retention', label: 'Retention', icon: 'repeat' },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      id: 'offers',
      label: 'Offers',
      icon: 'gift',
      children: [
        { id: 'offers.in_app', label: 'In-app', icon: 'layout' },
        { id: 'offers.pricing_tables', label: 'Pricing Tables', icon: 'table' },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      id: 'experiences',
      label: 'Experiences',
      icon: 'layers',
      children: [
        { id: 'experiences.branding', label: 'Branding', icon: 'palette' },
        { id: 'experiences.pages', label: 'Pages', icon: 'file-text' },
        { id: 'experiences.loss_aversion', label: 'Loss aversion cards', icon: 'layout-list' },
        { id: 'experiences.survey', label: 'Survey reasons', icon: 'message-square' },
        { id: 'experiences.redirect', label: 'Redirect pages', icon: 'external-link' },
        { id: 'experiences.cancel', label: 'Cancel experience', icon: 'sparkles' },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      id: 'people',
      label: 'People',
      icon: 'users',
      children: [
        { id: 'people.audiences', label: 'Audiences', icon: 'user-search' },
        { id: 'people.engaged', label: 'Engaged subscribers', icon: 'users-round' },
      ],
    },
  },
  { kind: 'leaf', leaf: { id: 'renewal', label: 'Renewal Optimization', icon: 'repeat' } },
  {
    kind: 'group',
    group: {
      id: 'reports',
      label: 'Reports',
      icon: 'bar-chart',
      children: [
        { id: 'reports.cancels', label: 'Cancels', icon: 'circle' },
        { id: 'reports.offer', label: 'Offer Performance', icon: 'percent' },
        { id: 'reports.experience', label: 'Experience Performance', icon: 'sparkles' },
        { id: 'reports.cohort', label: 'Retained Revenue Coh.', icon: 'users' },
        { id: 'reports.lift', label: 'Lift Report', icon: 'bar-chart' },
      ],
    },
  },
  { kind: 'leaf', leaf: { id: 'settings', label: 'Settings', icon: 'settings' } },
]

/** Concierge: plays and experiences are one layer, and offers and pricing tables sit in the Library. */
const CONCIERGE_NAV: NavEntry[] = [
  { kind: 'leaf', leaf: { id: 'home', label: 'Home', icon: 'home' } },
  {
    kind: 'group',
    group: {
      id: 'experiences',
      label: 'Experiences',
      icon: 'target',
      children: [
        { id: 'experiences.acquisition', label: 'Acquisition', icon: 'rocket' },
        { id: 'experiences.expansion', label: 'Expansion', icon: 'arrow-up-right' },
        { id: 'experiences.retention', label: 'Retention', icon: 'repeat' },
      ],
    },
  },
  {
    kind: 'group',
    group: {
      id: 'library',
      label: 'Library',
      icon: 'library',
      children: [
        { id: 'library.offers', label: 'Offers', icon: 'gift' },
        { id: 'library.pricing_tables', label: 'Pricing tables', icon: 'table' },
        { id: 'library.templates', label: 'Templates', icon: 'layout-template' },
        { id: 'library.components', label: 'Components', icon: 'layout-list' },
        { id: 'library.brand', label: 'Brand', icon: 'palette' },
      ],
    },
  },
  ...BASE_NAV.slice(3),
]

export const NAV: NavEntry[] = CONCIERGE ? CONCIERGE_NAV : BASE_NAV

/** Workspaces reached from a list, never from the nav. */
const HIDDEN_LEAVES: NavLeafId[] = CONCIERGE ? ['experiences.cancel', 'experiences.offer'] : []

export const DEFAULT_ROUTE: NavLeafId = CONCIERGE ? 'home' : 'plays.acquisition'
export const CANCEL_ROUTE: NavLeafId = 'experiences.cancel'

export function groupOf(id: NavLeafId): NavGroupId | null {
  const [head] = id.split('.')
  if (
    head === 'plays' ||
    head === 'offers' ||
    head === 'experiences' ||
    head === 'library' ||
    head === 'people' ||
    head === 'reports'
  ) {
    return head
  }
  return null
}

export function labelOf(id: NavLeafId): string {
  if (id === 'experiences.cancel') return 'Cancel page'
  if (id === 'experiences.offer') return 'Experience'
  for (const entry of NAV) {
    if (entry.kind === 'leaf' && entry.leaf.id === id) return entry.leaf.label
    if (entry.kind === 'group') {
      const hit = entry.group.children.find((c) => c.id === id)
      if (hit) return hit.label
    }
  }
  return id
}

const LEAF_IDS = new Set<NavLeafId>(
  NAV.flatMap((entry) => (entry.kind === 'leaf' ? [entry.leaf.id] : entry.group.children.map((c) => c.id))).concat(
    HIDDEN_LEAVES,
  ),
)

export function hashFor(id: NavLeafId): string {
  return `#/${id.replace(/\./g, '/')}`
}

export function routeFromHash(hash: string): NavLeafId {
  const raw = hash.replace(/^#\/?/, '').trim()
  if (!raw) return DEFAULT_ROUTE
  const id = raw.replace(/\//g, '.') as NavLeafId
  return LEAF_IDS.has(id) ? id : DEFAULT_ROUTE
}
