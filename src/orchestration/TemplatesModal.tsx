import { LibraryBrowse } from './LibraryBrowse'
import { useOrchestration } from '../store/useOrchestration'

export function TemplatesModal() {
  const closeTemplates = useOrchestration((s) => s.closeTemplates)
  const applyLibraryTemplate = useOrchestration((s) => s.applyLibraryTemplate)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeTemplates} />
      <div className="relative flex h-[740px] w-[720px] max-w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-none items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Template library</h2>
              <p className="text-[12px] text-slate-500">Stage chains, not step counts.</p>
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
          <LibraryBrowse onApply={(id) => applyLibraryTemplate(id)} />
        </div>
      </div>
    </div>
  )
}
