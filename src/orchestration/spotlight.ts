import type { PlanBeat } from './JourneyPlan'

/** Surfaces Copilot can point at while it talks. */
export type SpotlightId =
  | 'journey'
  | 'plan'
  | 'brand'
  | 'audience'
  | 'holdout'
  | 'offers'
  | 'walk'
  | 'upload'

export const SPOTLIGHT_LABEL: Record<SpotlightId, string> = {
  journey: 'Look at the step chain',
  plan: 'Look at the draft plan',
  brand: 'Look at brand matching',
  audience: 'Look at who this reaches',
  holdout: 'Look at holdout',
  offers: 'Look at the save offer',
  walk: 'Look at Preview',
  upload: 'Drop the file here',
}

export function spotlightForBeat(beat: PlanBeat): SpotlightId | null {
  switch (beat) {
    case 'walk':
    case 'review':
    case 'publish':
      return 'walk'
    case 'offers':
      return 'offers'
    case 'audience':
      return 'audience'
    case 'holdout':
      return 'holdout'
    case 'brand':
      return 'brand'
    case 'shell':
      return 'plan'
    default:
      return null
  }
}

export function spotlightForWidget(widget: 'plan' | 'steps' | undefined): SpotlightId | null {
  if (widget === 'steps') return 'journey'
  if (widget === 'plan') return 'plan'
  return null
}

/** Setup-tracker row that corresponds to a look-here target. */
export function trackerItemForSpotlight(
  id: SpotlightId,
): 'audience' | 'offers' | 'holdout' | 'chain' | 'brand' | 'walk' | undefined {
  switch (id) {
    case 'audience':
      return 'audience'
    case 'offers':
      return 'offers'
    case 'holdout':
      return 'holdout'
    case 'journey':
    case 'plan':
      return 'chain'
    case 'brand':
      return 'brand'
    case 'walk':
      return 'walk'
    default:
      return undefined
  }
}

export const TRACKER_SPOTLIGHTS: SpotlightId[] = [
  'journey',
  'brand',
  'audience',
  'holdout',
  'offers',
  'walk',
]
