import { uid } from './id'
import type { Play } from '../types/orchestration'

/**
 * Sentinel id for the single Experience the composer currently edits. Every
 * treatment flow node points here for now; a future slice gives each flow its
 * own Experience.
 */
export const PRIMARY_EXPERIENCE_ID = 'primary'

/** Seed a default Play whose treatment routes into the primary cancel flow. */
export function seedPlay(): Play {
  return {
    id: uid('play'),
    name: 'Cancel Experience',
    playType: 'CHURN_PREVENTION',
    presentation: 'modal',
    priority: 1,
    active: true,
    enabled: true,
    publishState: 'draft',
    audience: {
      id: uid('rule'),
      name: 'Paying subscribers',
      ruleType: 'TARGETING',
      savedAudienceId: 'all_paying',
      match: 'AND',
      conditions: [
        { id: uid('cond'), property: 'Subscription status', operator: 'is', value: 'Active' },
        { id: uid('cond'), property: 'MRR', operator: 'gt', value: '0' },
      ],
      expression: 'subscription.status = active AND mrr > 0',
    },
    trigger: {
      type: 'page_load',
      moment: 'custom_page',
      label: 'Custom page load',
      expression: '/account/cancel',
    },
    targeting: {
      id: uid('split'),
      kind: 'split',
      name: 'Traffic split',
      // Default: show a single cancel experience to everyone in the audience.
      // A/B variants + holdout and sub-audiences are added via the mode toggle.
      mode: 'single',
      branches: [
        {
          id: uid('branch'),
          name: 'primary',
          percent: 100,
          node: {
            id: uid('flow'),
            kind: 'flow',
            name: 'Cancel experience',
            target: 'CANCEL_PAGE',
            experienceId: PRIMARY_EXPERIENCE_ID,
          },
        },
      ],
    },
  }
}
