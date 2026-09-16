import { isBrandMatched } from '../brand/matchSite'
import type { JourneyFile } from '../journey/types'
import { anyStepNeedsWork } from '../lib/stepNeedsWork'
import type { Experience } from '../types/experience'
import type { Play } from '../types/orchestration'

export type SetupTrack = 'play' | 'experience' | 'testing'

export type SetupItemId =
  | 'audience'
  | 'targeting'
  | 'offers'
  | 'holdout'
  | 'chain'
  | 'brand'
  | 'stepConfig'
  | 'walk'
  | 'reporting'

export interface SetupItem {
  id: SetupItemId
  track: SetupTrack
  label: string
  hint: string
  done: boolean
}

export interface SetupProgress {
  play: SetupItem[]
  experience: SetupItem[]
  testing: SetupItem[]
  playDone: number
  playTotal: number
  experienceDone: number
  experienceTotal: number
  testingDone: number
  testingTotal: number
  done: number
  total: number
  remaining: number
  percent: number
  next: SetupItem | null
  gaps: string[]
  ready: boolean
}

export type ConfirmedSetup = Partial<Record<SetupItemId, boolean>>

function hasSplit(play: Play): boolean {
  return play.targeting.kind === 'split' && play.targeting.mode !== 'single'
}

function offersReady(file: JourneyFile): boolean {
  const offers = file.steps.filter((s) => s.kind === 'offer')
  if (offers.length === 0) return true
  return offers.every((s) => Boolean(s.offer))
}

export function setupProgress(args: {
  file: JourneyFile
  play: Play
  experience: Experience | undefined
  confirmed: ConfirmedSetup
  walkedOrSkipped: boolean
  stepStripShown: boolean
  dismissedStepNeedsWork: boolean
}): SetupProgress {
  const { file, play, experience, confirmed, walkedOrSkipped, stepStripShown, dismissedStepNeedsWork } =
    args
  const offerSteps = file.steps.filter((s) => s.kind === 'offer')
  const split = hasSplit(play)
  const stepsReady =
    dismissedStepNeedsWork || !experience || !anyStepNeedsWork(experience.steps, file)

  const playItems: SetupItem[] = [
    {
      id: 'audience',
      track: 'play',
      label: 'Audience',
      hint: 'Who this experience reaches',
      done: Boolean(confirmed.audience) || file.audience !== 'all',
    },
  ]
  if (split) {
    playItems.push({
      id: 'targeting',
      track: 'play',
      label: 'Targeting',
      hint: 'How traffic is divided',
      done: Boolean(confirmed.targeting),
    })
  }
  if (offerSteps.length > 0) {
    playItems.push({
      id: 'offers',
      track: 'play',
      label: 'Offers',
      hint: 'Save mechanic on every offer step',
      done: offersReady(file),
    })
  }
  playItems.push({
    id: 'holdout',
    track: 'play',
    label: 'Holdout',
    hint: 'Who skips this experience',
    done: Boolean(confirmed.holdout) || file.holdout !== 0,
  })

  const experienceItems: SetupItem[] = [
    {
      id: 'chain',
      track: 'experience',
      label: 'Step chain',
      hint: 'The screens a subscriber walks',
      done: stepStripShown && file.steps.length > 0,
    },
    {
      id: 'brand',
      track: 'experience',
      label: 'Brand',
      hint: 'Look of the subscriber UI',
      done: isBrandMatched(file.brand),
    },
    {
      id: 'stepConfig',
      track: 'experience',
      label: 'Step config',
      hint: 'Each screen is ready to walk',
      done: file.steps.length > 0 && stepsReady,
    },
  ]

  const testingItems: SetupItem[] = [
    {
      id: 'walk',
      track: 'testing',
      label: 'Walk',
      hint: 'Preview as a subscriber',
      done: walkedOrSkipped,
    },
    {
      id: 'reporting',
      track: 'testing',
      label: 'Reporting',
      hint: 'Where lift shows after this is live',
      done: Boolean(confirmed.reporting),
    },
  ]

  const allItems = [...playItems, ...experienceItems, ...testingItems]
  const gaps: string[] = []
  for (const item of allItems) {
    if (!item.done) gaps.push(`${item.label} not confirmed`)
  }

  const playDone = playItems.filter((i) => i.done).length
  const experienceDone = experienceItems.filter((i) => i.done).length
  const testingDone = testingItems.filter((i) => i.done).length
  const total = allItems.length
  const done = playDone + experienceDone + testingDone

  return {
    play: playItems,
    experience: experienceItems,
    testing: testingItems,
    playDone,
    playTotal: playItems.length,
    experienceDone,
    experienceTotal: experienceItems.length,
    testingDone,
    testingTotal: testingItems.length,
    done,
    total,
    remaining: total - done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    next: allItems.find((i) => !i.done) ?? null,
    gaps,
    ready: gaps.length === 0,
  }
}
