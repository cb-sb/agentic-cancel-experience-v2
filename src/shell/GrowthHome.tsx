import { SIcon, SPageHeader } from '@chargebee/sting-react'
import { BrandingStudio } from '../composer/BrandingStudio'
import { AcquisitionPlays } from './AcquisitionPlays'
import { BackButton, backToHome } from './BackButton'
import { V8 } from '../layout/layoutMode'
import { labelOf, type NavLeafId } from './nav'
import { TemplatePages } from '../upload/TemplatePages'
import { UploadFlow } from '../upload/UploadFlow'
import { CONCIERGE, MVP, V10 } from '../layout/layoutMode'
import { MvpPages } from '../upload/MvpPages'
import { EngagedPage } from '../v10/EngagedPage'
import { V10_CHROME, V10_CHROME_BAND } from '../v10/V10Table'
import { OffersScreen, V10Screen } from '../v10/V10Screen'
import { ConciergeHome } from '../concierge/Home'
import { GrowthStudio } from '../concierge/objective/GrowthStudio'
import { AreaPane } from './AreaPane'
import { SIDEBAR_W } from '../layout/ThreadSidebar'

function Placeholder({ route }: { route: NavLeafId }) {
  const title = labelOf(route)
  if (MVP) {
    return (
      <div className="h-full min-h-0 bg-white">
        <SPageHeader
          variant="full"
          title={title}
          description="This page is not in the MVP. Open Experiences → Pages to upload a cancel page."
        />
      </div>
    )
  }
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className={`flex flex-none border-b border-slate-100 px-6 ${V10 ? `${V10_CHROME} items-end` : 'items-center py-4'}`}>
        <div className={`flex min-w-0 items-center gap-2 ${V10 ? `${V10_CHROME_BAND} w-full` : ''}`}>
          <BackButton fallback={backToHome} className="-ml-2" />
          <h1 className="truncate text-[20px] font-semibold tracking-tight text-slate-900">{title}</h1>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <SIcon name="layers" size={28} className="text-slate-300" />
        <p className="text-[14px] font-medium text-slate-700">{title}</p>
        <p className="max-w-sm text-[13px] text-slate-500">
          {CONCIERGE
            ? 'This page is not in the prototype. Ask Copilot on Home about it and it will answer with sample data.'
            : MVP
            ? 'This page is not in the MVP. Open Experiences → Pages to upload a cancel page.'
            : V8
            ? 'This surface is not in the prototype. Open Retention beta at the bottom left to build the cancel journey.'
            : 'This surface is not in the prototype. Open Experiences → Cancel experience to build the cancel journey.'}
        </p>
      </div>
    </div>
  )
}

function WithArea({ group, route }: { group: 'people' | 'reports'; route: NavLeafId }) {
  return (
    <div className="grid h-full min-h-0 bg-white" style={{ gridTemplateColumns: `${SIDEBAR_W}px minmax(0,1fr)` }}>
      <AreaPane group={group} route={route} />
      <Placeholder route={route} />
    </div>
  )
}

function ConciergeRoute({ route }: { route: NavLeafId }) {
  if (route === 'work.offers') return <OffersScreen />
  if (route === 'work.plays' || route === 'work.experiences' || route === 'work.audiences') {
    const tab = route === 'work.plays' ? 'plays' : route === 'work.experiences' ? 'experiences' : 'audiences'
    return <V10Screen tab={tab} />
  }
  if (V10 && route.startsWith('reports.')) {
    return route === 'reports.engaged' ? <EngagedPage /> : <Placeholder route={route} />
  }
  if (route === 'reports.engaged') {
    return (
      <div className="grid h-full min-h-0 bg-white" style={{ gridTemplateColumns: `${SIDEBAR_W}px minmax(0,1fr)` }}>
        <AreaPane group="reports" route={route} />
        <EngagedPage />
      </div>
    )
  }
  switch (route) {
    case 'home':
      return <ConciergeHome />
    case 'acquisition':
    case 'expansion':
      return <GrowthStudio objective={route} />
    default:
      if (route.startsWith('people.')) return <WithArea group="people" route={route} />
      if (route.startsWith('reports.')) return <WithArea group="reports" route={route} />
      return <Placeholder route={route} />
  }
}

export function GrowthHome({ route }: { route: NavLeafId }) {
  if (MVP) return route === 'experiences.pages' ? <MvpPages /> : <Placeholder route={route} />
  if (CONCIERGE) return <ConciergeRoute route={route} />
  if (route === 'plays.acquisition') return <AcquisitionPlays />
  if (route === 'experiences.branding') return <BrandingStudio />
  if (route === 'experiences.pages') {
    return (
      <>
        <TemplatePages />
        <UploadFlow />
      </>
    )
  }
  return <Placeholder route={route} />
}
