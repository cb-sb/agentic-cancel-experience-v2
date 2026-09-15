import { useMemo, useState } from 'react'
import { LIBRARY, type LibraryEntry, type LibraryKind } from '../journey/templates'
import { useJourney } from '../store/useJourney'
import { TemplatePreviewStrip } from './TemplatePreviewStrip'

type Filter = 'all' | LibraryKind

function matchesQuery(entry: LibraryEntry, q: string) {
  if (!q) return true
  return (
    entry.title.toLowerCase().includes(q) ||
    entry.posture.toLowerCase().includes(q) ||
    entry.why.toLowerCase().includes(q) ||
    entry.stepLabels.some((l) => l.toLowerCase().includes(q))
  )
}

function LibraryCard({
  entry,
  onApply,
  compact,
}: {
  entry: LibraryEntry
  onApply: () => void
  compact?: boolean
}) {
  const brand = useJourney((s) => s.file.brand)
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
      {!compact && <TemplatePreviewStrip entry={entry} brand={brand} />}
      <div className={compact ? 'px-st py-st' : 'px-5 pb-5 pt-5'}>
        <div className="text-[14px] font-bold leading-snug text-slate-900">{entry.title}</div>
        <div className="mt-ti text-[12px] font-medium text-slate-500">{entry.posture}</div>
        {!compact && <p className="mt-st text-[13px] leading-relaxed text-slate-600">{entry.why}</p>}
        <span className="mt-st inline-flex items-center gap-ti text-[12.5px] font-semibold text-indigo-600 group-hover:text-indigo-700">
          Use this template
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </div>
  )
}

/** Template catalog as a panel. Compact mode sits inside Copilot; full mode fills the modal. */
export function LibraryBrowse({
  compact,
  onApply,
}: {
  compact?: boolean
  onApply: (id: LibraryEntry['id']) => void
}) {
  const [cat, setCat] = useState<Filter>(compact ? 'cancel' : 'all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LIBRARY.filter((e) => (cat === 'all' || e.kind === cat) && matchesQuery(e, q))
  }, [cat, query])

  return (
    <div className={compact ? 'flex flex-col gap-st' : 'flex min-h-0 flex-1 flex-col'}>
      <div className={`flex gap-ti ${compact ? '' : 'border-b border-slate-100 bg-white px-6 py-4'}`}>
        <div className="flex flex-1 items-center gap-ti rounded-xl border border-slate-200 bg-slate-50/80 px-st py-ti">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>
      <div className={`flex gap-ti ${compact ? '' : 'px-6 pt-3'}`}>
        {(['cancel', 'acquisition'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setCat(id)}
            className={`rounded-full px-st py-ti text-[12px] font-semibold ${
              cat === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {id === 'cancel' ? 'Cancel' : 'Acquire'}
          </button>
        ))}
      </div>
      <div className={compact ? 'space-y-st' : 'min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5'}>
        {rows.length === 0 ? (
          <p className="py-md text-center text-[13px] text-slate-400">No templates match that search.</p>
        ) : (
          rows.map((entry) => (
            <LibraryCard
              key={entry.id}
              entry={entry}
              compact={compact}
              onApply={() => onApply(entry.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
