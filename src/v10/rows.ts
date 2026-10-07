import { useMemo } from 'react'
import { TYPE_LABEL, type GrowthObjective } from '../concierge/model'
import { useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { experienceTabs, growthExperienceLive, useGrowthPlays } from '../concierge/useGrowthPlays'
import { usePlays } from '../plays/usePlays'
import type { Audience } from '../types/orchestration'
import { orderedThreads, useWorkspace } from '../workspace/useWorkspace'
import { useAudiences } from './useAudiences'
import { useV10, type Tag, type V10Kind, type V10Ref } from './useV10'

export interface V10Row extends V10Ref {
  title: string
  tags: Tag[]
  status: 'live' | 'draft'
  type: string
  updatedAt: number
}

const TAGS: Tag[] = ['acquisition', 'expansion', 'retention']

function tagged(id: string, natural: Tag[], overrides: Record<string, Tag[]>): Tag[] {
  const extra = overrides[id]
  return extra && extra.length > 0 ? extra : natural
}

function uses(audience: Audience | undefined, id: string, name: string) {
  if (!audience) return false
  return audience.savedAudienceId === id || audience.name === name
}

export function useV10Rows(): V10Row[] {
  const growthPlays = useGrowthPlays((state) => state.plays)
  const growthExperiences = useGrowthExperiences((state) => state.items)
  const retentionPlays = usePlays((state) => state.plays)
  const threads = useWorkspace((state) => state.threads)
  const audiences = useAudiences((state) => state.items)
  const overrides = useV10((state) => state.tags)

  return useMemo(() => {
    const plays: V10Row[] = [
      ...growthPlays.map((play) => ({
        kind: 'play' as const,
        source: 'growth' as const,
        id: play.id,
        objective: play.objective,
        title: play.name,
        tags: tagged(play.id, [play.objective], overrides),
        status: play.status === 'live' ? ('live' as const) : ('draft' as const),
        type: 'Play',
        updatedAt: play.updatedAt,
      })),
      ...retentionPlays.map((play) => ({
        kind: 'play' as const,
        source: 'retention' as const,
        id: play.id,
        title: play.name,
        tags: tagged(play.id, ['retention'], overrides),
        status: play.status === 'live' ? ('live' as const) : ('draft' as const),
        type: 'Play',
        updatedAt: play.updatedAt,
      })),
    ]
    const experiences: V10Row[] = [
      ...growthExperiences.map((item) => {
        const tabs = experienceTabs(item.id, growthPlays)
        const natural = (tabs.length > 0 ? tabs : [item.objective]) as Tag[]
        return {
          kind: 'experience' as const,
          source: 'growth' as const,
          id: item.id,
          objective: item.objective,
          title: item.name,
          tags: tagged(item.id, natural, overrides),
          status: growthExperienceLive(item.id, growthPlays) ? ('live' as const) : ('draft' as const),
          type: TYPE_LABEL[item.type],
          updatedAt: item.updatedAt,
        }
      }),
      ...orderedThreads(threads).map((thread) => ({
        kind: 'experience' as const,
        source: 'retention' as const,
        id: thread.id,
        title: thread.title,
        tags: tagged(thread.id, ['retention'], overrides),
        status: thread.snapshot?.play.publishState === 'live' ? ('live' as const) : ('draft' as const),
        type: 'Cancel page',
        updatedAt: thread.updatedAt,
      })),
    ]
    const audienceRows: V10Row[] = audiences.map((audience) => {
      const live = [...growthPlays, ...retentionPlays].some(
        (play) => play.status === 'live' && (uses(play.audience, audience.id, audience.name) || play.subAudiences.some((sub) => uses(sub.audience, audience.id, audience.name))),
      )
      const natural = TAGS.filter((tag) =>
        (tag === 'retention' ? retentionPlays : growthPlays.filter((play) => play.objective === tag)).some(
          (play) => uses(play.audience, audience.id, audience.name) || play.subAudiences.some((sub) => uses(sub.audience, audience.id, audience.name)),
        ),
      )
      return {
        kind: 'audience' as const,
        source: 'audience' as const,
        id: audience.id,
        title: audience.name,
        tags: tagged(audience.id, natural.length > 0 ? natural : ['acquisition'], overrides),
        status: live ? 'live' : 'draft',
        type: 'Audience',
        updatedAt: audience.updatedAt,
      }
    })
    return [...plays, ...experiences, ...audienceRows]
  }, [audiences, growthExperiences, growthPlays, overrides, retentionPlays, threads])
}

export function rowsFor(rows: V10Row[], kind: V10Kind): V10Row[] {
  return rows.filter((row) => row.kind === kind)
}

export function titleOf(rows: V10Row[], ref: V10Ref): string {
  return rows.find((row) => row.kind === ref.kind && row.id === ref.id)?.title ?? 'Untitled'
}

export type { GrowthObjective }
