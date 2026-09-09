import { useEffect, useMemo, useState } from 'react'
import { LIBRARY, type LibraryEntry, type LibraryKind } from '../journey/templates'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { TemplatePreviewStrip } from './TemplatePreviewStrip'

type Filter = 'all' | LibraryKind

const RAIL: { id: Filter; label: string; hint: string }[] = [
  { id: 'all', label: 'All', hint: 'Every journey' },
  { id: 'cancel', label: 'Cancel', hint: 'Save and exit' },
  { id: 'acquisition', label: 'Acquisition', hint: 'Pricing to checkout' },
]

const SECTION: Record<LibraryKind, { title: string; lede: string }> = {
  cancel: {
    title: 'Cancel',
    lede: 'Save and exit journeys for people who already subscribe.',
  },
  acquisition: {
    title: 'Acquisition',
    lede: 'Pricing and checkout for people who are not subscribers yet.',
  },
}

function matchesQuery(entry: LibraryEntry, q: string) {
  if (!q) return true
  return (
    entry.title.toLowerCase().includes(q) ||
    entry.why.toLowerCase().includes(q) ||
    entry.stepLabels.some((l) => l.toLowerCase().includes(q))
  )
}

function LibraryCard({
  entry,
  onApply,
  showKind,
}: {
  entry: LibraryEntry
  onApply: () => void
  showKind: boolean
}) {
  const brand = useJourney((s) => s.file.brand)
  const kindLabel = entry.kind === 'acquisition' ? 'Acquire' : 'Cancel'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onApply}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onApply()
        }
      }}
      className="group w-full cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_12px_28px_-18px_rgba(15,23,42,0.35)]"
    >
      <TemplatePreviewStrip entry={entry} brand={brand} />
      <div className="px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-bold leading-snug text-slate-900">{entry.title}</div>
            <div className="mt-1 text-[12px] font-medium text-slate-400">
              {entry.stepCount} step{entry.stepCount === 1 ? '' : 's'}
              {showKind ? ` · ${kindLabel}` : ''}
            </div>
          </div>
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-slate-600">{entry.why}</p>
        <span className="mt-3.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-indigo-600 group-hover:text-indigo-700">
          Use this template
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </div>
  )
}

export function TemplatesModal() {
  const closeTemplates = useOrchestration((s) => s.closeTemplates)
  const applyLibraryTemplate = useOrchestration((s) => s.applyLibraryTemplate)
  const [cat, setCat] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTemplates()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeTemplates])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LIBRARY.filter((e) => (cat === 'all' || e.kind === cat) && matchesQuery(e, q))
  }, [cat, query])

  const sections = useMemo(() => {
    const kinds: LibraryKind[] = cat === 'all' ? ['cancel', 'acquisition'] : [cat]
    return kinds
      .map((kind) => ({
        kind,
        ...SECTION[kind],
        entries: rows.filter((e) => e.kind === kind),
      }))
      .filter((s) => s.entries.length > 0)
  }, [cat, rows])

  const counts = useMemo(
    () => ({
      all: LIBRARY.length,
      cancel: LIBRARY.filter((e) => e.kind === 'cancel').length,
      acquisition: LIBRARY.filter((e) => e.kind === 'acquisition').length,
    }),
    [],
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeTemplates} />
      <div className="relative flex h-[740px] w-[1080px] max-w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
        <aside className="flex w-[212px] flex-none flex-col border-r border-slate-100 bg-slate-50/80 px-4 py-5">
          <div className="mb-6 flex items-center gap-2.5 px-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              C
            </span>
            <span className="text-[13px] font-bold text-slate-900">Template library</span>
          </div>
          <p className="mb-2 px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Browse</p>
          <nav className="space-y-1.5">
            {RAIL.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCat(item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors ${
                  cat === item.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <span>
                  <span className="block text-[13px] font-semibold">{item.label}</span>
                  <span className={`block text-[11px] ${cat === item.id ? 'text-white/60' : 'text-slate-400'}`}>
                    {item.hint}
                  </span>
                </span>
                <span className={`text-[11px] font-semibold tabular-nums ${cat === item.id ? 'text-white/70' : 'text-slate-400'}`}>
                  {counts[item.id]}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-slate-50/40">
          <div className="flex flex-none items-center gap-3 border-b border-slate-100 bg-white px-6 py-4">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search templates"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400"
              />
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

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {rows.length === 0 ? (
              <p className="py-16 text-center text-[13px] text-slate-400">No templates match that search.</p>
            ) : (
              <div className="space-y-10">
                {sections.map((section, i) => (
                  <section key={section.kind} className={i > 0 ? 'border-t border-slate-200 pt-8' : undefined}>
                    <header className="mb-3.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{section.title}</h3>
                        <span className="text-[11px] font-medium tabular-nums text-slate-400">
                          {section.entries.length} template{section.entries.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <p className="mt-1.5 max-w-[40rem] text-[13px] leading-relaxed text-slate-600">{section.lede}</p>
                    </header>
                    <div className="space-y-5">
                      {section.entries.map((entry) => (
                        <LibraryCard
                          key={entry.id}
                          entry={entry}
                          showKind={cat === 'all'}
                          onApply={() => applyLibraryTemplate(entry.id)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
