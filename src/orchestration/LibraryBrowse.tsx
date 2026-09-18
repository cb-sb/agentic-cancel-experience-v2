import { useMemo, useState } from 'react'
import {
  LIBRARY,
  type LibraryEntry,
  type LibraryKind,
  type LibraryShape,
} from '../journey/templates'
import { useJourney } from '../store/useJourney'
import { SectionLabel } from './CopilotHomeSetup'
import { TemplatePreviewStrip } from './TemplatePreviewStrip'

type Filter = 'all' | LibraryKind
type ShapeFilter = 'all' | LibraryShape

const SHAPE_PILLS: { id: ShapeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'single', label: 'Single step' },
  { id: 'multi', label: 'Multi-step' },
  { id: 'in_app', label: 'In-app' },
]

const SHAPE_GROUPS: { id: LibraryShape; label: string }[] = [
  { id: 'single', label: 'Single step' },
  { id: 'multi', label: 'Multi-step' },
  { id: 'in_app', label: 'In-app' },
]

function shapeLabel(shape: LibraryShape | undefined): string | null {
  if (shape === 'single') return 'Single step'
  if (shape === 'multi') return 'Multi-step'
  if (shape === 'in_app') return 'In-app'
  return null
}

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
}: {
  entry: LibraryEntry
  onApply: () => void
}) {
  const brand = useJourney((s) => s.file.brand)
  const kindLabel = entry.kind === 'acquisition' ? 'Acquire' : 'Cancel'
  const stepMeta = `${entry.stepCount} screen${entry.stepCount === 1 ? '' : 's'} · ${kindLabel}`
  const badge = shapeLabel(entry.shape)
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
      <TemplatePreviewStrip entry={entry} brand={brand} compact />
      <div className="px-[16px] pb-[16px] pt-[14px]">
        <div className="flex items-start justify-between gap-[8px]">
          <div className="text-[14px] font-bold leading-snug text-slate-900">{entry.title}</div>
          {badge && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-normal text-[#4f46e5] bg-[#eef2ff]">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-[4px] text-[12px] font-medium text-slate-500">
          {entry.posture} · {stepMeta}
        </div>
        <p className="mt-[8px] line-clamp-1 text-[13px] leading-relaxed text-slate-600">{entry.why}</p>
        <span className="mt-[10px] inline-flex items-center gap-[4px] text-[12.5px] font-semibold text-indigo-600 group-hover:text-indigo-700">
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
  const [cat, setCat] = useState<Filter>('cancel')
  const [shape, setShape] = useState<ShapeFilter>('all')
  const [query, setQuery] = useState('')

  const cancelCatalog = useMemo(() => LIBRARY.filter((e) => e.kind === 'cancel'), [])
  const shapeCounts = useMemo(() => {
    const counts: Record<LibraryShape, number> = { single: 0, multi: 0, in_app: 0 }
    cancelCatalog.forEach((e) => {
      if (e.shape) counts[e.shape] += 1
    })
    return counts
  }, [cancelCatalog])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LIBRARY.filter((e) => {
      if (cat !== 'all' && e.kind !== cat) return false
      if (cat === 'cancel' && shape !== 'all' && e.shape !== shape) return false
      return matchesQuery(e, q)
    })
  }, [cat, query, shape])

  const grouped =
    cat === 'cancel' && shape === 'all'
      ? SHAPE_GROUPS.map((g) => ({
          ...g,
          entries: rows.filter((e) => e.shape === g.id),
        })).filter((g) => g.entries.length > 0)
      : null

  return (
    <div className={compact ? 'flex flex-col gap-[12px]' : 'flex min-h-0 flex-1 flex-col'}>
      <div className={`flex gap-[8px] ${compact ? '' : 'border-b border-slate-100 bg-white px-6 py-4'}`}>
        <div className="flex flex-1 items-center gap-[8px] rounded-xl border border-slate-200 bg-slate-50/80 px-[10px] py-[8px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>
      <div className={`flex flex-wrap gap-[6px] ${compact ? '' : 'px-6 pt-3'}`}>
        {(['cancel', 'acquisition'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setCat(id)
              setShape('all')
            }}
            className={`rounded-full px-[10px] py-[4px] text-[12px] font-semibold ${
              cat === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {id === 'cancel' ? 'Cancel' : 'Acquire'}
          </button>
        ))}
      </div>
      {cat === 'cancel' && (
        <div className={`flex flex-wrap gap-[6px] ${compact ? '' : 'sticky top-0 z-10 bg-white px-6 pt-2'}`}>
          {SHAPE_PILLS.map((pill) => {
            const count =
              pill.id === 'all'
                ? cancelCatalog.length
                : shapeCounts[pill.id]
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setShape(pill.id)}
                className={`rounded-full px-[10px] py-[4px] text-[12px] font-semibold ${
                  shape === pill.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {pill.label} ({count})
              </button>
            )
          })}
        </div>
      )}
      <div className={compact ? 'space-y-[12px]' : 'min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5'}>
        {rows.length === 0 ? (
          <p className="py-[16px] text-center text-[13px] text-slate-400">No templates match that search.</p>
        ) : grouped ? (
          grouped.map((group) => (
            <section key={group.id} className="space-y-3">
              <SectionLabel>{group.label}</SectionLabel>
              {group.entries.map((entry) => (
                <LibraryCard key={entry.id} entry={entry} onApply={() => onApply(entry.id)} />
              ))}
            </section>
          ))
        ) : (
          rows.map((entry) => (
            <LibraryCard key={entry.id} entry={entry} onApply={() => onApply(entry.id)} />
          ))
        )}
      </div>
    </div>
  )
}
