import { useMemo } from 'react'
import type { PlaysBackend } from '../../plays/PlaysBackend'
import type { CancelPlay } from '../../plays/types'
import type { GrowthObjective } from '../model'
import { addGrowthExperience, experiencesFor, useGrowthExperiences } from '../useGrowthExperiences'
import { growthPlayOps, useGrowthPlays, type GrowthPlay } from '../useGrowthPlays'
import { growthPlayChecks } from './actions'
import { openGrowthExperience } from './useGrowthUi'

function make(objective: GrowthObjective): PlaysBackend {
  return {
    ops: growthPlayOps,
    noun: 'experience',
    usePages: () => {
      const items = useGrowthExperiences((s) => s.items)
      const plays = useGrowthPlays((s) => s.plays)
      return useMemo(() => experiencesFor(items, plays, objective).map((x) => ({ id: x.id, title: x.name })), [items, plays])
    },
    newPage: (playId) => {
      const x = addGrowthExperience(objective, 'in_app_offer')
      openGrowthExperience(objective, x.id, playId)
      return x.id
    },
    openPage: (experienceId, playId) => openGrowthExperience(objective, experienceId, playId),
    useOpenChecks: (play: CancelPlay) => {
      useGrowthExperiences((s) => s.items)
      return growthPlayChecks(play as GrowthPlay)
        .filter((c) => !c.passed)
        .map(({ id, label, fix, item, openExperienceId }) => ({ id, label, fix, item, openExperienceId }))
    },
    controlLine: (control) =>
      control === 0 ? 'Everyone in the audience sees an experience.' : `${control}% of this audience sees nothing from this play, so you can measure what it adds.`,
  }
}

const BACKENDS: Record<GrowthObjective, PlaysBackend> = { acquisition: make('acquisition'), expansion: make('expansion') }

export const growthBackend = (objective: GrowthObjective) => BACKENDS[objective]
