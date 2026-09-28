import {
  AUDIENCE_LIBRARY,
  type Audience,
  type AudienceCondition,
  type MatchJoin,
  type Play,
  type RoutingBranch,
  type RuleOperator,
  type SplitNode,
} from '../types/orchestration'

export interface SampleSubscriber {
  id: string
  name: string
  summary: string
  props: Record<string, string>
}

export const SAMPLE_SUBSCRIBERS: SampleSubscriber[] = [
  {
    id: 'sub_maya',
    name: 'Maya',
    summary: 'Starter monthly, joined 12 days ago',
    props: {
      'Subscription status': 'Active',
      MRR: '29',
      'Lifetime value': '120',
      Plan: 'Starter Monthly',
      'Days since signup': '12',
      'Trial status': 'Inactive',
      Country: 'US',
    },
  },
  {
    id: 'sub_omar',
    name: 'Omar',
    summary: 'Pro annual, two years in',
    props: {
      'Subscription status': 'Active',
      MRR: '200',
      'Lifetime value': '4800',
      Plan: 'Pro Annual',
      'Days since signup': '730',
      'Trial status': 'Inactive',
      Country: 'GB',
    },
  },
  {
    id: 'sub_lena',
    name: 'Lena',
    summary: 'In trial, not paying yet',
    props: {
      'Subscription status': 'In trial',
      MRR: '0',
      'Lifetime value': '0',
      Plan: 'Pro Monthly',
      'Days since signup': '5',
      'Trial status': 'Active',
      Country: 'DE',
    },
  },
  {
    id: 'sub_raj',
    name: 'Raj',
    summary: 'Enterprise annual, high value',
    props: {
      'Subscription status': 'Active',
      MRR: '900',
      'Lifetime value': '18000',
      Plan: 'Enterprise Annual',
      'Days since signup': '1100',
      'Trial status': 'Inactive',
      Country: 'IN',
    },
  },
]

function compare(op: RuleOperator, actual: string, expected: string): boolean {
  const a = actual.trim().toLowerCase()
  const e = expected.trim().toLowerCase()
  switch (op) {
    case 'is':
      return a === e
    case 'is_not':
      return a !== e
    case 'contains':
      return e !== '' && a.includes(e)
    case 'gt':
      return Number(actual) > Number(expected)
    case 'lt':
      return Number(actual) < Number(expected)
    case 'is_any_of':
      return e.split(',').map((v) => v.trim()).includes(a)
  }
}

function conditionMatches(c: AudienceCondition, props: Record<string, string>): boolean {
  const own = compare(c.operator, props[c.property] ?? '', c.value)
  const kids = (c.children ?? []).filter((k) => k.property)
  if (kids.length === 0) return own
  const all = [own, ...kids.map((k) => conditionMatches(k, props))]
  return (c.join ?? 'AND') === 'AND' ? all.every(Boolean) : all.some(Boolean)
}

function rulesOf(a: Audience): { conditions: AudienceCondition[]; match: MatchJoin } {
  if (a.conditions && a.conditions.length > 0) return { conditions: a.conditions, match: a.match ?? 'AND' }
  const saved = a.savedAudienceId ? AUDIENCE_LIBRARY.find((s) => s.id === a.savedAudienceId) : undefined
  return saved ? { conditions: saved.conditions, match: saved.match } : { conditions: [], match: 'AND' }
}

export function audienceMatches(a: Audience | undefined, props: Record<string, string>): boolean {
  if (!a || a.targetAll) return true
  const { conditions, match } = rulesOf(a)
  const live = conditions.filter((c) => c.property)
  if (live.length === 0) return true
  return match === 'AND'
    ? live.every((c) => conditionMatches(c, props))
    : live.some((c) => conditionMatches(c, props))
}

/** The same subscriber always lands in the same bucket, 0 to 99. */
export function bucket(subscriberId: string, salt: string): number {
  let h = 2166136261
  for (const ch of `${salt}:${subscriberId}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 100
}

export function audienceName(play: Play): string {
  return play.audience.targetAll ? 'all subscribers' : play.audience.name
}

export interface PlayVariant {
  branchId: string
  experienceId: string | null
  /** "Variant A", a sub-audience name, or "Everyone else". */
  label: string
  /** Who this variant reaches, in a sentence fragment. */
  share: string
  percent: number
  role: RoutingBranch['role']
}

export function topSplit(play: Play): SplitNode | null {
  return play.targeting.kind === 'split' ? play.targeting : null
}

/** One entry per branch of the play's actions, in the order the Targeting tab shows them. */
export function playVariants(play: Play): PlayVariant[] {
  const who = audienceName(play)
  const split = topSplit(play)
  if (!split) {
    const exp = play.targeting.kind === 'flow' ? play.targeting.experienceId : null
    return [{ branchId: play.targeting.id, experienceId: exp, label: 'Cancel page', share: `100% of ${who}`, percent: 100, role: undefined }]
  }
  let letter = 0
  return split.branches.map((b) => {
    const exp = b.node.kind === 'flow' ? b.node.experienceId : null
    if (split.mode === 'single') {
      return { branchId: b.id, experienceId: exp, label: 'Cancel page', share: `100% of ${who}`, percent: 100, role: b.role }
    }
    if (split.mode === 'percent') {
      const label = b.node.kind === 'holdout' ? 'No cancel page' : `Variant ${String.fromCharCode(65 + letter++)}`
      return { branchId: b.id, experienceId: exp, label, share: `${b.percent}% of ${who}`, percent: b.percent, role: b.role }
    }
    if (b.role === 'fallback') {
      return { branchId: b.id, experienceId: exp, label: 'Everyone else', share: `The rest of ${who}`, percent: 0, role: b.role }
    }
    const name = b.audience?.name || b.name
    return { branchId: b.id, experienceId: exp, label: name, share: `${name}, within ${who}`, percent: 0, role: b.role }
  })
}

export type Resolution =
  | { kind: 'control' }
  | { kind: 'outside' }
  | { kind: 'no_page'; label: string }
  | { kind: 'page'; experienceId: string; label: string; share: string }

/** Follow the play the way Chargebee would for this subscriber. */
export function resolvePlay(play: Play, sub: SampleSubscriber, globalControl: number): Resolution {
  if (bucket(sub.id, 'global-control') < globalControl) return { kind: 'control' }
  if (!audienceMatches(play.audience, sub.props)) return { kind: 'outside' }
  const variants = playVariants(play)
  const split = topSplit(play)
  let chosen: PlayVariant | undefined
  if (!split || split.mode === 'single') chosen = variants[0]
  else if (split.mode === 'percent') {
    const roll = bucket(sub.id, split.id)
    let acc = 0
    chosen = variants.find((v) => {
      acc += v.percent
      return roll < acc
    }) ?? variants[variants.length - 1]
  } else {
    chosen =
      variants.find((v, i) => v.role !== 'fallback' && audienceMatches(split.branches[i].audience, sub.props)) ??
      variants.find((v) => v.role === 'fallback')
  }
  if (!chosen || !chosen.experienceId) return { kind: 'no_page', label: chosen?.label ?? 'No cancel page' }
  return { kind: 'page', experienceId: chosen.experienceId, label: chosen.label, share: chosen.share }
}
