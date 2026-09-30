import { useEffect, useMemo, useRef, useState } from 'react'
import { SButton, STabs } from '@chargebee/sting-react'
import {
  LIBRARY,
  type LibraryEntry,
  type LibraryJob,
  type LibraryKind,
} from '../journey/templates'
import { useJourney } from '../store/useJourney'
import { SectionLabel } from './CopilotHomeSetup'
import { TemplateOutlineStrip, TemplatePreviewStrip, TemplateScreens } from './TemplatePreviewStrip'
import { V8 } from '../layout/layoutMode'
import { BackButton } from '../shell/BackButton'

type Filter = 'all' | LibraryKind
type JobFilter = 'all' | LibraryJob

const JOB_PILLS: { id: JobFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'comply', label: 'Comply' },
  { id: 'learn', label: 'Learn' },
  { id: 'save', label: 'Save' },
]

const JOB_GROUPS: { id: LibraryJob; label: string }[] = [
  { id: 'comply', label: 'Comply' },
  { id: 'learn', label: 'Learn' },
  { id: 'save', label: 'Save' },
]

function jobLabel(job: LibraryJob | undefined): string | null {
  if (job === 'comply') return 'Comply'
  if (job === 'learn') return 'Learn'
  if (job === 'save') return 'Save'
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
  onPick,
}: {
  entry: LibraryEntry
  onPick: () => void
}) {
  const brand = useJourney((s) => s.file.brand)
  const kindLabel = entry.kind === 'acquisition' ? 'Acquire' : 'Cancel'
  const stepMeta = `${entry.stepCount} screen${entry.stepCount === 1 ? '' : 's'} · ${kindLabel}`
  const badge = jobLabel(entry.job)
  return (
    <article className="group w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:border-slate-300/80 hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.28)]">
      <div className="px-[18px] pb-[14px] pt-[16px]">
        <div className="flex items-start justify-between gap-[8px]">
          <h3 className="text-[15px] font-bold leading-snug text-slate-900">{entry.title}</h3>
          {badge && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-normal text-[#4f46e5] bg-[#eef2ff]">
              {badge}
            </span>
          )}
        </div>
        <div className="mt-[4px] text-[12px] font-medium text-slate-500">
          {entry.posture} · {stepMeta}
        </div>
        <p className="mt-[8px] line-clamp-2 text-[13px] leading-relaxed text-slate-600">{entry.why}</p>
        <p className="mt-[6px] text-[12px] leading-snug text-slate-400">{entry.stepLabels.join(' → ')}</p>
        <button
          type="button"
          onClick={onPick}
          className="mt-[12px] inline-flex items-center gap-[4px] text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700"
        >
          Use this template
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      </div>
      <TemplatePreviewStrip entry={entry} brand={brand} />
    </article>
  )
}

function templateScreenMeta(entry: LibraryEntry): string {
  if (entry.id === 'cancel_1') return '1 screen + outcomes'
  return `${entry.stepCount} screen${entry.stepCount === 1 ? '' : 's'}`
}

function TemplateFacts({ entry, layout = 'wide' }: { entry: LibraryEntry; layout?: 'wide' | 'stack' }) {
  const stack = layout === 'stack'
  return (
    <dl className={stack ? 'flex flex-col gap-[8px]' : 'grid grid-cols-1 gap-x-[24px] gap-y-[12px] sm:grid-cols-2'}>
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">What it does</dt>
        <dd className={`mt-[2px] ${stack ? 'text-[12px] leading-[18px]' : 'mt-[4px] text-[13px] leading-[20px]'} text-slate-700`}>
          {entry.does}
        </dd>
      </div>
      <div>
        <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Pick it when</dt>
        <dd className={`mt-[2px] ${stack ? 'text-[12px] leading-[18px]' : 'mt-[4px] text-[13px] leading-[20px]'} text-slate-700`}>
          {entry.pickWhen}
        </dd>
      </div>
    </dl>
  )
}

function TemplateHeading({ entry, size }: { entry: LibraryEntry; size: 'card' | 'page' }) {
  const kindLabel = entry.kind === 'acquisition' ? 'Acquire' : 'Cancel'
  const badge = jobLabel(entry.job)
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-[8px]">
        <h3 className={`${size === 'page' ? 'text-[18px]' : 'text-[15px]'} font-bold leading-snug text-slate-900`}>
          {entry.title}
        </h3>
        {badge && (
          <span className="shrink-0 rounded bg-[#eef2ff] px-1.5 py-0.5 text-[10px] font-semibold leading-normal text-[#4f46e5]">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-[2px] text-[12px] font-medium text-slate-500">
        {entry.posture} · {templateScreenMeta(entry)} · {kindLabel}
      </p>
    </div>
  )
}

/** v8: what the template is and when to pick it, over low-fidelity screens. */
function LibraryCardV8({ entry, onPick }: { entry: LibraryEntry; onPick: (focus: number) => void }) {
  const brand = useJourney((s) => s.file.brand)
  return (
    <article className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:border-slate-300/80 hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.28)]">
      <div className="flex flex-col gap-[14px] p-[16px] min-[920px]:flex-row min-[920px]:items-start min-[920px]:gap-[18px]">
        <div className="flex w-full min-w-0 flex-col gap-[10px] min-[920px]:w-[328px] min-[920px]:shrink-0">
          <TemplateHeading entry={entry} size="card" />
          <TemplateFacts entry={entry} layout="stack" />
          <SButton size="small" variant="neutral-outline" className="mt-[2px] w-auto self-start" onClick={() => onPick(0)}>
            Use this template
          </SButton>
        </div>
        <div className="min-w-0 flex-1 min-[920px]:pt-[2px]">
          <p className="mb-[6px] text-[11px] leading-[16px] text-slate-500">Click a screen for full size.</p>
          <div className="-mx-[16px] min-[920px]:mx-0 overflow-hidden rounded-[12px] min-[920px]:rounded-[14px]">
            <TemplateOutlineStrip entry={entry} brand={brand} onOpen={onPick} />
          </div>
        </div>
      </div>
    </article>
  )
}

/** v8: the template at full size, before the merchant commits to it. */
function TemplateConfirmV8({
  entry,
  focus,
  onBack,
  onConfirm,
}: {
  entry: LibraryEntry
  focus: number
  onBack: () => void
  onConfirm: () => void
}) {
  const brand = useJourney((s) => s.file.brand)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'start' })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      onBack()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onBack])

  return (
    <article ref={ref} className="scroll-mt-[20px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start gap-[10px] px-[20px] pb-[18px] pt-[16px]">
        <BackButton onBack={onBack} className="-ml-[6px] mt-[-2px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
          <div className="flex items-start justify-between gap-[12px]">
            <TemplateHeading entry={entry} size="page" />
            <SButton size="small" variant="primary" className="w-auto shrink-0" onClick={onConfirm}>
              Use this template
            </SButton>
          </div>
          <TemplateFacts entry={entry} />
        </div>
      </div>
      <div className="border-t border-slate-100">
        <TemplateScreens entry={entry} brand={brand} focus={focus} />
      </div>
    </article>
  )
}

function TemplateConfirm({
  entry,
  onBack,
  onConfirm,
}: {
  entry: LibraryEntry
  onBack: () => void
  onConfirm: () => void
}) {
  const brand = useJourney((s) => s.file.brand)
  const kindLabel = entry.kind === 'acquisition' ? 'Acquire' : 'Cancel'
  const badge = jobLabel(entry.job)
  return (
    <div className="flex flex-col gap-[12px]">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-[12.5px] font-semibold text-slate-500 hover:text-slate-800"
      >
        ← Back to templates
      </button>
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-[12px] px-[16px] py-[16px]">
          <div className="flex items-start justify-between gap-[8px]">
            <h3 className="text-[16px] font-bold leading-snug text-slate-900">{entry.title}</h3>
            {badge && (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-normal text-[#4f46e5] bg-[#eef2ff]">
                {badge}
              </span>
            )}
          </div>
          <p className="text-[13px] font-medium text-slate-500">
            {entry.posture} · {entry.stepCount} screen{entry.stepCount === 1 ? '' : 's'} · {kindLabel}
          </p>
          <p className="text-[13px] leading-relaxed text-slate-600">{entry.why}</p>
          <p className="text-[12px] leading-snug text-slate-400">{entry.stepLabels.join(' → ')}</p>
          <div className="flex flex-wrap items-center justify-start gap-[8px] pt-[4px]">
            <SButton size="small" variant="neutral-outline" className="w-auto shrink-0" onClick={onBack}>
              Back
            </SButton>
            <SButton size="small" variant="primary" className="w-auto shrink-0" onClick={onConfirm}>
              Use this path
            </SButton>
          </div>
        </div>
        <TemplatePreviewStrip entry={entry} brand={brand} />
      </article>
    </div>
  )
}

/**
 * Template catalog as a panel. Compact mode sits inside Copilot; full mode fills the overlay.
 * Pass `kind` and `query` when the page above owns the category tabs and the search.
 */
export function LibraryBrowse({
  compact,
  onApply,
  kind,
  query: outerQuery,
}: {
  compact?: boolean
  onApply: (id: LibraryEntry['id']) => void
  kind?: LibraryKind
  query?: string
}) {
  const controlled = kind !== undefined
  const [ownCat, setCat] = useState<Filter>('cancel')
  const cat: Filter = kind ?? ownCat
  const [job, setJob] = useState<JobFilter>('all')
  const [ownQuery, setQuery] = useState('')
  const query = outerQuery ?? ownQuery
  const [pending, setPending] = useState<{ entry: LibraryEntry; focus: number } | null>(null)

  const cancelCatalog = useMemo(() => LIBRARY.filter((e) => e.kind === 'cancel'), [])
  const jobCounts = useMemo(() => {
    const counts: Record<LibraryJob, number> = { comply: 0, learn: 0, save: 0 }
    cancelCatalog.forEach((e) => {
      if (e.job) counts[e.job] += 1
    })
    return counts
  }, [cancelCatalog])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LIBRARY.filter((e) => {
      if (cat !== 'all' && e.kind !== cat) return false
      if (cat === 'cancel' && job !== 'all' && e.job !== job) return false
      return matchesQuery(e, q)
    })
  }, [cat, query, job])

  const grouped =
    cat === 'cancel' && job === 'all'
      ? JOB_GROUPS.map((g) => ({
          ...g,
          entries: rows.filter((e) => e.job === g.id),
        })).filter((g) => g.entries.length > 0)
      : null

  if (pending) {
    return V8 ? (
      <div className={compact ? '' : 'px-6 py-5'}>
        <TemplateConfirmV8
          entry={pending.entry}
          focus={pending.focus}
          onBack={() => setPending(null)}
          onConfirm={() => onApply(pending.entry.id)}
        />
      </div>
    ) : (
      <TemplateConfirm
        entry={pending.entry}
        onBack={() => setPending(null)}
        onConfirm={() => onApply(pending.entry.id)}
      />
    )
  }

  const card = (entry: LibraryEntry) =>
    V8 ? (
      <LibraryCardV8 key={entry.id} entry={entry} onPick={(focus) => setPending({ entry, focus })} />
    ) : (
      <LibraryCard key={entry.id} entry={entry} onPick={() => setPending({ entry, focus: 0 })} />
    )

  return (
    <div className={compact ? 'flex flex-col gap-[12px]' : 'flex h-full min-h-0 flex-col'}>
      {!controlled && (
      <>
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
      <div className={compact ? '' : 'px-6'}>
        {!V8 && (
        <STabs
          value={cat}
          onValueChange={(id) => {
            setCat(id as Filter)
            setJob('all')
          }}
          variant="underline"
          size="sm"
        >
          <STabs.List>
            <STabs.Trigger value="cancel">Cancel</STabs.Trigger>
            <STabs.Trigger value="acquisition">Acquire</STabs.Trigger>
          </STabs.List>
        </STabs>
        )}
      </div>
      </>
      )}
      {cat === 'cancel' && (
        <div
          className={`flex flex-col gap-[8px] ${
            compact ? '' : 'sticky top-0 z-10 bg-white px-6 pt-3'
          }`}
        >
          <SectionLabel>Job</SectionLabel>
          <div
            role="group"
            aria-label="Job"
            className="inline-flex w-fit max-w-full flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-[3px]"
          >
            {JOB_PILLS.map((pill) => {
              const count =
                pill.id === 'all' ? cancelCatalog.length : jobCounts[pill.id]
              const selected = job === pill.id
              return (
                <button
                  key={pill.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setJob(pill.id)}
                  className={`rounded-md px-[10px] py-[5px] text-[12px] font-medium ${
                    selected
                      ? 'bg-white text-slate-900'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {pill.label}
                  <span className={`ml-[4px] text-[11px] font-normal ${selected ? 'text-slate-500' : 'text-slate-400'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className={compact ? 'flex flex-col gap-[12px]' : 'space-y-5 px-6 py-5'}>
        {rows.length === 0 ? (
          <p className="py-[16px] text-center text-[13px] text-slate-400">No templates match that search.</p>
        ) : grouped ? (
          grouped.map((group) => (
            <section key={group.id} className="space-y-3">
              <SectionLabel>{group.label}</SectionLabel>
              <div className="flex flex-col gap-[12px]">
                {group.entries.map(card)}
              </div>
            </section>
          ))
        ) : (
          rows.map(card)
        )}
      </div>
    </div>
  )
}
