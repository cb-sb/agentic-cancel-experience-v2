import { audienceMatches, bucket, type SampleSubscriber } from '../play/resolve'
import { audienceSummary, type Audience } from '../types/orchestration'
import { variantLetter, type CancelPlay, type PlayVariant, type SubAudience } from './types'
import { audienceUnset } from './usePlays'

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

/** The sub-audience a page is in, when the play splits by sub-audience. */
export function subAudienceOf(play: CancelPlay, v: PlayVariant): SubAudience | undefined {
  return play.splitBy === 'segments' && v.subAudienceId ? play.subAudiences.find((x) => x.id === v.subAudienceId) : undefined
}

/** The pages in one sub-audience's test. */
export function pagesIn(play: CancelPlay, subId: string): PlayVariant[] {
  return play.variants.filter((v) => v.subAudienceId === subId)
}

/** Who a variant reaches, in a few words. */
export function variantShare(play: CancelPlay, v: PlayVariant): string {
  if (play.splitBy === 'percent') return `${v.weight}%`
  const sub = subAudienceOf(play, v)
  if (!sub) return 'Fallback'
  const name = audienceText(sub.audience)
  return pagesIn(play, sub.id).length > 1 ? `${name} · ${v.weight}%` : name
}

/** The page for whoever no sub-audience matches. */
export function fallbackVariant(play: CancelPlay): PlayVariant | undefined {
  return play.variants.find((v) => !v.subAudienceId)
}

function byWeight(pages: PlayVariant[], roll: number): PlayVariant {
  let acc = 0
  return pages.find((v) => {
    acc += v.weight
    return roll < acc
  }) ?? pages[pages.length - 1]
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
    chosen = byWeight(play.variants, roll)
    reason = `Bucket ${roll} goes to Variant ${variantLetter(play.variants.indexOf(chosen))}`
  } else {
    const group = play.subAudiences.find((x) => !audienceUnset(x.audience) && pagesIn(play, x.id).length > 0 && audienceMatches(x.audience, sub.props))
    if (group) {
      const pages = pagesIn(play, group.id)
      const name = audienceText(group.audience)
      if (pages.length === 1) {
        chosen = pages[0]
        reason = `Matches ${name}`
      } else {
        const roll = bucket(sub.id, `${play.id}:${group.id}`)
        chosen = byWeight(pages, roll)
        reason = `Matches ${name}. Bucket ${roll} goes to its ${chosen.weight}% page`
      }
    } else {
      chosen = fallbackVariant(play)
      reason = chosen ? 'No sub-audience matched, so they get the fallback page' : 'No sub-audience matched and there is no fallback page'
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

/** Whether the play reaches more than one page, or is still being split. */
export function hasSplit(play: CancelPlay): boolean {
  return play.splitBy === 'segments' || play.variants.length > 1 || play.emptyRows.length > 0
}

/** What is wrong with how the play divides people, in a sentence. Null when it is sound. */
export function splitProblem(play: CancelPlay): string | null {
  const sum = (pages: PlayVariant[]) => pages.reduce((a, v) => a + v.weight, 0)
  if (play.emptyRows.length > 0) return 'Pick a cancel page for every row'
  if (play.splitBy === 'percent') {
    if (play.variants.length < 2) return null
    const total = sum(play.variants)
    return total === 100 ? null : `The shares add up to ${total}%, not 100%`
  }
  if (play.subAudiences.length === 0) return 'Add a sub-audience'
  for (const [i, x] of play.subAudiences.entries()) {
    const name = audienceUnset(x.audience) ? `Sub-audience ${i + 1}` : audienceText(x.audience)
    if (audienceUnset(x.audience)) return `Pick who is in ${name}`
    const pages = pagesIn(play, x.id)
    if (pages.length === 0) return `Pick a cancel page for ${name}`
    if (pages.length > 1 && sum(pages) !== 100) return `${name} adds up to ${sum(pages)}%, not 100%`
  }
  return fallbackVariant(play) ? null : 'Pick a fallback page for people in no sub-audience'
}
