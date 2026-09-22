import { useEffect } from 'react'
import { LibraryBrowse } from './LibraryBrowse'
import { YoursBrowse } from './YoursBrowse'
import { useOrchestration } from '../store/useOrchestration'
import type { LibraryTab } from './copilotStage'

export function LibraryPanel() {
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
      if (e.key === 'Escape') closeTemplates()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeTemplates])

  const startNew = () => {
    closeTemplates()
    chooseDoor('upload')
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div className="flex flex-none items-center justify-between border-b border-slate-100 px-[20px] py-[14px]">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Template library</h2>
          <p className="text-[12px] text-slate-500">
            {libraryTab === 'yours'
              ? 'Journeys and components you already scanned.'
              : 'Chargebee postures. Copilot takes it from there.'}
          </p>
        </div>
        <button
          type="button"
          onClick={closeTemplates}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex flex-none gap-[6px] border-b border-slate-100 px-[20px] py-[10px]">
        {(['ours', 'yours'] as const).map((id) => (
          <Tab key={id} id={id} active={libraryTab === id} onClick={() => setLibraryTab(id)} />
        ))}
      </div>
      {libraryTab === 'yours' ? (
        <YoursBrowse
          onApplyJourney={(id) => applyMerchantTemplate(id)}
          onApplyComponents={(ids) => applyMerchantComponents(ids)}
          onDone={() => finishMerchantComponents()}
          onUpload={startNew}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <LibraryBrowse onApply={(id) => applyLibraryTemplate(id)} />
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

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-none gap-[6px] border-b border-slate-100 px-[16px] py-[10px]">
        {(['ours', 'yours'] as const).map((id) => (
          <Tab key={id} id={id} active={libraryTab === id} onClick={() => setLibraryTab(id)} />
        ))}
      </div>
      {libraryTab === 'yours' ? (
        <YoursBrowse
          compact
          onApplyJourney={(id) => applyMerchantTemplate(id)}
          onApplyComponents={(ids) => applyMerchantComponents(ids)}
          onDone={() => finishMerchantComponents()}
          onUpload={onUpload}
        />
      ) : (
        <div className="px-[16px] py-[12px]">
          <LibraryBrowse compact onApply={(id) => applyLibraryTemplate(id)} />
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
      {id === 'ours' ? 'Chargebee' : 'My templates'}
    </button>
  )
}

export function TemplatesModal() {
  const closeTemplates = useOrchestration((s) => s.closeTemplates)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeTemplates} />
      <div className="relative flex h-[740px] w-[880px] max-w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
        <LibraryPanel />
      </div>
    </div>
  )
}
