import { SIcon } from '@chargebee/sting-react'
import { BrandingStudio } from '../composer/BrandingStudio'
import { AcquisitionPlays } from './AcquisitionPlays'
import { labelOf, type NavLeafId } from './nav'
import { TemplatePages } from '../upload/TemplatePages'
import { UploadFlow } from '../upload/UploadFlow'

function Placeholder({ route }: { route: NavLeafId }) {
  const title = labelOf(route)
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex flex-none items-center gap-2 border-b border-slate-100 px-6 py-4">
        <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">{title}</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <SIcon name="layers" size={28} className="text-slate-300" />
        <p className="text-[14px] font-medium text-slate-700">{title}</p>
        <p className="max-w-sm text-[13px] text-slate-500">
          This surface is not in the prototype. Open Experiences → Cancel experience to build
          the cancel journey.
        </p>
      </div>
    </div>
  )
}

export function GrowthHome({ route }: { route: NavLeafId }) {
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
