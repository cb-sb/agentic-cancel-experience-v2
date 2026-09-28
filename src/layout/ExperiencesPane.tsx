import { useState } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { useOrchestration } from '../store/useOrchestration'
import {
  newThread,
  openTemplatePicker,
  orderedThreads,
  switchThread,
  threadIsLive,
  useWorkspace,
  type ExperienceThread,
} from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { StatusChip } from './StatusChip'
import { ago, BrandPopover, SettingRow } from './ThreadSidebar'

function HeaderButton({ label, icon, onClick }: { label: string; icon: 'search' | 'panel-left'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
    >
      <SIcon name={icon} size={16} />
    </button>
  )
}

function ThreadRow({ thread, active, onClick }: { thread: ExperienceThread; active: boolean; onClick: () => void }) {
  const dirty = useOrchestration((s) => s.dirty)
  const activeLive = useOrchestration((s) => s.play.publishState === 'live')
  const activeId = useWorkspace((s) => s.activeId)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={`flex w-full flex-col gap-[2px] rounded-lg px-[10px] py-[7px] text-left transition-colors ${
        active ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200' : 'hover:bg-slate-200/50'
      }`}
    >
      <span className="flex w-full items-center gap-[8px]">
        <span className={`min-w-0 flex-1 truncate text-[13px] ${active ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
          {thread.title}
        </span>
        <StatusChip live={threadIsLive(thread, activeId, activeLive)} />
      </span>
      <span className="text-[11.5px] text-slate-500">{active && dirty ? 'Unsaved changes' : ago(thread.updatedAt)}</span>
    </button>
  )
}

/** Cancel experience's own pane, beside the Growth nav: the Experiences page, shared settings, then every experience. */
export function ExperiencesPane() {
  const open = useWorkspaceUi((s) => s.sidebarOpen)
  const setOpen = useWorkspaceUi((s) => s.setSidebarOpen)
  const setSearchOpen = useWorkspaceUi((s) => s.setSearchOpen)
  const page = useWorkspaceUi((s) => s.page)
  const setPage = useWorkspaceUi((s) => s.setPage)
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const libraryTab = useOrchestration((s) => s.libraryTab)
  const [brandOpen, setBrandOpen] = useState(false)
  const folded = !open
  const libraryShown = page === 'thread' && templatesOpen

  const create = () => {
    setPage('thread')
    newThread()
  }
  const openIndex = () => {
    useOrchestration.getState().closeTemplates()
    setPage('index')
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className={`flex h-[60px] flex-none items-center border-b border-slate-200 ${folded ? 'justify-center' : 'gap-[2px] px-[14px]'}`}>
        {!folded && <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-900">Cancel experience</span>}
        {!folded && <HeaderButton label="Search" icon="search" onClick={() => setSearchOpen(true)} />}
        <HeaderButton label={folded ? 'Open side panel' : 'Close side panel'} icon="panel-left" onClick={() => setOpen(folded)} />
      </div>

      <div className={`relative flex flex-none flex-col gap-[2px] py-[10px] ${folded ? 'px-[8px]' : 'px-[10px]'}`}>
        {folded ? (
          <>
            <SettingRow icon="search" label="Search" folded onClick={() => setSearchOpen(true)} />
            <SettingRow icon="plus" label="New experience" folded onClick={create} />
            <SettingRow icon="layers" label="Experiences" folded active={page === 'index'} onClick={openIndex} />
          </>
        ) : (
          <div
            className={`flex h-9 items-center rounded-lg pr-[4px] transition-colors ${
              page === 'index' ? 'bg-slate-200/70' : 'hover:bg-slate-200/50'
            }`}
          >
            <button
              type="button"
              onClick={openIndex}
              className="flex h-full min-w-0 flex-1 items-center gap-[10px] px-[10px] text-left text-[13px] font-medium text-slate-700 hover:text-slate-900"
            >
              <SIcon name="layers" size={16} className="flex-none text-slate-500" />
              <span className="truncate">Experiences</span>
            </button>
            <button
              type="button"
              onClick={create}
              title="New experience"
              aria-label="New experience"
              className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900"
            >
              <SIcon name="plus" size={15} />
            </button>
          </div>
        )}
        <SettingRow
          icon="layout-template"
          label="Templates"
          folded={folded}
          active={libraryShown && libraryTab === 'ours'}
          onClick={() => {
            setPage('thread')
            openTemplatePicker('ours')
          }}
        />
        <SettingRow
          icon="puzzle"
          label="Saved components"
          folded={folded}
          active={libraryShown && libraryTab === 'yours'}
          onClick={() => {
            setPage('thread')
            useOrchestration.getState().openTemplates('yours')
          }}
        />
        <div className="relative">
          <SettingRow icon="palette" label="Brand" folded={folded} active={brandOpen} onClick={() => setBrandOpen((v) => !v)} />
          {brandOpen && <BrandPopover onClose={() => setBrandOpen(false)} />}
        </div>
      </div>

      {!folded && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 px-[10px] pb-[10px] pt-[14px]">
          <div className="flex flex-col gap-[2px]">
            {orderedThreads(threads).map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                active={page === 'thread' && t.id === activeId}
                onClick={() => {
                  setPage('thread')
                  switchThread(t.id)
                }}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
