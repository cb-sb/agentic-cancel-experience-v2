import { useState } from 'react'
import { SButton, SIcon, type SIconName } from '@chargebee/sting-react'
import { BackButton } from '../../shell/BackButton'
import { Chip, InlineName, RowMenu, toast, type MenuItem } from '../../plays/ui'
import { AgentSlot } from '../AgentSlot'
import { TRIGGER_LABEL, TYPE_LABEL, WIDGET_LABEL, objectiveLabel, type GrowthExperience, type TriggerKind } from '../model'
import { OfferPreview, PricingPreview } from '../Previews'
import { renameGrowthExperience, updateGrowthExperience, useGrowthExperiences } from '../useGrowthExperiences'
import { useGrowthLibrary } from '../useGrowthLibrary'
import { addToGrowthPlay, growthExperienceLive, growthPlaysUsing, useGrowthPlays } from '../useGrowthPlays'
import { CopilotColumn, Field, inputCls, TabStrip } from './ui'
import { goGrowth, openGrowthPlay, setGrowthView, setRenaming, useGrowthUi, useGrowthView } from './useGrowthUi'

interface Door {
  id: 'library' | 'template' | 'copilot'
  title: string
  body: string
  icon: SIconName
}

function doors(x: GrowthExperience): Door[] {
  const table = x.type === 'pricing_table'
  return [
    {
      id: 'library',
      title: table ? 'Pick a pricing table from your Library' : 'Pick an offer from your Library',
      body: table ? 'Use a table you already set up.' : 'Use an offer you already set up.',
      icon: table ? 'table' : 'gift',
    },
    {
      id: 'template',
      title: 'Start from a template',
      body: table ? 'Pick a proven layout of plans and change what you need.' : 'Pick a proven offer and change the words and value.',
      icon: 'layout-template',
    },
    { id: 'copilot', title: 'Start with Copilot', body: 'Tell Copilot what you want it to do and it puts it together.', icon: 'sparkles' },
  ]
}

function useLibraryRows(x: GrowthExperience) {
  const offers = useGrowthLibrary((s) => s.offers)
  const tables = useGrowthLibrary((s) => s.pricingTables)
  const rows =
    x.type === 'pricing_table'
      ? tables.filter((t) => t.status !== 'archived').map((t) => ({ id: t.id, name: t.name, meta: t.plans.map((p) => p.name).join(' · '), fits: t.objective === x.objective }))
      : offers.filter((o) => o.status !== 'archived').map((o) => ({ id: o.id, name: o.name, meta: `${WIDGET_LABEL[o.widget]} · ${o.value}`, fits: o.objective === x.objective }))
  return [...rows].sort((a, b) => Number(b.fits) - Number(a.fits))
}

function LibraryPicker({ x, onBack }: { x: GrowthExperience; onBack: () => void }) {
  const rows = useLibraryRows(x)
  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-[640px] px-[24px] py-[40px]">
        <button type="button" onClick={onBack} className="mb-[12px] inline-flex items-center gap-[6px] text-[13px] text-slate-500 hover:text-slate-900">
          <SIcon name="arrow-left" size={14} />
          Back
        </button>
        <h1 className="text-[20px] font-semibold text-slate-900">{x.type === 'pricing_table' ? 'Pick a pricing table' : 'Pick an offer'}</h1>
        <div className="mt-[14px] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          {rows.length === 0 && <p className="px-[16px] py-[14px] text-[13px] text-slate-500">Your Library has none yet. Start from a template instead.</p>}
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => updateGrowthExperience(x.id, { refId: r.id })}
              className="flex items-center justify-between gap-[12px] border-t border-slate-100 px-[16px] py-[12px] text-left first:border-t-0 hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-slate-900">{r.name}</span>
                <span className="block truncate text-[12.5px] text-slate-500">{r.meta}</span>
              </span>
              {r.fits && <Chip>{objectiveLabel(x.objective)}</Chip>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Doorway({ x }: { x: GrowthExperience }) {
  const [picking, setPicking] = useState(false)
  if (picking) return <LibraryPicker x={x} onBack={() => setPicking(false)} />
  const pick = (d: Door) => {
    if (d.id === 'library') setPicking(true)
    else if (d.id === 'template') goGrowth(x.objective, { page: 'templates', fillId: x.id, templateType: x.type })
    else setGrowthView(x.objective, { withCopilot: true })
  }
  return (
    <div className="relative flex h-full min-h-0 items-center justify-center overflow-y-auto bg-slate-100 px-[24px] py-[40px]">
      <div className="absolute left-[16px] top-[14px]">
        <BackButton fallback={() => goGrowth(x.objective, { page: 'index' })} />
      </div>
      <div className="flex max-w-[860px] flex-col items-center gap-[32px]">
        <div className="text-center">
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Start {x.type === 'pricing_table' ? 'a pricing table' : 'an in-app offer'}</h1>
          <p className="mt-[4px] text-[13.5px] text-slate-500">{x.name}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-[16px]">
          {doors(x).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => pick(d)}
              className="w-[260px] rounded-2xl border border-slate-200 bg-white p-[18px] text-left transition-transform duration-200 hover:-translate-y-[6px]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-indigo-50 text-indigo-600">
                <SIcon name={d.icon} size={18} />
              </span>
              <p className="mt-[12px] text-[14px] font-semibold text-slate-900">{d.title}</p>
              <p className="mt-[4px] text-[12.5px] leading-[1.5] text-slate-500">{d.body}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Preview({ x }: { x: GrowthExperience }) {
  const offer = useGrowthLibrary((s) => s.offers.find((o) => o.id === x.refId))
  const table = useGrowthLibrary((s) => s.pricingTables.find((t) => t.id === x.refId))
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[760px] px-[28px] py-[24px]">
        {offer ? <OfferPreview offer={offer} /> : table ? <PricingPreview table={table} /> : <p className="py-[60px] text-center text-[13px] text-slate-500">The Library item it pointed to is gone. Pick another in the Summary.</p>}
      </div>
    </div>
  )
}

function Summary({ x }: { x: GrowthExperience }) {
  const rows = useLibraryRows(x).filter((r) => r.fits || r.id === x.refId)
  const plays = useGrowthPlays((s) => s.plays)
  const usedBy = growthPlaysUsing(x.id, plays)
  const addItems: MenuItem[] = plays
    .filter((p) => p.objective === x.objective && !usedBy.includes(p))
    .map((p) => ({
      label: p.name,
      icon: 'folder-input',
      onClick: () => {
        addToGrowthPlay(p.id, x.id)
        toast(`${x.name} is now in ${p.name}`)
      },
    }))
  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="mx-auto max-w-[720px] px-[28px] py-[24px]">
        <div className="rounded-xl border border-slate-200 bg-white px-[16px]">
          <Field label={x.type === 'pricing_table' ? 'Pricing table' : 'Offer'} hint="From your Library">
            <div className="flex items-center gap-[8px]">
              <select className={inputCls} value={x.refId ?? ''} onChange={(e) => updateGrowthExperience(x.id, { refId: e.target.value || null })}>
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => goGrowth(x.objective, { page: x.type === 'pricing_table' ? 'pricing_tables' : 'offers' })}
                className="flex-none text-[12.5px] font-medium text-slate-600 hover:text-slate-900"
              >
                Edit in Library
              </button>
            </div>
          </Field>
          <Field label="When it shows">
            <div className="flex gap-[8px]">
              <select
                className={inputCls}
                value={x.trigger.kind}
                onChange={(e) => updateGrowthExperience(x.id, { trigger: { kind: e.target.value as TriggerKind, value: x.trigger.value } })}
              >
                {(Object.keys(TRIGGER_LABEL) as TriggerKind[]).map((k) => (
                  <option key={k} value={k}>
                    {TRIGGER_LABEL[k]}
                  </option>
                ))}
              </select>
              {x.trigger.kind !== 'any_page' && (
                <input
                  className={inputCls}
                  placeholder={x.trigger.kind === 'url' ? '/billing' : 'event_name'}
                  value={x.trigger.value ?? ''}
                  onChange={(e) => updateGrowthExperience(x.id, { trigger: { ...x.trigger, value: e.target.value } })}
                />
              )}
            </div>
          </Field>
          <Field label="Plays" hint="Who sees it, the split and the control group are set on the play">
            <div className="flex flex-wrap items-center gap-[6px]">
              {usedBy.length === 0 && <span className="text-[13px] text-slate-500">Not in a play yet, so nobody sees it.</span>}
              {usedBy.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openGrowthPlay(x.objective, p.id)}
                  className="rounded-full border border-slate-200 px-[10px] py-[3px] text-[12.5px] font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
                >
                  {p.name}
                </button>
              ))}
              {addItems.length > 0 && (
                <span className="inline-flex items-center">
                  <RowMenu label="Add to a play" icon="plus" align="left" items={addItems} />
                </span>
              )}
            </div>
          </Field>
        </div>
      </div>
    </div>
  )
}

/** One in-app offer or pricing table: a doorway while it's blank, then its tabs beside Copilot. */
export function ExperiencePage({ objective }: { objective: GrowthExperience['objective'] }) {
  const view = useGrowthView(objective)
  const x = useGrowthExperiences((s) => s.items.find((i) => i.id === view.experienceId))
  const plays = useGrowthPlays((s) => s.plays)
  const renaming = useGrowthUi((s) => s.renaming === x?.id)

  if (!x) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-[8px] text-center">
        <p className="text-[13px] text-slate-500">This experience was deleted. Pick another from the left.</p>
        <SButton size="small" variant="neutral-outline" className="w-auto" onClick={() => goGrowth(objective, { page: 'index' })}>
          See all experiences
        </SButton>
      </div>
    )
  }

  if (!x.refId && view.withCopilot) {
    return (
      <div className="relative flex h-full min-h-0 min-w-0 flex-1 justify-center bg-white">
        <div className="absolute left-[16px] top-[14px] z-10">
          <BackButton onBack={() => setGrowthView(objective, { withCopilot: false })} />
        </div>
        <div className="flex h-full w-full max-w-[640px] flex-col border-x border-slate-100">
          <AgentSlot subtitle={x.name} />
        </div>
      </div>
    )
  }

  if (!x.refId) return <Doorway x={x} />

  const live = growthExperienceLive(x.id, plays)
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[52px] flex-none items-center gap-[10px] border-b border-slate-200 px-[16px]">
          <BackButton fallback={() => goGrowth(objective, { page: 'index' })} className="-ml-[6px]" />
          <InlineName
            value={x.name}
            editing={renaming}
            onStart={() => setRenaming(x.id)}
            onDone={() => setRenaming(null)}
            onCommit={(name) => renameGrowthExperience(x.id, name)}
            className="text-[15px] font-semibold text-slate-900"
            inputClassName="text-[15px] font-semibold"
          />
          <Chip>{TYPE_LABEL[x.type]}</Chip>
          <Chip tone={live ? 'emerald' : 'amber'}>{live ? 'Live' : 'Draft'}</Chip>
        </header>
        <TabStrip
          tabs={[
            { id: 'preview', label: 'Preview', icon: 'eye' },
            { id: 'summary', label: 'Summary', icon: 'file-text' },
          ]}
          active={view.experienceTab}
          onPick={(experienceTab) => setGrowthView(objective, { experienceTab })}
        />
        <div className="min-h-0 flex-1">{view.experienceTab === 'preview' ? <Preview x={x} /> : <Summary x={x} />}</div>
      </div>
      <CopilotColumn subtitle={x.name} />
    </div>
  )
}
