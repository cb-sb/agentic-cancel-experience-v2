import { hasSplit, splitProblem } from '../../plays/resolve'
import { toast, type MenuItem } from '../../plays/ui'
import { TYPE_ICON, TYPE_LABEL, objectiveLabel, type GrowthExperience, type GrowthObjective, type GrowthType } from '../model'
import { addGrowthExperience, experiencesFor, growthExperience, updateGrowthExperience, useGrowthExperiences, visibleIn } from '../useGrowthExperiences'
import { useGrowthLibrary } from '../useGrowthLibrary'
import { addToGrowthPlay, type GrowthPlay } from '../useGrowthPlays'
import type { GrowthTemplate } from './templates'
import { openGrowthExperience } from './useGrowthUi'

export const GROWTH_TYPES: GrowthType[] = ['in_app_offer', 'pricing_table']

/** Experiences a play could add: this tab's first, then the other tab's, which join as shared. */
export function existingExperienceItems(play: GrowthPlay, items: GrowthExperience[], plays: GrowthPlay[]): MenuItem[] {
  const other = play.objective === 'acquisition' ? 'expansion' : 'acquisition'
  const notHere = (x: GrowthExperience) => !play.variants.some((v) => v.experienceId === x.id)
  const here = experiencesFor(items, plays, play.objective).filter(notHere)
  const there = experiencesFor(items, plays, other).filter((x) => notHere(x) && !visibleIn(x, play.objective, plays))
  return [...here, ...there].map((x) => ({
    label: x.name,
    icon: 'corner-down-right',
    hint: here.includes(x) ? TYPE_LABEL[x.type] : `${TYPE_LABEL[x.type]} · From ${objectiveLabel(other)}`,
    onClick: () => {
      addToGrowthPlay(play.id, x.id)
      toast(`Added ${x.name} to ${play.name}`)
    },
  }))
}

/** A blank experience, open on its doorway. With `playId` it also joins that play. */
export function newGrowthExperience(objective: GrowthObjective, type: GrowthType, playId: string | null = null): string {
  const x = addGrowthExperience(objective, type)
  if (playId) addToGrowthPlay(playId, x.id)
  openGrowthExperience(objective, x.id, playId)
  return x.id
}

export function newExperienceItems(objective: GrowthObjective, playId: string | null = null): MenuItem[] {
  return GROWTH_TYPES.map((type) => ({
    label: TYPE_LABEL[type],
    icon: TYPE_ICON[type],
    hint: type === 'in_app_offer' ? 'A modal, pop-up or banner in your app' : 'Plans to pick from, in your app or on your site',
    onClick: () => newGrowthExperience(objective, type, playId),
  }))
}

/** Copies the template into the Library, then fills `fillId` with it or makes a new experience. */
export function startFromTemplate(objective: GrowthObjective, t: GrowthTemplate, fillId: string | null) {
  const lib = useGrowthLibrary.getState()
  const refId =
    t.type === 'pricing_table'
      ? lib.addPricingTable({ ...t.table!, name: t.name, objective, status: 'published' }).id
      : lib.addOffer({ ...t.offer!, name: t.name, objective, status: 'published', languages: ['English'] }).id
  const fill = fillId ? growthExperience(fillId) : undefined
  if (fill && fill.type === t.type) {
    updateGrowthExperience(fill.id, { refId })
    openGrowthExperience(objective, fill.id)
    return
  }
  const x = addGrowthExperience(objective, t.type, { name: t.name, refId })
  openGrowthExperience(objective, x.id)
}

export function experienceName(id: string): string {
  return useGrowthExperiences.getState().items.find((i) => i.id === id)?.name ?? 'Experience'
}

/** The Library item an experience shows, by name. */
export function refName(x: GrowthExperience): string | null {
  if (!x.refId) return null
  const lib = useGrowthLibrary.getState()
  return (x.type === 'pricing_table' ? lib.pricingTables : lib.offers).find((r) => r.id === x.refId)?.name ?? null
}

export interface PlayCheck {
  id: string
  label: string
  passed: boolean
  /** What to do when it hasn't passed. */
  fix: string
  /** 'variants' and 'split' are fixed in Configure. */
  item: string
  openExperienceId?: string
}

/** What has to pass before a play goes live. */
export function growthPlayChecks(play: GrowthPlay): PlayCheck[] {
  const items = useGrowthExperiences.getState().items
  const empty = play.variants.map((v) => items.find((i) => i.id === v.experienceId)).filter((x) => !x || !x.refId || !refName(x))
  const checks: PlayCheck[] = [
    {
      id: 'variants',
      label: 'It has at least one experience',
      passed: play.variants.length > 0,
      fix: 'Add the experience this play shows.',
      item: 'variants',
    },
  ]
  if (play.variants.length > 0) {
    const first = empty[0]
    checks.push({
      id: 'content',
      label: 'Every experience shows an offer or pricing table',
      passed: empty.length === 0,
      fix: empty.length === 1 && first ? `${first.name} has nothing to show yet.` : `${empty.length} experiences have nothing to show yet.`,
      item: 'content',
      openExperienceId: first?.id,
    })
  }
  if (hasSplit(play)) {
    const problem = splitProblem(play)
    checks.push({ id: 'split', label: 'Traffic split adds up', passed: problem === null, fix: problem ?? '', item: 'split' })
  }
  checks.push({
    id: 'control',
    label: 'The control group is 50% or less',
    passed: play.control >= 0 && play.control <= 50,
    fix: 'Lower the control group.',
    item: 'control',
  })
  return checks
}
