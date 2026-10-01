import type { SIconName } from '@chargebee/sting-react'
import { V8 } from '../layout/layoutMode'

export type NavLeafId =
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

export type NavGroupId = 'plays' | 'offers' | 'experiences' | 'people' | 'reports'

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

const ALL_NAV: NavEntry[] = [
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

/**
 * v8 covers cancel experiences only, so acquisition, expansion and their offers are left out.
 * Pages, cards, reasons and redirects live in the Retention pane's Library instead.
 */
const NOT_IN_V8 = new Set<string>([
  'plays.acquisition',
  'plays.expansion',
  'offers',
  'experiences.pages',
  'experiences.loss_aversion',
  'experiences.survey',
  'experiences.redirect',
])
const V8_LABELS: Partial<Record<NavLeafId, string>> = { 'experiences.cancel': 'Retention' }

/** v8's Retention beta nav, opened from the button at the bottom of the rail. */
export const BETA_NAV: NavEntry[] = ALL_NAV.filter((e) => !(e.kind === 'group' && NOT_IN_V8.has(e.group.id))).map((e) =>
  e.kind === 'group'
    ? {
        ...e,
        group: {
          ...e.group,
          children: e.group.children.filter((c) => !NOT_IN_V8.has(c.id)).map((c) => ({ ...c, label: V8_LABELS[c.id] ?? c.label })),
        },
      }
    : e,
)

/** v8's main nav: the live app's, with the cancel experience reached only through the beta. */
const CLASSIC_NAV: NavEntry[] = ALL_NAV.filter((e) => !(e.kind === 'leaf' && e.leaf.id === 'renewal')).map((e) =>
  e.kind === 'group' ? { ...e, group: { ...e.group, children: e.group.children.filter((c) => c.id !== 'experiences.cancel') } } : e,
)

export const NAV: NavEntry[] = V8 ? CLASSIC_NAV : ALL_NAV

export const DEFAULT_ROUTE: NavLeafId = V8 ? 'experiences.cancel' : 'plays.acquisition'
export const CANCEL_ROUTE: NavLeafId = 'experiences.cancel'
/** Where "Exit Retention beta" lands. */
export const CLASSIC_HOME: NavLeafId = 'plays.acquisition'

function leafIds(nav: NavEntry[]): NavLeafId[] {
  return nav.flatMap((entry) => (entry.kind === 'leaf' ? [entry.leaf.id] : entry.group.children.map((c) => c.id)))
}

const BETA_IDS = new Set(leafIds(BETA_NAV))

/** v8: whether `route` shows the beta nav. Routes in both navs keep the current one. */
export function betaFor(route: NavLeafId, current: boolean): boolean {
  if (!V8) return false
  if (route === CANCEL_ROUTE) return true
  return BETA_IDS.has(route) ? current : false
}

export function groupOf(id: NavLeafId): NavGroupId | null {
  const [head] = id.split('.')
  if (head === 'plays' || head === 'offers' || head === 'experiences' || head === 'people' || head === 'reports') {
    return head
  }
  return null
}

export function labelOf(id: NavLeafId): string {
  for (const entry of V8 ? [...BETA_NAV, ...NAV] : NAV) {
    if (entry.kind === 'leaf' && entry.leaf.id === id) return entry.leaf.label
    if (entry.kind === 'group') {
      const hit = entry.group.children.find((c) => c.id === id)
      if (hit) return hit.label
    }
  }
  return id
}

const LEAF_IDS = new Set<NavLeafId>([...leafIds(NAV), ...(V8 ? BETA_IDS : [])])

export function hashFor(id: NavLeafId): string {
  return `#/${id.replace(/\./g, '/')}`
}

export function routeFromHash(hash: string): NavLeafId {
  const raw = hash.replace(/^#\/?/, '').trim()
  if (!raw) return DEFAULT_ROUTE
  const id = raw.replace(/\//g, '.') as NavLeafId
  return LEAF_IDS.has(id) ? id : DEFAULT_ROUTE
}
