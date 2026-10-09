import { useMemo } from 'react'
import type { PlaysBackend } from '../../plays/PlaysBackend'
import type { CancelPlay } from '../../plays/types'
import type { GrowthObjective } from '../model'
import { addGrowthExperience, experiencesFor, useGrowthExperiences } from '../useGrowthExperiences'
import { useGrowthLibrary } from '../useGrowthLibrary'
import { growthPlayOps, useGrowthPlays, type GrowthPlay } from '../useGrowthPlays'
import { growthPlayChecks } from './actions'
import { openGrowthExperience, openGrowthPlay, setGrowthView } from './useGrowthUi'

function make(objective: GrowthObjective): PlaysBackend {
  return {
    ops: growthPlayOps,
    noun: 'experience',
    usePages: () => {
      const items = useGrowthExperiences((s) => s.items)
      const plays = useGrowthPlays((s) => s.plays)
      return useMemo(() => experiencesFor(items, plays, objective).map((x) => ({ id: x.id, title: x.name })), [items, plays])
    },
    useComponentMap: () => {
      const items = useGrowthExperiences((s) => s.items)
      const offers = useGrowthLibrary((s) => s.offers)
      const pricingTables = useGrowthLibrary((s) => s.pricingTables)
      return useMemo(
        () =>
          Object.fromEntries(
            items.map((experience) => {
              const choices = (experience.type === 'pricing_table' ? pricingTables : offers).map((item) => ({ id: item.id, label: item.name }))
              const base = choices.find((item) => item.id === experience.refId)
              return [
                experience.id,
                [
                  {
                    id: 'primary',
                    label: experience.type === 'pricing_table' ? 'Pricing table' : 'Offer',
                    baseId: experience.refId,
                    baseLabel: base?.label ?? (experience.refId ? 'Missing library item' : 'Not selected'),
                    choices,
                  },
                ],
              ]
            }),
          ),
        [items, offers, pricingTables],
      )
    },
    newPage: (playId) => {
      const x = addGrowthExperience(objective, 'in_app_offer')
      openGrowthExperience(objective, x.id, playId)
      return x.id
    },
    openPage: (experienceId, playId) => openGrowthExperience(objective, experienceId, playId),
    openCanvas: (play) => {
      openGrowthPlay(objective, play.id, 'canvas')
      setGrowthView(objective, { canvasOpen: true })
    },
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
