import { useEffect } from 'react'
import { EASE_ENTER } from '../lib/motion'
import { NAV_FOLDED_W, NAV_W } from '../orchestration/paneTokens'
import { SIDEBAR_FOLDED_W, SIDEBAR_W } from '../layout/ThreadSidebar'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { OrchestrationCanvas } from '../orchestration/OrchestrationCanvas'
import { Composer } from '../composer/Composer'
import { CONCIERGE, STUDIO, USES_THREADS, V10 } from '../layout/layoutMode'
import { StudioWorkspace } from '../layout/StudioWorkspace'
import { ThreadWorkspace } from '../layout/ThreadWorkspace'
import { useOrchestration } from '../store/useOrchestration'
import { ArcAppPlaceholder, ArcBar, GrowthTopNav } from './ArcChrome'
import { V10Nav } from '../v10/V10Nav'
import { GrowthHome } from './GrowthHome'
import { GrowthNav } from './GrowthNav'
import { isCancelExperience, useGrowthShell } from './useGrowthShell'
import { labelOf } from './nav'
import { ARC_APPS, useArcApp } from './useArcApp'

const PANEL_MS = 200

export function GrowthShell({ children }: { children: React.ReactNode }) {
  const route = useGrowthShell((s) => s.route)
  const navOpen = useGrowthShell((s) => s.navOpen)
  const inExperience = isCancelExperience(route)
  const arcApp = useArcApp((s) => s.app)

  useEffect(() => {
    if (CONCIERGE && arcApp !== 'growth') {
      const name = ARC_APPS.find((item) => item.id === arcApp)?.label ?? 'Arc'
      document.title = `${name} · Arc`
      return
    }
    document.title = inExperience ? 'Cancel Experience Composer' : `${labelOf(route)} · ${CONCIERGE ? 'Arc' : 'Chargebee Growth'}`
  }, [arcApp, inExperience, route])

  if (CONCIERGE) {
    const growth = arcApp === 'growth'
    const page = growth ? (inExperience ? children : <GrowthHome route={route} />) : <ArcAppPlaceholder app={arcApp} />
    if (V10 && growth) {
      return <V10Frame page={page} />
    }
    return (
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-100 text-slate-900">
        <ArcBar />
        {growth && <GrowthTopNav />}
        <div className="min-h-0 flex-1">{page}</div>
      </div>
    )
  }

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

function V10Frame({ page }: { page: React.ReactNode }) {
  const sidebarOpen = useWorkspaceUi((state) => state.sidebarOpen)
  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-slate-100 text-slate-900">
      <ArcBar />
      <div
        className="grid min-h-0 flex-1 motion-reduce:transition-none"
        style={{
          gridTemplateColumns: `${sidebarOpen ? SIDEBAR_W : SIDEBAR_FOLDED_W}px minmax(0,1fr)`,
          transition: `grid-template-columns ${PANEL_MS}ms ${EASE_ENTER}`,
        }}
      >
        <V10Nav />
        <div className="min-h-0 min-w-0 overflow-hidden">{page}</div>
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
      {STUDIO ? <StudioWorkspace /> : USES_THREADS ? <ThreadWorkspace /> : <OrchestrationCanvas />}
    </div>
  )
}
