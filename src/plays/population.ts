import { SAMPLE_SUBSCRIBERS, bucket, type SampleSubscriber } from '../play/resolve'
import { resolveWorkspace, runPlay } from './resolve'
import type { CancelPlay } from './types'

/** Recent cancel clicks the counts are based on. Made up, but the same every time. */
export const POPULATION_SIZE = 2000

const FIRST = ['Ava', 'Ben', 'Chloe', 'Dev', 'Elif', 'Farah', 'Gus', 'Hana', 'Ivan', 'Jade', 'Kofi', 'Lior', 'Mina', 'Noah', 'Olu', 'Priya', 'Quinn', 'Rosa', 'Sami', 'Tara', 'Uma', 'Vik', 'Wren', 'Yara', 'Zed']
const LAST = ['Adams', 'Bose', 'Chen', 'Diaz', 'Evans', 'Fox', 'Garcia', 'Hill', 'Ito', 'Jones', 'Khan', 'Lee', 'Moss', 'Ng', 'Ortiz', 'Park', 'Reid', 'Silva', 'Tan', 'Vega']
const COUNTRIES = ['US', 'US', 'US', 'GB', 'DE', 'IN', 'CA', 'AU', 'FR', 'BR']

function make(i: number): SampleSubscriber {
  const id = `sub_${String(i + 1).padStart(4, '0')}`
  const r = (salt: string) => bucket(id, salt)
  const trial = r('trial') < 18
  const tier = r('tier')
  const annual = r('annual') < 35
  const plan = tier < 55 ? 'Starter' : tier < 90 ? 'Pro' : 'Enterprise'
  const base = plan === 'Starter' ? 29 : plan === 'Pro' ? 99 : 900
  const mrr = trial ? 0 : base + (r('mrr') % 20)
  const days = trial ? 1 + (r('days') % 14) : 5 + r('days') * 12
  const ltv = Math.round((mrr * days) / 30)
  const name = `${FIRST[r('first') % FIRST.length]} ${LAST[r('last') % LAST.length]}`
  return {
    id,
    name,
    summary: `${plan} ${annual ? 'annual' : 'monthly'}${trial ? ', in trial' : `, $${mrr} a month`}`,
    props: {
      'Subscription status': trial ? 'In trial' : 'Active',
      MRR: String(mrr),
      'Lifetime value': String(ltv),
      Plan: `${plan} ${annual ? 'Annual' : 'Monthly'}`,
      'Days since signup': String(days),
      'Trial status': trial ? 'Active' : 'Inactive',
      Country: COUNTRIES[r('country') % COUNTRIES.length],
    },
  }
}

let cache: SampleSubscriber[] | null = null

export function population(): SampleSubscriber[] {
  if (!cache) cache = Array.from({ length: POPULATION_SIZE }, (_, i) => make(i))
  return cache
}

/** Named test people first, then anyone in the sample, by name or ID. */
export function lookupSubscribers(query: string, limit = 8): SampleSubscriber[] {
  const q = query.trim().toLowerCase()
  const all = [...SAMPLE_SUBSCRIBERS, ...population()]
  if (!q) return SAMPLE_SUBSCRIBERS
  return all.filter((s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)).slice(0, limit)
}

export function subscriberById(id: string): SampleSubscriber | undefined {
  return SAMPLE_SUBSCRIBERS.find((s) => s.id === id) ?? population().find((s) => s.id === id)
}

/** How many people reach each part of a play. */
export interface PlayCounts {
  clicked: number
  globalHeld: number
  /** Taken by a play higher in the order. */
  taken: number
  inAudience: number
  outside: number
  control: number
  byVariant: Record<string, number>
  noVariant: number
}

/**
 * Counts for one play. Draft counts this play as if it were live now, in its
 * place in the order. Live only counts plays that are live today.
 */
export function playCounts(play: CancelPlay, ranked: CancelPlay[], globalControl: number, mode: 'draft' | 'live'): PlayCounts {
  const out: PlayCounts = { clicked: POPULATION_SIZE, globalHeld: 0, taken: 0, inAudience: 0, outside: 0, control: 0, byVariant: {}, noVariant: 0 }
  const order = mode === 'draft' ? ranked : ranked.filter((p) => p.status === 'live')
  const idx = order.findIndex((p) => p.id === play.id)
  if (idx < 0) return out
  const above = order.slice(0, idx)
  for (const sub of population()) {
    const ws = resolveWorkspace(above, sub, globalControl, null, true)
    if (ws.globalHeld) {
      out.globalHeld++
      continue
    }
    if (ws.winner) {
      out.taken++
      continue
    }
    const run = runPlay(play, sub, globalControl, { skipGlobal: true })
    const k = run.outcome.kind
    if (k === 'outside') {
      out.outside++
      continue
    }
    out.inAudience++
    if (k === 'play_control') out.control++
    else if (k === 'no_variant') out.noVariant++
    else if (run.outcome.kind === 'variant') out.byVariant[run.outcome.variantId] = (out.byVariant[run.outcome.variantId] ?? 0) + 1
  }
  return out
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US')
}
