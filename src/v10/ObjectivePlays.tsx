import { setGrowthGlobalControl, setGrowthOrder, useGrowthPlays, useRankedGrowthPlays } from '../concierge/useGrowthPlays'
import { useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { audienceText } from '../plays/resolve'
import { OrderCanvas, PriorityList, type ObjectiveOrder } from '../plays/PlayOrder'
import { useRankedPlays } from '../plays/usePlays'
import { orderedThreads, useWorkspace } from '../workspace/useWorkspace'
import { useCancelSettings } from '../workspace/useCancelSettings'
import { openRef, type PlayMode, type V10Scope } from './useV10'

type Objective = Exclude<V10Scope, 'portfolio'>

function useObjectiveOrder(objective: Objective): { ranked: ReturnType<typeof useRankedPlays>; source: ObjectiveOrder } {
  const growthRanked = useRankedGrowthPlays(objective === 'retention' ? 'acquisition' : objective)
  const retentionRanked = useRankedPlays()
  const growthControl = useGrowthPlays((state) => (objective === 'retention' ? 0 : state.globalControl[objective]))
  const retentionControl = useCancelSettings((state) => state.globalControl)
  const fallbackId = useCancelSettings((state) => state.globalFallbackId)
  const threads = useWorkspace((state) => state.threads)
  const experiences = useGrowthExperiences((state) => state.items)
  const ranked = objective === 'retention' ? retentionRanked : growthRanked
  const titleOf = (id: string) => experiences.find((item) => item.id === id)?.name ?? threads.find((item) => item.id === id)?.title ?? 'an experience'
  const source: ObjectiveOrder = objective === 'retention'
    ? {
        globalControl: retentionControl,
        controlMax: 30,
        heldBack: 'They cancel with no cancel page',
        trafficLine: `Send the remaining ${100 - retentionControl}% of cancel clicks to these plays, in order. Drag a row to change it.`,
        setGlobalControl: (value) => useCancelSettings.getState().setGlobalControl(value),
        commit: (ids) => useCancelSettings.getState().setPriority(ids),
        open: (id) => openRef({ kind: 'play', source: 'retention', id }),
        titleOf,
        fallback: {
          id: fallbackId,
          options: orderedThreads(threads).map((thread) => ({ id: thread.id, title: thread.title })),
          set: (id) => useCancelSettings.getState().setGlobalFallback(id),
        },
        openExperience: (experienceId) => openRef({ kind: 'experience', source: 'retention', id: experienceId }),
      }
    : {
        globalControl: growthControl,
        controlMax: 50,
        heldBack: 'Held back before any play in this objective is checked',
        startTitle: 'A subscriber reaches this objective',
        trafficLine: `Send the remaining ${100 - growthControl}% of this objective's traffic to these plays, in order. Drag a row to change it.`,
        setGlobalControl: (value) => setGrowthGlobalControl(objective, value),
        commit: (ids) => setGrowthOrder(objective, ids),
        open: (id) => openRef({ kind: 'play', source: 'growth', id, objective }),
        titleOf,
        fallback: null,
        openExperience: (experienceId) => openRef({ kind: 'experience', source: 'growth', id: experienceId, objective }),
      }
  return { ranked, source }
}

export function ObjectivePlays({ objective, mode, query, status }: { objective: Objective; mode: Exclude<PlayMode, 'list'>; query: string; status: ('live' | 'draft')[] }) {
  const { ranked, source } = useObjectiveOrder(objective)
  const q = query.trim().toLowerCase()
  const shown = ranked.filter((play) => {
    const statusOk = status.length === 0 || status.includes(play.status)
    const text = `${play.name} ${audienceText(play.audience)}`.toLowerCase()
    return statusOk && (!q || text.includes(q))
  })
  if (mode === 'canvas') {
    return (
      <div className="min-h-0 flex-1">
        <OrderCanvas ranked={ranked} source={source} />
      </div>
    )
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto px-[28px] pb-[32px] pt-[16px] min-[1440px]:px-[40px] min-[1800px]:px-[64px]">
      <PriorityList ranked={ranked} shown={shown} source={source} />
    </div>
  )
}
