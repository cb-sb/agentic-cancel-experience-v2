import { useEffect, useMemo, useState } from 'react'
import { useOrchestration } from '../store/useOrchestration'
import { useAssistant } from './assistant/useAssistant'
import { BLUEPRINTS } from '../lib/blueprints'
import type { BlueprintId, BlueprintMeta } from '../types/experience'

type Category = 'all' | 'suggested' | 'clean_exit' | 'balanced' | 'save_aggressive'

const SUGGESTED: BlueprintId[] = ['balanced', 'save_aggressive', 'clean_exit_2']

const POSTURE_LABEL: Record<BlueprintMeta['posture'], string> = {
  clean_exit: 'Clean exit',
  balanced: 'Balanced',
  save_aggressive: 'Save-focused',
}

const RAIL: { id: Category; label: string; group?: string }[] = [
  { id: 'all', label: 'All templates' },
  { id: 'suggested', label: 'Suggested' },
  { id: 'clean_exit', label: 'Clean exit', group: 'By posture' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'save_aggressive', label: 'Save-focused' },
]

/** Abstract mini-preview of a flow, tinted by posture. */
function TemplateThumb({ meta }: { meta: BlueprintMeta }) {
  const tint: Record<BlueprintMeta['posture'], { bg: string; accent: string }> = {
    clean_exit: { bg: 'from-sky-100 to-slate-100', accent: 'bg-slate-400' },
    balanced: { bg: 'from-indigo-100 to-slate-100', accent: 'bg-indigo-500' },
    save_aggressive: { bg: 'from-violet-100 to-fuchsia-50', accent: 'bg-fuchsia-500' },
  }
  const t = tint[meta.posture]
  return (
    <div className={`flex h-[112px] items-center justify-center bg-gradient-to-br ${t.bg}`}>
      <div className="flex w-[70%] flex-col gap-1.5 rounded-lg bg-white p-2.5 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="h-1.5 w-8 rounded-full bg-slate-200" />
        </div>
        <span className="h-1.5 w-full rounded-full bg-slate-200" />
        <span className="h-1.5 w-3/4 rounded-full bg-slate-200" />
        <span className={`mt-0.5 h-3 w-14 rounded-md ${t.accent}`} />
        <div className="mt-1 flex gap-1">
          {Array.from({ length: meta.stepCount }).map((_, i) => (
            <span key={i} className={`h-1 w-1 rounded-full ${i === 0 ? t.accent : 'bg-slate-300'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ meta, onSelect }: { meta: BlueprintMeta; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-all hover:border-slate-300 hover:shadow-md"
    >
      <TemplateThumb meta={meta} />
      <div className="border-t border-slate-100 px-3 py-2.5">
        <div className="text-[13px] font-bold text-slate-900">{meta.name}</div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          {meta.stepCount} step{meta.stepCount > 1 ? 's' : ''} · {POSTURE_LABEL[meta.posture]}
        </div>
      </div>
    </button>
  )
}

function Section({
  title,
  metas,
  onSeeAll,
  onSelect,
}: {
  title: string
  metas: BlueprintMeta[]
  onSeeAll?: () => void
  onSelect: (id: BlueprintId) => void
}) {
  if (!metas.length) return null
  return (
    <div className="mb-6">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-[13px] font-bold text-slate-900">{title}</div>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="text-[12px] font-semibold text-indigo-600 hover:underline">
            See all
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {metas.map((m) => (
          <TemplateCard key={m.id} meta={m} onSelect={() => onSelect(m.id)} />
        ))}
      </div>
    </div>
  )
}

export function TemplatesModal() {
  const closeTemplates = useOrchestration((s) => s.closeTemplates)
  const applyTemplate = useAssistant((s) => s.applyTemplate)
  const [cat, setCat] = useState<Category>('all')
  const [query, setQuery] = useState('')

  // Applying runs through the assistant so the conversation lands on the plan
  // review rather than stranding on the question that opened the library.
  const apply = (id: BlueprintId) => {
    applyTemplate(id)
    closeTemplates()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTemplates()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeTemplates])

  const byPosture = (posture: BlueprintMeta['posture']) => BLUEPRINTS.filter((b) => b.posture === posture)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return BLUEPRINTS.filter(
      (b) => b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q),
    )
  }, [query])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeTemplates} />
      <div className="relative flex h-[600px] w-[900px] max-w-full overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Left category rail */}
        <aside className="flex w-[220px] flex-none flex-col border-r border-slate-100 bg-slate-50/60 p-4">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
              C
            </span>
            <span className="text-[13px] font-bold text-slate-900">Template library</span>
          </div>
          <nav className="space-y-0.5">
            {RAIL.map((item) => (
              <div key={item.id}>
                {item.group && (
                  <div className="mb-1 mt-3 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {item.group}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setCat(item.id)}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] font-semibold transition-colors ${
                    cat === item.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              </div>
            ))}
          </nav>
        </aside>

        {/* Right pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-none items-center gap-3 border-b border-slate-100 px-5 py-3.5">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
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

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {/* Promo banner */}
            <div className="mb-6 flex items-center justify-between gap-4 rounded-xl bg-gradient-to-br from-indigo-50 to-fuchsia-50 p-4 ring-1 ring-indigo-100">
              <div>
                <div className="text-[14px] font-bold text-slate-900">Start from scratch</div>
                <div className="mt-0.5 max-w-md text-[12px] text-slate-500">
                  Begin with a minimal one-step flow and build it out node by node on the canvas.
                </div>
              </div>
              <button
                type="button"
                onClick={() => apply('click_to_cancel')}
                className="flex-none rounded-lg bg-slate-900 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-slate-700"
              >
                Blank flow
              </button>
            </div>

            {results ? (
              <Section
                title={`${results.length} result${results.length === 1 ? '' : 's'}`}
                metas={results}
                onSelect={apply}
              />
            ) : cat === 'all' ? (
              <>
                <Section title="Suggested" metas={BLUEPRINTS.filter((b) => SUGGESTED.includes(b.id))} onSelect={apply} />
                <Section title="Clean exit" metas={byPosture('clean_exit')} onSeeAll={() => setCat('clean_exit')} onSelect={apply} />
                <Section title="Balanced" metas={byPosture('balanced')} onSeeAll={() => setCat('balanced')} onSelect={apply} />
                <Section title="Save-focused" metas={byPosture('save_aggressive')} onSeeAll={() => setCat('save_aggressive')} onSelect={apply} />
              </>
            ) : cat === 'suggested' ? (
              <Section title="Suggested" metas={BLUEPRINTS.filter((b) => SUGGESTED.includes(b.id))} onSelect={apply} />
            ) : (
              <Section title={POSTURE_LABEL[cat]} metas={byPosture(cat)} onSelect={apply} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
