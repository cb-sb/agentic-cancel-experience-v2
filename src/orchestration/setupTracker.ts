import { isBrandMatched } from '../brand/matchSite'
import type { JourneyFile } from '../journey/types'
import { anyStepNeedsWork } from '../lib/stepNeedsWork'
import type { Experience } from '../types/experience'
import type { Play } from '../types/orchestration'

export type SetupTrack = 'play' | 'experience'

export type SetupItemId =
  | 'audience'
  | 'targeting'
  | 'offers'
  | 'holdout'
  | 'chain'
  | 'brand'
  | 'stepConfig'
  | 'walk'

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
  playDone: number
  playTotal: number
  experienceDone: number
  experienceTotal: number
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

  const uploadedMapped = file.source === 'uploaded' && Boolean(file.manifest?.confirmed)
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
      hint: uploadedMapped ? 'Matched or mapped from upload' : 'Look of the subscriber UI',
      done: isBrandMatched(file.brand) || uploadedMapped,
    },
    {
      id: 'stepConfig',
      track: 'experience',
      label: 'Step config',
      hint: 'Each screen is ready to walk',
      done: file.steps.length > 0 && stepsReady,
    },
    {
      id: 'walk',
      track: 'experience',
      label: 'Walk',
      hint: 'Preview as a subscriber',
      done: walkedOrSkipped,
    },
  ]

  const gaps: string[] = []
  for (const item of [...playItems, ...experienceItems]) {
    if (!item.done) gaps.push(`${item.label} not confirmed`)
  }

  const playDone = playItems.filter((i) => i.done).length
  const experienceDone = experienceItems.filter((i) => i.done).length

  return {
    play: playItems,
    experience: experienceItems,
    playDone,
    playTotal: playItems.length,
    experienceDone,
    experienceTotal: experienceItems.length,
    gaps,
    ready: gaps.length === 0,
  }
}
