import type { Objective } from './useWorkspaceUi'

/** Acquisition and expansion plays, shown read-only. This prototype builds cancel pages only. */
export interface OtherPlay {
  id: string
  objective: Exclude<Objective, 'retention'>
  name: string
  playType: 'In-app offer' | 'Pricing table'
  live: boolean
  daysAgo: number
  description: string
  audience: string
  trigger: string
  actions: string[]
  control: string
}

export const OTHER_PLAYS: OtherPlay[] = [
  {
    id: 'acq-annual-pricing',
    objective: 'acquisition',
    name: 'Annual plan pricing table',
    playType: 'Pricing table',
    live: true,
    daysAgo: 6,
    description: 'Leads with the annual price on the public pricing page.',
    audience: 'Target all visitors',
    trigger: 'None. Pricing tables show wherever they are embedded.',
    actions: ['Test: Annual first 50%, Monthly first 50%'],
    control: 'No play control',
  },
  {
    id: 'acq-trial-offer',
    objective: 'acquisition',
    name: 'Trial to paid offer',
    playType: 'In-app offer',
    live: false,
    daysAgo: 13,
    description: 'Offers 20% off the first paid month three days before a trial ends.',
    audience: 'In-trial (active)',
    trigger: 'Page load: /app/billing',
    actions: ['Single: 20% off first month'],
    control: 'Play control 10%',
  },
  {
    id: 'exp-seat-addon',
    objective: 'expansion',
    name: 'Extra seats nudge',
    playType: 'In-app offer',
    live: true,
    daysAgo: 3,
    description: 'Suggests a seat add-on when a team is close to its seat limit.',
    audience: 'Seats used is greater than 80%',
    trigger: 'Page load: /app/team',
    actions: ['Sub-audiences: Teams on Pro get 5 seats, everyone else gets 2 seats'],
    control: 'Play control 5%',
  },
  {
    id: 'exp-upgrade-pro',
    objective: 'expansion',
    name: 'Upgrade to Pro pricing table',
    playType: 'Pricing table',
    live: false,
    daysAgo: 21,
    description: 'Shows Pro and Enterprise side by side on the in-app plans page.',
    audience: 'Plan is Starter',
    trigger: 'None. Pricing tables show wherever they are embedded.',
    actions: ['Single: Pro and Enterprise table'],
    control: 'No play control',
  },
]
