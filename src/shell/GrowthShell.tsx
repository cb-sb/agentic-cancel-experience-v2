import { useEffect } from 'react'
import { EASE_ENTER } from '../lib/motion'
import { NAV_FOLDED_W, NAV_W } from '../orchestration/paneTokens'
import { OrchestrationCanvas } from '../orchestration/OrchestrationCanvas'
import { Composer } from '../composer/Composer'
import { useOrchestration } from '../store/useOrchestration'
import { GrowthHome } from './GrowthHome'
import { GrowthNav } from './GrowthNav'
import { isCancelExperience, useGrowthShell } from './useGrowthShell'
import { labelOf } from './nav'

const PANEL_MS = 200

export function GrowthShell({ children }: { children: React.ReactNode }) {
  const route = useGrowthShell((s) => s.route)
  const navOpen = useGrowthShell((s) => s.navOpen)
  const inExperience = isCancelExperience(route)

  useEffect(() => {
    document.title = inExperience ? 'Cancel Experience Composer' : `${labelOf(route)} · Chargebee Growth`
  }, [inExperience, route])

  return (
    <div
      className="grid h-screen min-h-0 overflow-hidden bg-slate-100 text-slate-900 motion-reduce:transition-none"
      style={{
        gridTemplateColumns: `${navOpen ? NAV_W : NAV_FOLDED_W}px 1fr`,
        transition: `grid-template-columns ${PANEL_MS}ms ${EASE_ENTER}`,
      }}
    >
      <GrowthNav />
      <div className="flex min-h-0 min-w-0 flex-col">
        {inExperience ? children : <GrowthHome route={route} />}
      </div>
    </div>
  )
}

export function PrototypeApp() {
  const view = useOrchestration((s) => s.view)
  if (view === 'editor') {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-100">
        <Composer />
      </div>
    )
  }
  return (
    <div className="h-full min-h-0">
      <OrchestrationCanvas />
    </div>
  )
}
