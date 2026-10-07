import { create } from 'zustand'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { BackButton } from '../shell/BackButton'

export interface SoonPlace {
  id: string
  label: string
  icon: SIconName
}

/** Places in the objective panes that are in the nav but not built yet. */
export const SOON = {
  checkout: { id: 'checkout', label: 'Checkout', icon: 'shopping-cart' },
  portal: { id: 'portal', label: 'Portal', icon: 'layout-dashboard' },
  planChanges: { id: 'plan_changes', label: 'Plan changes', icon: 'arrow-left-right' },
  notifications: { id: 'notifications', label: 'Email and notifications', icon: 'mail' },
  performance: { id: 'performance', label: 'Performance', icon: 'trending-up' },
  archive: { id: 'archive', label: 'Archive', icon: 'archive' },
} satisfies Record<string, SoonPlace>

/** Retention's open place, when it is one of these. Acquisition and Expansion keep theirs in their view. */
export const useRetentionSoon = create<{ place: SoonPlace | null }>(() => ({ place: null }))

export function SoonPage({ place, onBack }: { place: SoonPlace; onBack: () => void }) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-white">
      <div className="mx-auto w-full max-w-[960px] px-[32px] pt-[24px]">
        <div className="flex items-center gap-[6px]">
          <BackButton fallback={onBack} className="-ml-[8px]" />
          <h1 className="truncate text-[22px] font-semibold tracking-tight text-slate-900">{place.label}</h1>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-[8px] px-[24px] pb-[64px] text-center">
        <SIcon name={place.icon} size={28} className="text-slate-300" />
        <p className="text-[14px] font-medium text-slate-700">{place.label} isn't built yet</p>
        <p className="max-w-sm text-[13px] text-slate-500">This page is a placeholder. We'll fill it in later.</p>
      </div>
    </div>
  )
}
