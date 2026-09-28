import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { DEFAULT_JOURNEY_BRAND } from '../journey/types'
import { useOrchestration } from '../store/useOrchestration'
import {
  newThread,
  orderedThreads,
  setWorkspaceInstall,
  switchThread,
  useWorkspace,
  type ExperienceThread,
} from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'

type IconName = Parameters<typeof SIcon>[0]['name']

export const SIDEBAR_W = 272
export const SIDEBAR_FOLDED_W = 56

function ago(at: number): string {
  const mins = Math.round((Date.now() - at) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function SettingRow({
  icon,
  label,
  folded,
  active,
  trailing,
  onClick,
}: {
  icon: IconName
  label: string
  folded: boolean
  active?: boolean
  trailing?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 w-full items-center gap-[10px] rounded-lg text-left text-[13px] font-medium transition-colors ${
        folded ? 'justify-center px-0' : 'px-[10px]'
      } ${active ? 'bg-slate-200/70 text-slate-900' : 'text-slate-700 hover:bg-slate-200/50 hover:text-slate-900'}`}
    >
      <SIcon name={icon} size={16} className="flex-none text-slate-500" />
      {!folded && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!folded && trailing}
    </button>
  )
}

function BrandPopover({ onClose }: { onClose: () => void }) {
  const brand = useWorkspace((s) => s.brand) ?? DEFAULT_JOURNEY_BRAND
  const askBrand = useWorkspaceUi((s) => s.askBrand)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute left-full top-0 z-40 ml-2 w-[260px] rounded-xl border border-slate-200 bg-white p-[14px] shadow-[0_12px_40px_rgba(15,23,42,0.16)]"
    >
      <p className="text-[13px] font-semibold text-slate-900">Brand</p>
      <p className="mt-[2px] text-[12px] leading-snug text-slate-500">
        New experiences start with this look. Each experience can still change it in its plan.
      </p>
      <div className="mt-[12px] flex items-center gap-[10px]">
        <span
          className="h-8 w-8 flex-none border border-slate-200"
          style={{ background: brand.primary, borderRadius: Math.min(brand.corners, 16) }}
          aria-hidden
        />
        <div className="min-w-0 text-[12px] text-slate-600">
          <p className="font-mono">{brand.primary}</p>
          <p>{brand.matched ? 'Matched to your site' : 'Not matched to your site yet'}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          askBrand()
          onClose()
        }}
        className="mt-[12px] w-full rounded-lg bg-slate-900 px-[10px] py-[7px] text-[12.5px] font-semibold text-white hover:bg-slate-800"
      >
        Match my site in chat
      </button>
    </div>
  )
}

function ThreadRow({ thread, active, onClick }: { thread: ExperienceThread; active: boolean; onClick: () => void }) {
  const dirty = useOrchestration((s) => s.dirty)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={`group flex w-full flex-col rounded-lg px-[10px] py-[7px] text-left transition-colors ${
        active ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200' : 'hover:bg-slate-200/50'
      }`}
    >
      <span className={`w-full truncate text-[13px] ${active ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
        {thread.title}
      </span>
      <span className="text-[11.5px] text-slate-500">
        {active && dirty ? 'Unsaved changes' : ago(thread.updatedAt)}
      </span>
    </button>
  )
}

/** Account-wide settings on top, every experience as a thread below. Collapses to an icon rail. */
export function ThreadSidebar() {
  const open = useWorkspaceUi((s) => s.sidebarOpen)
  const setOpen = useWorkspaceUi((s) => s.setSidebarOpen)
  const search = useWorkspaceUi((s) => s.search)
  const setSearch = useWorkspaceUi((s) => s.setSearch)
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)
  const installConnected = useWorkspace((s) => s.installConnected)
  const [searching, setSearching] = useState(false)
  const [brandOpen, setBrandOpen] = useState(false)
  const folded = !open

  const query = search.trim().toLowerCase()
  const shown = orderedThreads(threads).filter((t) => !query || t.title.toLowerCase().includes(query))

  const openSearch = () => {
    if (folded) setOpen(true)
    setSearching(true)
  }

  const startFromTemplate = () => {
    newThread()
    useOrchestration.getState().requestCopilotLibrary('ours')
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className={`flex h-[60px] flex-none items-center border-b border-slate-200 ${folded ? 'justify-center' : 'justify-between px-[14px]'}`}>
        {!folded && <span className="text-[14px] font-bold text-slate-900">Cancel experiences</span>}
        <button
          type="button"
          onClick={() => setOpen(folded)}
          title={folded ? 'Open side panel' : 'Close side panel'}
          aria-label={folded ? 'Open side panel' : 'Close side panel'}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
        >
          <SIcon name="panel-left" size={16} />
        </button>
      </div>

      <div className={`relative flex flex-none flex-col gap-[2px] border-b border-slate-200 py-[10px] ${folded ? 'px-[8px]' : 'px-[10px]'}`}>
        <SettingRow icon="square-pen" label="New experience" folded={folded} onClick={newThread} />
        {searching && !folded ? (
          <div className="flex h-9 items-center gap-[8px] rounded-lg bg-white px-[10px] ring-1 ring-slate-300">
            <SIcon name="search" size={16} className="flex-none text-slate-500" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearch('')
                  setSearching(false)
                }
              }}
              placeholder="Search experiences"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearch('')
                setSearching(false)
              }}
              className="text-slate-400 hover:text-slate-700"
            >
              <SIcon name="x" size={14} />
            </button>
          </div>
        ) : (
          <SettingRow icon="search" label="Search experiences" folded={folded} onClick={openSearch} />
        )}
        <SettingRow icon="layout-template" label="Templates" folded={folded} onClick={startFromTemplate} />
        <SettingRow
          icon="puzzle"
          label="Saved components"
          folded={folded}
          onClick={() => useOrchestration.getState().openTemplates('yours')}
        />
        <div className="relative">
          <SettingRow icon="palette" label="Brand" folded={folded} active={brandOpen} onClick={() => setBrandOpen((v) => !v)} />
          {brandOpen && <BrandPopover onClose={() => setBrandOpen(false)} />}
        </div>
        <SettingRow
          icon="credit-card"
          label="Billing and install"
          folded={folded}
          onClick={() => setWorkspaceInstall(!installConnected)}
          trailing={
            <span
              className={`flex-none rounded-full px-[7px] py-[1px] text-[10.5px] font-semibold ${
                installConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
              }`}
            >
              {installConnected ? 'Connected' : 'Not connected'}
            </span>
          }
        />
      </div>

      {!folded && (
        <div className="min-h-0 flex-1 overflow-y-auto px-[10px] pb-[10px] pt-[20px]">
          {shown.length > 0 && (
            <section>
              <h3 className="px-[10px] pb-[6px] text-[11px] font-semibold uppercase tracking-wide text-slate-400">Your experiences</h3>
              <div className="flex flex-col gap-[2px]">
                {shown.map((t) => (
                  <ThreadRow key={t.id} thread={t} active={t.id === activeId} onClick={() => switchThread(t.id)} />
                ))}
              </div>
            </section>
          )}
          {shown.length === 0 && <p className="px-[10px] py-[8px] text-[12.5px] text-slate-500">No experiences match.</p>}
        </div>
      )}
    </aside>
  )
}
