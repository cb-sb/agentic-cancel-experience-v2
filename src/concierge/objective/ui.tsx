import type { ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { CopilotRail } from '../../orchestration/CopilotRail'
import { BackButton } from '../../shell/BackButton'
import { useWorkspaceUi } from '../../workspace/useWorkspaceUi'
import { AgentSlot } from '../AgentSlot'
import { Chip } from '../../plays/ui'
import { objectiveLabel, type GrowthObjective } from '../model'
import { experienceTabs, useGrowthPlays } from '../useGrowthPlays'
import { goGrowth } from './useGrowthUi'

export function otherObjective(objective: GrowthObjective): GrowthObjective {
  return objective === 'acquisition' ? 'expansion' : 'acquisition'
}

/** True when plays in both tabs use this experience. */
export function useShared(experienceId: string): boolean {
  const plays = useGrowthPlays((s) => s.plays)
  return experienceTabs(experienceId, plays).length > 1
}

/** "Also in Expansion", seen from the Acquisition tab, and the other way round. */
export function SharedChip({ objective, experienceId }: { objective: GrowthObjective; experienceId: string }) {
  if (!useShared(experienceId)) return null
  return <Chip tone="indigo">Also in {objectiveLabel(otherObjective(objective))}</Chip>
}

/** The pane's small marker for a shared experience. */
export function SharedMark({ objective, experienceId }: { objective: GrowthObjective; experienceId: string }) {
  if (!useShared(experienceId)) return null
  const label = `Also in ${objectiveLabel(otherObjective(objective))}`
  return (
    <span title={label} aria-label={label} className="flex-none text-indigo-500">
      <SIcon name="link" size={12} />
    </span>
  )
}

export const inputCls =
  'w-full rounded-[8px] border border-slate-200 bg-white px-[10px] py-[7px] text-[13px] text-slate-900 outline-none focus:border-slate-400'

/** A list page: back, title and actions in one row, then the body. */
export function PageShell({
  objective,
  title,
  blurb,
  actions,
  children,
  wide = false,
}: {
  objective: GrowthObjective
  title: string
  blurb?: string
  actions?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className={`mx-auto px-[32px] pb-[48px] pt-[24px] ${wide ? 'max-w-[1120px]' : 'max-w-[960px]'}`}>
        <div className="flex items-center gap-[12px]">
          <div className="flex min-w-0 flex-1 items-center gap-[6px]">
            <BackButton fallback={() => goGrowth(objective, { page: 'index' })} className="-ml-[8px]" />
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-slate-900">{title}</h1>
          </div>
          {actions}
        </div>
        {blurb && <p className="mt-[4px] text-[13px] text-slate-500">{blurb}</p>}
        <div className="mt-[24px]">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] items-start gap-[16px] border-t border-slate-100 py-[14px] first:border-t-0">
      <div>
        <p className="text-[13px] font-medium text-slate-800">{label}</p>
        {hint && <p className="mt-[2px] text-[12px] leading-[1.45] text-slate-500">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-[16px] py-[12px]">
        <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
        {hint && <p className="text-[12.5px] text-slate-500">{hint}</p>}
      </div>
      <div className="px-[16px]">{children}</div>
    </section>
  )
}

export function TabStrip<T extends string>({
  tabs,
  active,
  onPick,
}: {
  tabs: { id: T; label: string; icon: SIconName }[]
  active: T
  onPick: (id: T) => void
}) {
  return (
    <div role="tablist" className="flex h-[40px] flex-none items-center gap-[2px] border-b border-slate-200 px-[10px]">
      {tabs.map((t) => {
        const on = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(t.id)}
            className={`flex h-[30px] items-center gap-[6px] rounded-lg px-[10px] text-[12.5px] font-semibold ${on ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <SIcon name={t.icon} size={13} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

/** The Copilot column on the right of an experience or play. It folds to a strip, like Retention's. */
export function CopilotColumn({ subtitle }: { subtitle: string }) {
  const collapsed = useWorkspaceUi((s) => s.copilotCollapsed)
  return (
    <div className={`flex min-h-0 flex-none flex-col border-l border-slate-200 ${collapsed ? 'w-[48px]' : 'w-[clamp(340px,30%,460px)]'}`}>
      {collapsed && <CopilotRail />}
      <div className={collapsed ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>
        <AgentSlot subtitle={subtitle} />
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-[16px] py-[20px] text-center text-[13px] text-slate-500">{children}</p>
}
