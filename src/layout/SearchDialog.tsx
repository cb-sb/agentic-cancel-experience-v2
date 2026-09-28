import { useEffect, useMemo, useState } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { LIBRARY } from '../journey/templates'
import { useMerchantLibrary } from '../store/useMerchantLibrary'
import { useOrchestration } from '../store/useOrchestration'
import {
  orderedThreads,
  startFromLibrary,
  startFromSaved,
  switchThread,
  useWorkspace,
} from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'

type IconName = Parameters<typeof SIcon>[0]['name']

interface Result {
  id: string
  group: 'Experiences' | 'Templates' | 'Saved components'
  icon: IconName
  label: string
  detail: string
  run: () => void
}

const LIMIT = 6

/** One search over experiences, Chargebee templates and saved components. */
export function SearchDialog() {
  const open = useWorkspaceUi((s) => s.searchOpen)
  const setOpen = useWorkspaceUi((s) => s.setSearchOpen)
  const setPage = useWorkspaceUi((s) => s.setPage)
  const threads = useWorkspace((s) => s.threads)
  const savedTemplates = useMerchantLibrary((s) => s.templates)
  const components = useMerchantLibrary((s) => s.components)
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useWorkspaceUi.getState().searchOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (open) {
      setQuery('')
      setAt(0)
    }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (...text: string[]) => !q || text.some((t) => t.toLowerCase().includes(q))
    const close = () => setOpen(false)
    const inThread = (run: () => void) => () => {
      close()
      setPage('thread')
      run()
    }
    const exp: Result[] = orderedThreads(threads)
      .filter((t) => hit(t.title))
      .slice(0, LIMIT)
      .map((t) => ({
        id: t.id,
        group: 'Experiences',
        icon: 'message-square',
        label: t.title,
        detail: 'Cancel experience',
        run: inThread(() => switchThread(t.id)),
      }))
    const tpl: Result[] = LIBRARY.filter((e) => e.kind === 'cancel' && hit(e.title, e.posture))
      .slice(0, LIMIT)
      .map((e) => ({
        id: e.id,
        group: 'Templates',
        icon: 'layout-template',
        label: e.title,
        detail: e.posture,
        run: inThread(() => startFromLibrary(e.id)),
      }))
    const saved: Result[] = [
      ...savedTemplates
        .filter((t) => hit(t.name))
        .map((t) => ({
          id: t.id,
          group: 'Saved components' as const,
          icon: 'upload' as IconName,
          label: t.name,
          detail: `Saved template, ${t.stepLabels.length} screens`,
          run: inThread(() => startFromSaved(t.id)),
        })),
      ...components
        .filter((c) => hit(c.label, c.kind))
        .map((c) => ({
          id: c.id,
          group: 'Saved components' as const,
          icon: 'puzzle' as IconName,
          label: c.label,
          detail: c.kind.replace(/_/g, ' '),
          run: inThread(() => useOrchestration.getState().openTemplates('yours')),
        })),
    ].slice(0, LIMIT)
    return [...exp, ...tpl, ...saved]
  }, [query, threads, savedTemplates, components, setOpen, setPage])

  if (!open) return null

  const pick = (i: number) => results[i]?.run()
  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/25 pt-[12vh]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label="Search"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-[600px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
      >
        <div className="flex h-[52px] flex-none items-center gap-[10px] border-b border-slate-100 px-[16px]">
          <SIcon name="search" size={17} className="flex-none text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setAt(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setAt((i) => Math.min(results.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setAt((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') pick(at)
            }}
            placeholder="Search experiences, templates and saved components"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-[8px]">
          {results.length === 0 && <p className="px-[12px] py-[16px] text-[13px] text-slate-500">Nothing matches.</p>}
          {results.map((r, i) => {
            const heading = r.group !== lastGroup ? r.group : null
            lastGroup = r.group
            return (
              <div key={`${r.group}-${r.id}`}>
                {heading && (
                  <p className="px-[12px] pb-[4px] pt-[10px] text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {heading}
                  </p>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setAt(i)}
                  onClick={() => pick(i)}
                  className={`flex w-full items-center gap-[12px] rounded-lg px-[12px] py-[8px] text-left ${
                    at === i ? 'bg-slate-100' : ''
                  }`}
                >
                  <SIcon name={r.icon} size={16} className="flex-none text-slate-500" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-slate-900">{r.label}</span>
                  <span className="max-w-[45%] flex-none truncate text-[12px] text-slate-400">{r.detail}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
