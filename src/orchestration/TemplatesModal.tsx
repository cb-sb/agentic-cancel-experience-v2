import { useEffect, useState } from 'react'
import { SIcon } from '@chargebee/sting-react'
import type { JourneyKind } from '../journey/types'
import { LibraryBrowse } from './LibraryBrowse'
import { YoursBrowse } from './YoursBrowse'
import { V8 } from '../layout/layoutMode'
import { BackButton } from '../shell/BackButton'
import { goBack } from '../shell/navHistory'
import { useOrchestration } from '../store/useOrchestration'
import { startFromLibrary, startFromSaved, startUploadPage } from '../workspace/useWorkspace'
import { useCopilotStage, type LibraryTab } from './copilotStage'

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  )
}

function CollapseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H3v6M15 21h6v-6M3 3l7 7M21 21l-7-7" />
    </svg>
  )
}

/** `page`: v7 shows the library in the main column, left with Back. */
export function LibraryPanel({ page = false }: { page?: boolean }) {
  const closeTemplates = useOrchestration((s) => s.closeTemplates)
  const applyLibraryTemplate = useOrchestration((s) => s.applyLibraryTemplate)
  const applyMerchantTemplate = useOrchestration((s) => s.applyMerchantTemplate)
  const applyMerchantComponents = useOrchestration((s) => s.applyMerchantComponents)
  const finishMerchantComponents = useOrchestration((s) => s.finishMerchantComponents)
  const libraryTab = useOrchestration((s) => s.libraryTab)
  const setLibraryTab = useOrchestration((s) => s.setLibraryTab)
  const chooseDoor = useOrchestration((s) => s.chooseDoor)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (page && V8) goBack(closeTemplates)
      else closeTemplates()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeTemplates, page])

  const startNew = () => {
    if (V8) return startUploadPage()
    closeTemplates()
    chooseDoor('upload')
  }

  if (page && V8) return <GrowthLibraryPage onUpload={startNew} />

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div
        className={`flex flex-none items-center justify-between border-b border-slate-100 px-[20px] ${
          page ? 'h-[60px]' : 'py-[14px]'
        }`}
      >
        <div className={page ? 'flex min-w-0 items-center gap-[10px]' : undefined}>
          {page && (
            <button
              type="button"
              onClick={closeTemplates}
              aria-label="Back"
              title="Back"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <SIcon name="arrow-left" size={16} />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-slate-900">
              {page && V8
                ? 'Templates and components'
                : page
                  ? libraryTab === 'yours'
                    ? 'Saved components'
                    : 'Templates'
                  : 'Template library'}
            </h2>
            <p className="text-[12px] text-slate-500">
              {libraryTab === 'yours'
                ? 'Loss-aversion cards, survey reasons, and offers you can reuse, plus anything you uploaded.'
                : 'A short list of cancel jobs. Pick one and edit it beside Growth Copilot.'}
            </p>
          </div>
        </div>
        {!page && (
          <button
            type="button"
            onClick={closeTemplates}
            aria-label="Close"
            className="inline-flex items-center gap-[6px] rounded-lg px-[10px] py-[6px] text-[12.5px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <CollapseIcon />
            Close
          </button>
        )}
      </div>
      <div className="flex flex-none gap-[6px] border-b border-slate-100 px-[20px] py-[10px]">
        {(['ours', 'yours'] as const).map((id) => (
          <Tab key={id} id={id} active={libraryTab === id} onClick={() => setLibraryTab(id)} />
        ))}
      </div>
      {libraryTab === 'yours' ? (
        <YoursBrowse
          onApplyJourney={(id) => (V8 ? startFromSaved(id) : applyMerchantTemplate(id))}
          onApplyComponents={(ids) => applyMerchantComponents(ids)}
          onDone={() => finishMerchantComponents()}
          onUpload={startNew}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <LibraryBrowse onApply={(id) => (V8 ? startFromLibrary(id) : applyLibraryTemplate(id))} />
        </div>
      )}
    </div>
  )
}

type GrowthArea = 'acquisition' | 'expansion' | 'retention'

const GROWTH_AREAS: { id: GrowthArea; label: string; kind: JourneyKind | null }[] = [
  { id: 'acquisition', label: 'Acquisition', kind: 'acquisition' },
  { id: 'expansion', label: 'Expansion', kind: null },
  { id: 'retention', label: 'Retention', kind: 'cancel' },
]

/** v8: growth area tabs on top, Templates and Saved components under each. */
function GrowthLibraryPage({ onUpload }: { onUpload: () => void }) {
  const closeTemplates = useOrchestration((s) => s.closeTemplates)
  const applyMerchantComponents = useOrchestration((s) => s.applyMerchantComponents)
  const finishMerchantComponents = useOrchestration((s) => s.finishMerchantComponents)
  const libraryTab = useOrchestration((s) => s.libraryTab)
  const setLibraryTab = useOrchestration((s) => s.setLibraryTab)
  const [area, setArea] = useState<GrowthArea>('retention')
  const [query, setQuery] = useState('')
  const kind = GROWTH_AREAS.find((a) => a.id === area)?.kind ?? null

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div className="flex h-[60px] flex-none items-center gap-[10px] border-b border-slate-100 px-[20px]">
        <BackButton fallback={closeTemplates} />
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-slate-900">Templates and components</h2>
          <p className="text-[12px] text-slate-500">Start from a template, or reuse screens and offers you saved.</p>
        </div>
      </div>
      <div className="flex flex-none items-center justify-between gap-[16px] border-b border-slate-200 px-[20px]">
        <div role="tablist" aria-label="Growth area" className="flex gap-[20px]">
          {GROWTH_AREAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={area === a.id}
              onClick={() => setArea(a.id)}
              className={`-mb-px border-b-2 py-[12px] text-[13px] font-semibold ${
                area === a.id
                  ? 'border-indigo-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex w-[240px] flex-none items-center gap-[8px] rounded-lg border border-slate-200 bg-slate-50/80 px-[10px] py-[6px]">
          <SIcon name="search" size={14} className="flex-none text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={libraryTab === 'yours' ? 'Search saved components' : 'Search templates'}
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>
      <div className="flex flex-none gap-[6px] border-b border-slate-100 px-[20px] py-[10px]">
        {(['ours', 'yours'] as const).map((id) => (
          <Tab key={id} id={id} active={libraryTab === id} onClick={() => setLibraryTab(id)} />
        ))}
      </div>
      {kind === null ? (
        <div className="px-6 py-10">
          <p className="text-[14px] font-semibold text-slate-800">
            {libraryTab === 'yours' ? 'Nothing saved for expansion yet' : 'No expansion templates yet'}
          </p>
          <p className="mt-[6px] text-[13px] leading-relaxed text-slate-500">
            Upgrade and add-on experiences will show here.
          </p>
        </div>
      ) : libraryTab === 'yours' ? (
        <YoursBrowse
          kind={kind}
          query={query}
          onApplyJourney={(id) => startFromSaved(id)}
          onApplyComponents={(ids) => applyMerchantComponents(ids)}
          onDone={() => finishMerchantComponents()}
          onUpload={onUpload}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <LibraryBrowse kind={kind} query={query} onApply={(id) => startFromLibrary(id)} />
        </div>
      )}
    </div>
  )
}

export function CopilotLibrary({ onUpload }: { onUpload: () => void }) {
  const applyLibraryTemplate = useOrchestration((s) => s.applyLibraryTemplate)
  const applyMerchantTemplate = useOrchestration((s) => s.applyMerchantTemplate)
  const applyMerchantComponents = useOrchestration((s) => s.applyMerchantComponents)
  const finishMerchantComponents = useOrchestration((s) => s.finishMerchantComponents)
  const libraryTab = useOrchestration((s) => s.libraryTab)
  const setLibraryTab = useOrchestration((s) => s.setLibraryTab)
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const openTemplates = useOrchestration((s) => s.openTemplates)
  const closeTemplates = useOrchestration((s) => s.closeTemplates)
  const stage = useCopilotStage()
  const copilotDocked = useOrchestration((s) => s.copilotDocked)
  const expanded = templatesOpen && stage === 'center' && !copilotDocked

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTemplates()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded, closeTemplates])

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-[8px] border-b border-slate-100 px-[16px] py-[10px]">
        <div className="flex min-w-0 flex-1 gap-[6px]">
          {(['ours', 'yours'] as const).map((id) => (
            <Tab key={id} id={id} active={libraryTab === id} onClick={() => setLibraryTab(id)} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (expanded ? closeTemplates() : openTemplates())}
          aria-label={expanded ? 'Collapse into Copilot' : 'Expand library'}
          title={expanded ? 'Collapse into Copilot' : 'Expand'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </button>
      </div>
      {libraryTab === 'yours' ? (
        <YoursBrowse
          compact={!expanded}
          onApplyJourney={(id) => applyMerchantTemplate(id)}
          onApplyComponents={(ids) => applyMerchantComponents(ids)}
          onDone={() => finishMerchantComponents()}
          onUpload={onUpload}
        />
      ) : (
        <div className={expanded ? 'min-h-0 px-[8px] py-[12px]' : 'px-[16px] py-[12px]'}>
          <LibraryBrowse compact={!expanded} onApply={(id) => applyLibraryTemplate(id)} />
        </div>
      )}
    </div>
  )
}

function Tab({ id, active, onClick }: { id: LibraryTab; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-[12px] py-[5px] text-[12px] font-semibold ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {V8 ? (id === 'ours' ? 'Templates' : 'Saved components') : id === 'ours' ? 'Chargebee' : 'My templates'}
    </button>
  )
}

export function TemplatesModal() {
  const closeTemplates = useOrchestration((s) => s.closeTemplates)

  return (
    <div className="fixed inset-0 z-[60] flex p-[12px]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeTemplates} />
      <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-2xl">
        <LibraryPanel />
      </div>
    </div>
  )
}
