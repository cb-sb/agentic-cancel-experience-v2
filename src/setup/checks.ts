import type { JourneyFile } from '../journey/types'
import type { CancelPlay } from '../plays/types'
import { experienceCtx, type SetupInputs } from './progress'
import { WORKSPACE_TARGET, type ExperienceCtx } from './registry'

/**
 * What has to be true before something can go out. Each check reads the saved
 * config and nothing else, so nobody can mark one done: the Task list, the
 * chat's last check and the Go live button all ask the same questions.
 */
interface Check<C> {
  id: string
  label: string
  fix: (c: C) => string
  /** Registry item that opens the fix in chat or in the editor. */
  item: string
  applies?: (c: C) => boolean
  isMet: (c: C) => boolean
}

export interface PlayCheckCtx {
  play: CancelPlay
  drafts: { id: string; title: string }[]
  installConnected: boolean
}

export interface CheckResult {
  id: string
  label: string
  fix: string
  item: string
  met: boolean
  /** Experience id, play id, or the workspace. */
  targetId: string
  /** For "every experience is published": the first draft to open. */
  openExperienceId?: string
}

const offerSteps = (f: JourneyFile) => f.steps.filter((s) => s.kind === 'offer')

const EXPERIENCE_CHECKS: Check<ExperienceCtx>[] = [
  {
    id: 'hasScreens',
    label: 'Has at least one screen',
    fix: () => 'Add the screens a subscriber sees before they cancel',
    item: 'steps',
    isMet: (c) => c.file.steps.length > 0,
  },
  {
    id: 'offerPicked',
    label: 'Every offer screen has an offer',
    fix: (c) => {
      const n = offerSteps(c.file).filter((s) => !s.offer).length
      return `${n === 1 ? 'One offer screen has' : `${n} offer screens have`} nothing to offer yet`
    },
    item: 'offers',
    applies: (c) => offerSteps(c.file).length > 0,
    isMet: (c) => offerSteps(c.file).every((s) => Boolean(s.offer)),
  },
  {
    id: 'offerApplied',
    label: 'Every offer says how it gets applied',
    fix: () => 'Choose whether billing applies it, or where to send it',
    item: 'fulfilment',
    applies: (c) => offerSteps(c.file).length > 0,
    isMet: (c) => offerSteps(c.file).every((s) => Boolean(s.fulfilment) && (s.fulfilment === 'billing' || Boolean(s.fulfilmentTarget?.trim()))),
  },
  {
    id: 'cancelHandled',
    label: 'Cancel handling is set',
    fix: () => 'Choose how the cancel is processed and when it takes effect',
    item: 'cancelHandling',
    isMet: (c) => Boolean(c.file.cancelHandling?.processing && c.file.cancelHandling?.timing),
  },
]

const PLAY_CHECKS: Check<PlayCheckCtx>[] = [
  {
    id: 'hasExperience',
    label: 'Has at least one experience',
    fix: () => 'Add the cancel experience this play shows',
    item: 'variants',
    isMet: (c) => c.play.variants.length > 0,
  },
  {
    id: 'allPublished',
    label: 'Every experience in it is published',
    fix: (c) => (c.drafts.length === 1 ? `${c.drafts[0].title} is still a draft` : `${c.drafts.length} experiences are still drafts`),
    item: 'variantsReady',
    applies: (c) => c.play.variants.length > 0,
    isMet: (c) => c.drafts.length === 0,
  },
  {
    id: 'splitAddsUp',
    label: 'Traffic split adds up',
    fix: (c) =>
      c.play.splitBy === 'percent'
        ? `The shares add up to ${c.play.variants.reduce((a, v) => a + v.weight, 0)}%, not 100%`
        : 'One variant needs to be for everyone else',
    item: 'split',
    applies: (c) => c.play.variants.length > 1,
    isMet: (c) =>
      c.play.splitBy === 'percent'
        ? c.play.variants.reduce((a, v) => a + v.weight, 0) === 100
        : c.play.variants.some((v) => v.audience) && c.play.variants.some((v) => !v.audience),
  },
  {
    id: 'installed',
    label: 'Billing connected and snippet installed',
    fix: () => 'Done once for your whole site',
    item: 'install',
    isMet: (c) => c.installConnected,
  },
]

function run<C>(checks: Check<C>[], ctx: C, targetFor: (c: Check<C>) => string): CheckResult[] {
  return checks
    .filter((c) => !c.applies || c.applies(ctx))
    .map((c) => {
      const met = c.isMet(ctx)
      return { id: c.id, label: c.label, fix: met ? '' : c.fix(ctx), item: c.item, met, targetId: targetFor(c) }
    })
}

export function checksForExperience(ctx: ExperienceCtx): CheckResult[] {
  return run(EXPERIENCE_CHECKS, ctx, () => ctx.experienceId)
}

export function experienceChecks(experienceId: string, i: SetupInputs): CheckResult[] {
  const t = i.threads.find((x) => x.id === experienceId)
  return t ? checksForExperience(experienceCtx(t, i)) : []
}

export function playCheckCtx(play: CancelPlay, i: SetupInputs): PlayCheckCtx {
  const drafts = play.variants
    .map((v) => i.threads.find((t) => t.id === v.experienceId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t) && !experienceCtx(t!, i).live)
    .map((t) => ({ id: t.id, title: t.title }))
  return { play, drafts, installConnected: i.installConnected }
}

export function playChecks(playId: string, i: SetupInputs): CheckResult[] {
  const play = i.plays.find((p) => p.id === playId)
  if (!play) return []
  const ctx = playCheckCtx(play, i)
  return run(PLAY_CHECKS, ctx, (c) => (c.id === 'installed' ? WORKSPACE_TARGET : playId)).map((r) =>
    r.id === 'allPublished' && !r.met ? { ...r, openExperienceId: ctx.drafts[0]?.id } : r,
  )
}

export const failing = (checks: CheckResult[]) => checks.filter((c) => !c.met)
