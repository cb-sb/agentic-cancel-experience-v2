import { create } from 'zustand'
import { V10 } from '../../layout/layoutMode'
import { useGrowthShell } from '../../shell/useGrowthShell'
import { noteV10Open, useV10 } from '../../v10/useV10'
import type { GrowthObjective, GrowthType } from '../model'
import type { SoonPlace } from '../Soon'

export type GrowthPage = 'index' | 'experience' | 'play' | 'order' | 'templates' | 'offers' | 'pricing_tables' | 'brand' | 'soon' | 'archive'
export type PlayTab = 'configure' | 'summary' | 'tasks'
export type ExperienceTab = 'preview' | 'summary'

export interface GrowthView {
  page: GrowthPage
  experienceId: string | null
  playId: string | null
  playTab: PlayTab
  experienceTab: ExperienceTab
  /** A blank experience the merchant chose to start with Copilot. */
  withCopilot: boolean
  /** Templates opened from a blank experience fill that experience. */
  fillId: string | null
  templateType: GrowthType | 'all'
  /** The not-yet-built place the 'soon' page shows. */
  soon: SoonPlace | null
}

/** Where the merchant is in Acquisition and in Expansion. Each keeps its own place. */
export type GrowthPlace = Record<GrowthObjective, GrowthView>

const START: GrowthView = {
  page: 'index',
  experienceId: null,
  playId: null,
  playTab: 'configure',
  experienceTab: 'preview',
  withCopilot: false,
  fillId: null,
  templateType: 'all',
  soon: null,
}

interface GrowthUiState {
  views: GrowthPlace
  /** Experience or play id being renamed in the pane. */
  renaming: string | null
}

export const useGrowthUi = create<GrowthUiState>(() => ({
  views: { acquisition: START, expansion: START },
  renaming: null,
}))

export function useGrowthView(objective: GrowthObjective): GrowthView {
  return useGrowthUi((s) => s.views[objective])
}

export function setGrowthView(objective: GrowthObjective, patch: Partial<GrowthView>) {
  useGrowthUi.setState((s) => ({ views: { ...s.views, [objective]: { ...s.views[objective], ...patch } } }))
}

export function setRenaming(id: string | null) {
  useGrowthUi.setState({ renaming: id })
}

/** Go to a page in Acquisition or Expansion, from anywhere in the app. */
export function goGrowth(objective: GrowthObjective, patch: Partial<GrowthView>) {
  setGrowthView(objective, { withCopilot: false, ...patch })
  if (V10) {
    if (patch.page && patch.page !== 'play' && patch.page !== 'experience') useV10.getState().close()
    return
  }
  if (useGrowthShell.getState().route !== objective) useGrowthShell.getState().go(objective)
}

export function openGrowthExperience(objective: GrowthObjective, experienceId: string, playId: string | null = null) {
  goGrowth(objective, { page: 'experience', experienceId, playId })
  noteV10Open({ kind: 'experience', source: 'growth', id: experienceId, objective })
}

export function openGrowthPlay(objective: GrowthObjective, playId: string, tab?: PlayTab) {
  goGrowth(objective, { page: 'play', playId, ...(tab ? { playTab: tab } : {}) })
  noteV10Open({ kind: 'play', source: 'growth', id: playId, objective })
}

export function growthPlace(): GrowthPlace {
  return useGrowthUi.getState().views
}

export function growthKey(place?: GrowthPlace): string {
  if (!place) return ''
  const key = (v: GrowthView) => [v.page, v.experienceId ?? '', v.playId ?? '', v.withCopilot ? 1 : 0, v.soon?.id ?? ''].join(':')
  return `${key(place.acquisition)}/${key(place.expansion)}`
}

export function restoreGrowthPlace(place: GrowthPlace) {
  useGrowthUi.setState({ views: place })
}
