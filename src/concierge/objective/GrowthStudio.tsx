import { BrandingStudio } from '../../composer/BrandingStudio'
import { SIDEBAR_FOLDED_W, SIDEBAR_W } from '../../layout/ThreadSidebar'
import { EASE_ENTER, PANEL_MS } from '../../lib/motion'
import { ToastHost } from '../../plays/ui'
import { useWorkspaceUi } from '../../workspace/useWorkspaceUi'
import { OffersPage, PricingTablesPage } from '../LibraryPages'
import type { GrowthObjective } from '../model'
import { ExperiencePage } from './ExperiencePage'
import { ExperiencesPage } from './ExperiencesPage'
import { GrowthPane } from './GrowthPane'
import { OrderPage } from './OrderPage'
import { PlayPage } from './PlayPage'
import { TemplatesPage } from './TemplatesPage'
import { SoonPage } from '../Soon'
import { goGrowth, useGrowthView } from './useGrowthUi'

function Page({ objective }: { objective: GrowthObjective }) {
  const view = useGrowthView(objective)
  switch (view.page) {
    case 'experience':
      return <ExperiencePage objective={objective} />
    case 'play':
      return <PlayPage objective={objective} />
    case 'order':
      return <OrderPage objective={objective} />
    case 'templates':
      return <TemplatesPage objective={objective} />
    case 'offers':
      return <OffersPage objective={objective} />
    case 'pricing_tables':
      return <PricingTablesPage objective={objective} />
    case 'brand':
      return <BrandingStudio />
    case 'soon':
      return view.soon ? <SoonPage place={view.soon} onBack={() => goGrowth(objective, { page: 'index' })} /> : <ExperiencesPage objective={objective} />
    default:
      return <ExperiencesPage objective={objective} />
  }
}

/** Acquisition or Expansion: the Growth nav, then this pane, then the page. Same layout as Retention. */
export function GrowthStudio({ objective }: { objective: GrowthObjective }) {
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  return (
    <div
      className="grid h-full min-h-0 bg-white motion-reduce:transition-none"
      style={{
        gridTemplateColumns: `${sidebarOpen ? SIDEBAR_W : SIDEBAR_FOLDED_W}px minmax(0,1fr)`,
        transition: `grid-template-columns ${PANEL_MS}ms ${EASE_ENTER}`,
      }}
    >
      <GrowthPane objective={objective} />
      <div className="flex min-h-0 min-w-0 *:min-w-0 *:flex-1">
        <Page objective={objective} />
      </div>
      <ToastHost />
    </div>
  )
}
