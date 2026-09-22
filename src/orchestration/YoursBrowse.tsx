import { useMemo, useState } from 'react'
import { SButton } from '@chargebee/sting-react'
import { withLive } from '../journey/templates'
import { attachComponents, startFromComponents } from '../library/apply'
import { useJourney } from '../store/useJourney'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import { CB_KIND_LABELS, CB_KINDS, type CbKind } from '../upload/contract'
import { ChromeThumb } from '../upload/ChromeThumb'
import type { MerchantComponent, MerchantTemplate } from '../library/types'

type KindFilter = 'all' | CbKind
type JourneyFilter = 'all' | string
type SortMode = 'kind' | 'newest' | 'journey'

function kindLabel(kind: string) {
  return CB_KIND_LABELS[kind as CbKind] ?? kind
}

function journeysFor(component: MerchantComponent, templates: MerchantTemplate[]): MerchantTemplate[] {
  return templates.filter((t) => t.componentIds.includes(component.id))
}

function savedAtOf(component: MerchantComponent, templates: MerchantTemplate[]): number {
  if (component.savedAt) return component.savedAt
  const times = journeysFor(component, templates).map((t) => t.savedAt)
  return times.length ? Math.max(...times) : 0
}

function firstJourneyName(component: MerchantComponent, templates: MerchantTemplate[]): string {
  return journeysFor(component, templates)[0]?.name ?? ''
}

export function YoursBrowse({
  onApplyJourney,
  onApplyComponents,
  onDone,
  onUpload,
  compact,
}: {
  onApplyJourney: (id: string) => void
  onApplyComponents: (ids: string[]) => void
  onDone: () => void
  onUpload: () => void
  compact?: boolean
}) {
  const templates = useMerchantLibrary((s) => s.templates)
  const components = useMerchantLibrary((s) => s.components)
  const removeTemplate = useMerchantLibrary((s) => s.removeTemplate)
  const file = useJourney((s) => s.file)
  const replaceFile = useJourney((s) => s.replaceFile)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [journeyFilter, setJourneyFilter] = useState<JourneyFilter>('all')
  const [sort, setSort] = useState<SortMode>('kind')
  const [selected, setSelected] = useState<string[]>([])

  const onThis = useMemo(() => {
    const ids = new Set<string>()
    for (const step of file.steps) {
      const id = step.chrome?.libraryComponentId
      if (id) ids.add(id)
    }
    return ids
  }, [file.steps])

  const kindsPresent = useMemo(() => {
    const have = new Set(components.map((c) => c.kind))
    return CB_KINDS.filter((k) => have.has(k))
  }, [components])

  const visible = useMemo(() => {
    const rows = components.filter((c) => {
      if (kindFilter !== 'all' && c.kind !== kindFilter) return false
      if (journeyFilter !== 'all' && !journeysFor(c, templates).some((t) => t.id === journeyFilter)) {
        return false
      }
      return true
    })
    const copy = [...rows]
    if (sort === 'newest') {
      copy.sort((a, b) => savedAtOf(b, templates) - savedAtOf(a, templates))
    } else if (sort === 'journey') {
      copy.sort((a, b) =>
        firstJourneyName(a, templates).localeCompare(firstJourneyName(b, templates)),
      )
    } else {
      copy.sort((a, b) => CB_KINDS.indexOf(a.kind as CbKind) - CB_KINDS.indexOf(b.kind as CbKind))
    }
    return copy
  }, [components, kindFilter, journeyFilter, sort, templates])

  const grouped = useMemo(() => {
    if (sort !== 'kind') return [{ kind: null as CbKind | null, rows: visible }]
    const groups: { kind: CbKind; rows: MerchantComponent[] }[] = []
    for (const kind of kindsPresent) {
      const rows = visible.filter((c) => c.kind === kind)
      if (rows.length) groups.push({ kind, rows })
    }
    return groups
  }, [sort, visible, kindsPresent])

  const blank = file.steps.length === 0
  const picked = selected.filter((id) => !onThis.has(id))

  const toggle = (id: string) => {
    if (onThis.has(id)) return
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  const addPicked = () => {
    if (picked.length === 0) return
    const comps = picked
      .map((id) => components.find((c) => c.id === id))
      .filter((c): c is MerchantComponent => c != null)
    if (comps.length === 0) return
    const current = useJourney.getState().file
    const next =
      current.steps.length === 0
        ? startFromComponents(current, comps)
        : attachComponents(current, comps)
    replaceFile({ ...next, steps: withLive(next.steps, true) })
    onApplyComponents(picked)
    setSelected([])
  }

  if (templates.length === 0 && components.length === 0) {
    return (
      <div className={compact ? 'px-[4px] py-[16px]' : 'px-6 py-10'}>
        <p className="text-[14px] font-semibold text-slate-800">No saved templates yet</p>
        <p className="mt-[6px] text-[13px] leading-relaxed text-slate-500">
          Scan a marked HTML pack. After Copilot reviews the contract, the journey and each primitive land here.
        </p>
        <button
          type="button"
          onClick={onUpload}
          className="mt-[14px] rounded-xl bg-slate-900 px-[14px] py-[8px] text-[13px] font-semibold text-white hover:bg-slate-800"
        >
          Upload a template
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={
          compact
            ? 'flex flex-col gap-[16px] px-[16px] py-[12px]'
            : 'min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5'
        }
      >
        {templates.length > 0 && (
          <section>
            <p className="mb-[10px] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Journeys
            </p>
            <div className="space-y-[10px]">
              {templates.map((t) => (
                <JourneyCard
                  key={t.id}
                  template={t}
                  onApply={() => onApplyJourney(t.id)}
                  onRemove={() => removeTemplate(t.id)}
                />
              ))}
            </div>
          </section>
        )}
        {components.length > 0 && (
          <section>
            <p className="mb-[10px] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Components
            </p>
            <p className="mb-[10px] text-[12.5px] text-slate-500">
              Shared primitives. Tick what you want, then add them. The library stays open.
            </p>
            <div className="mb-[12px] flex flex-col gap-[8px]">
              <PillRow
                label="Kind"
                pills={[
                  { id: 'all', label: 'All', count: components.length },
                  ...kindsPresent.map((k) => ({
                    id: k,
                    label: kindLabel(k),
                    count: components.filter((c) => c.kind === k).length,
                  })),
                ]}
                selected={kindFilter}
                onSelect={(id) => setKindFilter(id as KindFilter)}
              />
              {templates.length > 0 && (
                <PillRow
                  label="From"
                  pills={[
                    { id: 'all', label: 'Any journey', count: components.length },
                    ...templates.map((t) => ({
                      id: t.id,
                      label: t.name,
                      count: t.componentIds.filter((id) => components.some((c) => c.id === id)).length,
                    })),
                  ]}
                  selected={journeyFilter}
                  onSelect={(id) => setJourneyFilter(id)}
                />
              )}
              <div className="flex items-center gap-[8px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Sort
                </p>
                <div
                  role="group"
                  aria-label="Sort components"
                  className="inline-flex w-fit max-w-full flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-[3px]"
                >
                  {(
                    [
                      ['kind', 'Kind'],
                      ['newest', 'Newest'],
                      ['journey', 'Journey name'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={sort === id}
                      onClick={() => setSort(id)}
                      className={`rounded-md px-[10px] py-[5px] text-[12px] font-medium ${
                        sort === id ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {visible.length === 0 ? (
              <p className="text-[13px] text-slate-500">Nothing matches these filters.</p>
            ) : (
              grouped.map((group) => (
                <div key={group.kind ?? 'flat'} className={group.kind ? 'mb-[14px]' : undefined}>
                  {group.kind && sort === 'kind' && (
                    <p className="mb-[8px] text-[12px] font-semibold text-slate-600">
                      {kindLabel(group.kind)}
                      <span className="ml-[6px] font-normal text-slate-400">{group.rows.length}</span>
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
                    {group.rows.map((c) => (
                      <ComponentCard
                        key={c.id}
                        component={c}
                        journeys={journeysFor(c, templates)}
                        onThis={onThis.has(c.id)}
                        selected={selected.includes(c.id)}
                        onToggle={() => toggle(c.id)}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </div>
      {components.length > 0 && (
        <div className="flex flex-none flex-wrap items-center justify-end gap-[8px] border-t border-slate-100 px-[20px] py-[12px]">
          <p className="mr-auto text-[12px] text-slate-500">
            {picked.length === 0
              ? 'Tick screens to add them. Already-on cards stay marked.'
              : `${picked.length} selected`}
          </p>
          {picked.length > 0 && (
            <SButton size="small" variant="neutral-ghost" className="w-auto shrink-0" onClick={() => setSelected([])}>
              Clear
            </SButton>
          )}
          {picked.length > 0 && (
            <SButton size="small" variant="primary" className="w-auto shrink-0" onClick={addPicked}>
              {blank
                ? `Start with ${picked.length} screen${picked.length === 1 ? '' : 's'}`
                : `Add ${picked.length} to this experience`}
            </SButton>
          )}
          <SButton size="small" variant="neutral" className="w-auto shrink-0" onClick={onDone}>
            Done
          </SButton>
        </div>
      )}
    </div>
  )
}

function PillRow({
  label,
  pills,
  selected,
  onSelect,
}: {
  label: string
  pills: { id: string; label: string; count: number }[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-[6px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <div
        role="group"
        aria-label={label}
        className="inline-flex w-fit max-w-full flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-[3px]"
      >
        {pills.map((pill) => {
          const on = selected === pill.id
          return (
            <button
              key={pill.id}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(pill.id)}
              className={`rounded-md px-[10px] py-[5px] text-[12px] font-medium ${
                on ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {pill.label}
              <span className={`ml-[4px] text-[11px] font-normal ${on ? 'text-slate-500' : 'text-slate-400'}`}>
                {pill.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function JourneyCard({
  template,
  onApply,
  onRemove,
}: {
  template: MerchantTemplate
  onApply: () => void
  onRemove: () => void
}) {
  const kindLabelText = template.kind === 'acquisition' ? 'Acquire' : 'Cancel'
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-[16px] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-[12px]">
        <div>
          <div className="text-[14px] font-bold text-slate-900">{template.name}</div>
          <div className="mt-[4px] text-[12px] font-medium text-slate-500">
            {template.stepLabels.join(' → ')} · {kindLabelText}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="text-[12px] font-semibold text-slate-400 hover:text-rose-600"
        >
          Remove
        </button>
      </div>
      <button
        type="button"
        onClick={onApply}
        className="mt-[12px] text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700"
      >
        Use this template →
      </button>
    </div>
  )
}

function ComponentCard({
  component,
  journeys,
  onThis,
  selected,
  onToggle,
}: {
  component: MerchantComponent
  journeys: MerchantTemplate[]
  onThis: boolean
  selected: boolean
  onToggle: () => void
}) {
  const used =
    journeys.length === 0
      ? 'Not on a saved journey'
      : journeys.length === 1
        ? `In: ${journeys[0].name}`
        : `In: ${journeys.map((t) => t.name).join(', ')}`
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={onThis ? true : selected}
      disabled={onThis}
      className={`rounded-2xl border bg-white p-[12px] text-left transition-shadow ${
        onThis
          ? 'cursor-default border-indigo-200 shadow-none'
          : selected
            ? 'border-indigo-400 shadow-[0_12px_28px_-18px_rgba(15,23,42,0.35)]'
            : 'border-slate-200/90 hover:border-slate-300 hover:shadow-[0_12px_28px_-18px_rgba(15,23,42,0.35)]'
      }`}
    >
      <ChromeThumb html={component.html} css={component.css} label={kindLabel(component.kind)} />
      <div className="mt-[10px] flex items-start justify-between gap-[8px]">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-slate-900">{kindLabel(component.kind)}</div>
          <div className="mt-[3px] text-[12px] leading-snug text-slate-500">{used}</div>
        </div>
        {onThis ? (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-normal text-[#4f46e5] bg-[#eef2ff]">
            On this experience
          </span>
        ) : (
          <span
            className={`mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border ${
              selected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300 bg-white'
            }`}
            aria-hidden
          >
            {selected && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5.2 4.1 7.2 8 2.8" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        )}
      </div>
    </button>
  )
}
