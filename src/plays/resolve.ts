import { audienceMatches, bucket, type SampleSubscriber } from '../play/resolve'
import { audienceSummary, type Audience } from '../types/orchestration'
import { variantLetter, type CancelPlay, type PlayVariant } from './types'

/** One decision on the way through a play, in the words the canvas shows. */
export interface TraceStep {
  node: 'global' | 'audience' | 'control' | 'split'
  passed: boolean
  reason: string
}

export type PlayOutcome =
  | { kind: 'global_control' }
  | { kind: 'outside' }
  | { kind: 'play_control' }
  | { kind: 'no_variant' }
  | { kind: 'variant'; variantId: string; experienceId: string; letter: string }

export interface PlayRun {
  outcome: PlayOutcome
  trace: TraceStep[]
}

export function audienceText(a: Audience): string {
  if (a.targetAll) return 'All subscribers'
  return a.name || audienceSummary(a)
}

/** Who a variant reaches, in a few words. */
export function variantShare(play: CancelPlay, v: PlayVariant): string {
  if (play.splitBy === 'percent') return `${v.weight}%`
  return v.audience ? audienceText(v.audience) : 'Everyone else'
}

/** The variant that gets whoever no sub-audience matches: the first one without an audience. */
export function fallbackVariant(play: CancelPlay): PlayVariant | undefined {
  return play.variants.find((v) => !v.audience)
}

function why(a: Audience, props: Record<string, string>, matched: boolean): string {
  if (a.targetAll) return 'Everyone is in'
  const saved = a.name || audienceSummary(a)
  const plan = props.Plan ? `, plan is ${props.Plan}` : ''
  return matched ? `Matches ${saved}${plan}` : `Not in ${saved}${plan}`
}

/**
 * Follow one play the way Chargebee would for this subscriber. The same
 * subscriber always lands in the same bucket, so a test is repeatable.
 */
export function runPlay(
  play: CancelPlay,
  sub: SampleSubscriber,
  globalControl: number,
  opts: { forceVariantId?: string; skipGlobal?: boolean } = {},
): PlayRun {
  const trace: TraceStep[] = []
  if (!opts.skipGlobal) {
    const roll = bucket(sub.id, 'global-control')
    const held = roll < globalControl
    trace.push({
      node: 'global',
      passed: !held,
      reason: globalControl === 0 ? 'Global control is off' : held ? `Bucket ${roll} is in the ${globalControl}% global control` : `Bucket ${roll}, outside the ${globalControl}% global control`,
    })
    if (held) return { outcome: { kind: 'global_control' }, trace }
  }
  const inAudience = audienceMatches(play.audience, sub.props)
  trace.push({ node: 'audience', passed: inAudience, reason: why(play.audience, sub.props, inAudience) })
  if (!inAudience) return { outcome: { kind: 'outside' }, trace }

  if (play.control > 0) {
    const roll = bucket(sub.id, `${play.id}:control`)
    const held = roll < play.control && !opts.forceVariantId
    trace.push({
      node: 'control',
      passed: !held,
      reason: held ? `Bucket ${roll} falls in the ${play.control}% control group` : `Bucket ${roll}, outside the ${play.control}% control group`,
    })
    if (held) return { outcome: { kind: 'play_control' }, trace }
  } else {
    trace.push({ node: 'control', passed: true, reason: 'No control group' })
  }

  if (play.variants.length === 0) {
    trace.push({ node: 'split', passed: false, reason: 'This play has no variants yet' })
    return { outcome: { kind: 'no_variant' }, trace }
  }

  let chosen: PlayVariant | undefined
  let reason = ''
  if (opts.forceVariantId) {
    chosen = play.variants.find((v) => v.id === opts.forceVariantId)
    reason = 'Forced for this test'
  } else if (play.variants.length === 1) {
    chosen = play.variants[0]
    reason = 'Only one variant'
  } else if (play.splitBy === 'percent') {
    const roll = bucket(sub.id, play.id)
    let acc = 0
    chosen = play.variants.find((v) => {
      acc += v.weight
      return roll < acc
    }) ?? play.variants[play.variants.length - 1]
    reason = `Bucket ${roll} goes to Variant ${variantLetter(play.variants.indexOf(chosen))}`
  } else {
    chosen = play.variants.find((v) => v.audience && audienceMatches(v.audience, sub.props))
    if (chosen) reason = `Matches ${audienceText(chosen.audience!)}`
    else {
      chosen = fallbackVariant(play)
      reason = chosen ? 'No sub-audience matched, so they get everyone else' : 'No sub-audience matched and there is no variant for everyone else'
    }
  }
  if (!chosen) {
    trace.push({ node: 'split', passed: false, reason })
    return { outcome: { kind: 'no_variant' }, trace }
  }
  trace.push({ node: 'split', passed: true, reason })
  return {
    outcome: {
      kind: 'variant',
      variantId: chosen.id,
      experienceId: chosen.experienceId,
      letter: variantLetter(play.variants.indexOf(chosen)),
    },
    trace,
  }
}

export interface WorkspaceEntry {
  play: CancelPlay
  run: PlayRun
  /** In the audience, but a play above already took this subscriber. */
  shadowed: boolean
  counts: boolean
}

export interface WorkspaceRun {
  globalHeld: boolean
  entries: WorkspaceEntry[]
  winner: WorkspaceEntry | null
  /** What happens when no play takes them. */
  fallbackId: string | null
}

/**
 * Every play for one subscriber, in priority order. The first play whose
 * audience matches wins; the ones below are shown as "qualifies, but…".
 * Drafts only count when `includeDrafts` is on, so you can test before publishing.
 */
export function resolveWorkspace(
  ranked: CancelPlay[],
  sub: SampleSubscriber,
  globalControl: number,
  fallbackId: string | null,
  includeDrafts: boolean,
): WorkspaceRun {
  const roll = bucket(sub.id, 'global-control')
  const globalHeld = roll < globalControl
  let winner: WorkspaceEntry | null = null
  const entries = ranked.map((play) => {
    const counts = includeDrafts || play.status === 'live'
    const run = runPlay(play, sub, globalControl, { skipGlobal: true })
    const inAudience = run.outcome.kind !== 'outside'
    const entry: WorkspaceEntry = { play, run, shadowed: false, counts }
    if (!globalHeld && counts && inAudience) {
      if (winner) entry.shadowed = true
      else winner = entry
    }
    return entry
  })
  return { globalHeld, entries, winner, fallbackId }
}

/** Playing A reaches nobody when an earlier counted play covers everyone A would. */
export interface Overlap {
  playId: string
  coveredBy: string
}

function covers(upper: Audience, lower: Audience): boolean {
  if (upper.targetAll) return true
  if (lower.targetAll) return false
  if (upper.savedAudienceId && upper.savedAudienceId === lower.savedAudienceId) return true
  return false
}

export function overlaps(ranked: CancelPlay[]): Overlap[] {
  const out: Overlap[] = []
  ranked.forEach((play, i) => {
    const above = ranked.slice(0, i).find((p) => covers(p.audience, play.audience))
    if (above) out.push({ playId: play.id, coveredBy: above.id })
  })
  return out
}
