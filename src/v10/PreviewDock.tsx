import { useMemo, type ReactNode } from 'react'
import { create } from 'zustand'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { TYPE_ICON, TYPE_LABEL } from '../concierge/model'
import { OfferPreview, PricingPreview } from '../concierge/Previews'
import { useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { useGrowthLibrary } from '../concierge/useGrowthLibrary'
import { useGrowthPlays } from '../concierge/useGrowthPlays'
import { compileJourney } from '../journey/compile'
import { SHELL_KIND, shellOf } from '../layout/experienceKind'
import { TemplateStepThumb } from '../orchestration/TemplatePreviewStrip'
import { audienceText } from '../plays/resolve'
import type { CancelPlay } from '../plays/types'
import { audienceUnset, usePlays } from '../plays/usePlays'
import { conditionExpression, type AudienceCondition } from '../types/orchestration'
import { fileOfThread, useWorkspace } from '../workspace/useWorkspace'
import { useAudiences } from './useAudiences'
import { openRef, type V10Ref } from './useV10'

interface DockState {
  item: V10Ref | null
  minimized: boolean
}

/** What the dock shows. Rows set it on hover, and it stays on the last one, like a mail draft dock. */
export const usePreviewDock = create<DockState>(() => ({ item: null, minimized: false }))

let pending: ReturnType<typeof setTimeout> | undefined

/** Show `item` after a short pause, so sweeping the pointer down the table doesn't flicker the dock. */
export function previewOnHover(item: V10Ref) {
  clearTimeout(pending)
  pending = setTimeout(() => {
    const current = usePreviewDock.getState().item
    if (current && current.kind === item.kind && current.id === item.id) return
    usePreviewDock.setState({ item })
  }, 140)
}

export function cancelHoverPreview() {
  clearTimeout(pending)
}

export function closePreviewDock() {
  clearTimeout(pending)
  usePreviewDock.setState({ item: null, minimized: false })
}

export function PreviewDock() {
  const item = usePreviewDock((state) => state.item)
  const minimized = usePreviewDock((state) => state.minimized)
  if (!item) return null
  return (
    <section
      aria-label="Preview"
      className="fixed bottom-0 right-[24px] z-40 flex w-[380px] flex-col overflow-hidden rounded-t-[10px] border border-b-0 border-slate-300 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.22)]"
    >
      <DockHeader item={item} minimized={minimized} />
      {!minimized && (
        <div className="max-h-[min(460px,calc(100vh-180px))] overflow-y-auto overscroll-contain px-[14px] pb-[14px] pt-[12px]">
          {item.kind === 'play' && <PlayPreview item={item} />}
          {item.kind === 'experience' && <ExperiencePreview item={item} />}
          {item.kind === 'audience' && <AudiencePreview id={item.id} />}
        </div>
      )}
    </section>
  )
}

function useTitle(item: V10Ref): { title: string; kind: string; icon: SIconName } {
  const growthPlay = useGrowthPlays((state) => state.plays.find((play) => play.id === item.id))
  const retentionPlay = usePlays((state) => state.plays.find((play) => play.id === item.id))
  const growth = useGrowthExperiences((state) => state.items.find((entry) => entry.id === item.id))
  const thread = useWorkspace((state) => state.threads.find((entry) => entry.id === item.id))
  const audience = useAudiences((state) => state.items.find((entry) => entry.id === item.id))
  if (item.kind === 'play') return { title: (item.source === 'growth' ? growthPlay?.name : retentionPlay?.name) ?? 'Play', kind: 'Play', icon: 'workflow' }
  if (item.kind === 'audience') return { title: audience?.name ?? 'Audience', kind: 'Audience', icon: 'users' }
  if (item.source === 'growth' && growth) return { title: growth.name, kind: TYPE_LABEL[growth.type], icon: TYPE_ICON[growth.type] }
  if (thread) return { title: thread.title, kind: SHELL_KIND[shellOf(thread)].label, icon: SHELL_KIND[shellOf(thread)].icon }
  return { title: 'Experience', kind: 'Experience', icon: 'layers' }
}

function DockHeader({ item, minimized }: { item: V10Ref; minimized: boolean }) {
  const { title, kind, icon } = useTitle(item)
  const toggle = () => usePreviewDock.setState({ minimized: !minimized })
  return (
    <header className="flex h-[40px] flex-none items-center gap-[8px] bg-[#1f2430] pl-[12px] pr-[6px] text-white">
      <button type="button" onClick={toggle} aria-expanded={!minimized} className="flex min-w-0 flex-1 items-center gap-[8px] text-left">
        <SIcon name={icon} size={14} className="flex-none text-white/70" />
        <span className="truncate text-[13px] font-semibold">{title}</span>
        <span className="flex-none text-[11.5px] text-white/60">{kind}</span>
      </button>
      <HeaderButton icon="arrow-up-right" label={`Open ${title}`} onClick={() => openRef(item)} />
      <HeaderButton icon={minimized ? 'chevron-up' : 'minus'} label={minimized ? 'Expand preview' : 'Minimize preview'} onClick={toggle} />
      <HeaderButton icon="x" label="Close preview" onClick={closePreviewDock} />
    </header>
  )
}

function HeaderButton({ icon, label, onClick }: { icon: SIconName; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white">
      <SIcon name={icon} size={14} />
    </button>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-[6px] text-[11.5px] font-medium uppercase tracking-[0.04em] text-slate-400">{children}</p>
}

function PlayPreview({ item }: { item: V10Ref }) {
  const growth = useGrowthPlays((state) => (item.source === 'growth' ? state.plays.find((play) => play.id === item.id) : undefined))
  const retention = usePlays((state) => (item.source === 'retention' ? state.plays.find((play) => play.id === item.id) : undefined))
  const play = (growth ?? retention) as CancelPlay | undefined
  if (!play) return <p className="text-[13px] text-slate-500">This play was deleted.</p>
  const audience = play.audience.targetAll ? 'All subscribers' : audienceUnset(play.audience) ? 'No audience yet' : audienceText(play.audience)
  const experiences = [...new Map(play.variants.map((variant) => [variant.experienceId, variant])).values()]
  const split = play.splitBy === 'segments' ? `Split into ${play.subAudiences.length} sub-audience${play.subAudiences.length === 1 ? '' : 's'}` : experiences.length > 1 ? `A/B test of ${experiences.length}` : null
  return (
    <div className="space-y-[14px]">
      <div>
        <Label>Who sees it</Label>
        <p className="flex items-center gap-[6px] text-[13px] text-slate-700">
          <SIcon name="users" size={13} className="flex-none text-slate-400" />
          <span className="min-w-0 truncate">{audience}</span>
        </p>
        {split && <p className="mt-[4px] text-[12px] text-slate-500">{split}</p>}
      </div>
      <div>
        <Label>{experiences.length === 1 ? 'Experience' : `Experiences (${experiences.length})`}</Label>
        {experiences.length === 0 ? (
          <p className="text-[13px] text-slate-500">No experience yet.</p>
        ) : (
          <div className="space-y-[16px]">
            {experiences.map((variant) => (
              <div key={variant.experienceId}>
                <ExperienceName id={variant.experienceId} source={item.source} weight={play.splitBy !== 'segments' && experiences.length > 1 ? variant.weight : null} />
                <ExperienceBody source={item.source} id={variant.experienceId} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ExperienceName({ id, source, weight }: { id: string; source: V10Ref['source']; weight: number | null }) {
  const growth = useGrowthExperiences((state) => state.items.find((entry) => entry.id === id))
  const thread = useWorkspace((state) => state.threads.find((entry) => entry.id === id))
  const name = source === 'growth' ? growth?.name : thread?.title
  const kind = source === 'growth' ? (growth ? TYPE_LABEL[growth.type] : '') : thread ? SHELL_KIND[shellOf(thread)].label : ''
  return (
    <p className="mb-[8px] flex items-center gap-[6px] text-[13px]">
      <span className="min-w-0 truncate font-medium text-slate-800">{name ?? 'Experience'}</span>
      {kind && <span className="flex-none text-[12px] text-slate-400">{kind}</span>}
      {weight !== null && <span className="ml-auto flex-none tabular-nums text-[12px] text-slate-500">{weight}%</span>}
    </p>
  )
}

function ExperiencePreview({ item }: { item: V10Ref }) {
  return <ExperienceBody source={item.source} id={item.id} />
}

function ExperienceBody({ source, id }: { source: V10Ref['source']; id: string }) {
  if (source === 'growth') return <GrowthBody id={id} />
  return <CancelPageBody id={id} />
}

function GrowthBody({ id }: { id: string }) {
  const experience = useGrowthExperiences((state) => state.items.find((entry) => entry.id === id))
  const offer = useGrowthLibrary((state) => state.offers.find((entry) => entry.id === experience?.refId))
  const table = useGrowthLibrary((state) => state.pricingTables.find((entry) => entry.id === experience?.refId))
  if (!experience) return <p className="text-[13px] text-slate-500">This experience was deleted.</p>
  if (experience.type === 'pricing_table' && table) return <Zoom factor={0.62}><PricingPreview table={table} /></Zoom>
  if (experience.type !== 'pricing_table' && offer) return <Zoom factor={0.82}><OfferPreview offer={offer} /></Zoom>
  return <p className="rounded-md bg-slate-50 px-[10px] py-[12px] text-[12.5px] text-slate-500">No {experience.type === 'pricing_table' ? 'pricing table' : 'offer'} picked yet.</p>
}

/** Renders a full-size preview smaller, keeping its layout. */
function Zoom({ factor, children }: { factor: number; children: ReactNode }) {
  return <div style={{ zoom: factor }}>{children}</div>
}

function CancelPageBody({ id }: { id: string }) {
  const thread = useWorkspace((state) => state.threads.find((entry) => entry.id === id))
  const activeId = useWorkspace((state) => state.activeId)
  const compiled = useMemo(() => {
    if (!thread) return null
    const file = fileOfThread(thread)
    const { experience } = compileJourney(file)
    return { experience, acquire: file.kind === 'acquisition', steps: experience.steps.filter((step) => !step.disabled) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, activeId])
  if (!thread || !compiled) return <p className="text-[13px] text-slate-500">This experience was deleted.</p>
  if (compiled.steps.length === 0) return <p className="rounded-md bg-slate-50 px-[10px] py-[12px] text-[12.5px] text-slate-500">No screens yet.</p>
  const { experience, acquire, steps } = compiled
  return (
    <div>
      <div className="-mx-[14px] flex gap-[12px] overflow-x-auto px-[14px] pb-[6px]">
        {steps.map((step, index) => (
          <TemplateStepThumb
            key={step.id}
            step={step}
            index={index}
            total={steps.length}
            branding={experience.branding}
            frame={experience.frame}
            acquire={acquire}
            scale={acquire ? 0.38 : 0.4}
          />
        ))}
      </div>
      <p className="mt-[4px] text-[12px] text-slate-500">
        {steps.length} screen{steps.length === 1 ? '' : 's'}: {steps.map((step) => step.title).filter(Boolean).join(', ')}
      </p>
    </div>
  )
}

function AudiencePreview({ id }: { id: string }) {
  const audience = useAudiences((state) => state.items.find((entry) => entry.id === id))
  const growth = useGrowthPlays((state) => state.plays)
  const retention = usePlays((state) => state.plays)
  if (!audience) return <p className="text-[13px] text-slate-500">This audience was deleted.</p>
  const used = (target: { savedAudienceId?: string | null; name?: string } | undefined) => target?.savedAudienceId === id || target?.name === audience.name
  const plays = [...growth, ...retention].filter((play) => used(play.audience) || play.subAudiences.some((sub) => used(sub.audience)))
  const rules = (audience.conditions ?? []).filter((condition) => condition.property)
  const join = audience.match ?? 'AND'
  return (
    <div className="space-y-[14px]">
      <div>
        <Label>Who is in it</Label>
        {audience.targetAll ? (
          <p className="text-[13px] text-slate-700">All subscribers</p>
        ) : rules.length === 0 ? (
          <p className="text-[13px] text-slate-500">No rules yet, so nobody matches.</p>
        ) : (
          <ol className="space-y-[6px]">
            {rules.map((rule, index) => (
              <RuleLine key={rule.id} rule={rule} join={index === 0 ? null : join} />
            ))}
          </ol>
        )}
      </div>
      <div>
        <Label>Used in</Label>
        {plays.length === 0 ? (
          <p className="text-[13px] text-slate-500">Not in a play yet.</p>
        ) : (
          <ul className="space-y-[4px]">
            {plays.map((play) => (
              <li key={play.id} className="flex items-center gap-[6px] text-[13px] text-slate-700">
                <span className={`h-[6px] w-[6px] flex-none rounded-full ${play.status === 'live' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="min-w-0 truncate">{play.name}</span>
                <span className="ml-auto flex-none text-[12px] text-slate-400">{play.status === 'live' ? 'Live' : 'Draft'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function RuleLine({ rule, join }: { rule: AudienceCondition; join: string | null }) {
  return (
    <li className="flex items-start gap-[8px]">
      <span className="w-[30px] flex-none pt-[3px] text-[11px] font-semibold text-slate-400">{join ?? 'WHERE'}</span>
      <span className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-[8px] py-[4px] text-[12.5px] text-slate-700">{conditionExpression([rule], 'AND')}</span>
    </li>
  )
}
