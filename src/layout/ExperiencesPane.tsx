import { useEffect, useState } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { V8 } from './layoutMode'
import { openLibrary, openOrder } from '../plays/navigate'
import { RowMenu } from '../plays/ui'
import type { LibraryKind } from '../workspace/useWorkspaceUi'
import { createMenuItems } from './createMenu'
import { PlaysTree } from './PlaysTree'
import { useCopilotThread } from '../orchestration/copilotThread'
import { useOrchestration } from '../store/useOrchestration'
import {
  activeChatOf,
  chatsOf,
  chatTitle,
  newChat,
  newThread,
  openTemplatePicker,
  orderedThreads,
  switchChat,
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

/** One experience as a folder: its name and status, then every Copilot chat on it. */
function ExperienceFolder({
  thread,
  open,
  current,
  onToggle,
}: {
  thread: ExperienceThread
  open: boolean
  current: boolean
  onToggle: () => void
}) {
  const dirty = useOrchestration((s) => s.dirty)
  const activeLive = useOrchestration((s) => s.play.publishState === 'live')
  const activeId = useWorkspace((s) => s.activeId)
  const liveLines = useCopilotThread((s) => s.lines)
  const isActive = thread.id === activeId
  const chats = chatsOf(thread)
  const activeChat = activeChatOf(thread)

  const openExperience = () => {
    useWorkspaceUi.getState().setPage('thread')
    switchThread(thread.id)
    if (!open) onToggle()
  }

  return (
    <div>
      <div
        className={`group flex h-8 items-center gap-[2px] rounded-lg pr-[4px] transition-colors ${
          current ? 'bg-slate-200/60' : 'hover:bg-slate-200/50'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? `Collapse ${thread.title}` : `Expand ${thread.title}`}
          aria-expanded={open}
          className="flex h-8 w-6 flex-none items-center justify-center text-slate-400 hover:text-slate-700"
        >
          <SIcon name="chevron-right" size={13} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        </button>
        <button
          type="button"
          onClick={openExperience}
          className={`min-w-0 flex-1 truncate text-left text-[13px] ${
            current ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
          }`}
        >
          {thread.title}
        </button>
        <button
          type="button"
          onClick={() => {
            useWorkspaceUi.getState().setPage('thread')
            newChat(thread.id)
            if (!open) onToggle()
          }}
          title="New chat"
          aria-label={`New chat in ${thread.title}`}
          className="hidden h-6 w-6 flex-none items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900 group-hover:flex"
        >
          <SIcon name="plus" size={13} />
        </button>
        <span className="flex-none group-hover:hidden">
          <StatusChip live={threadIsLive(thread, activeId, activeLive)} />
        </span>
      </div>
      {open && (
        <div className="ml-[15px] flex flex-col gap-[1px] border-l border-slate-200 py-[2px] pl-[6px]">
          {[...chats].reverse().map((c) => {
            const selected = current && c.id === activeChat
            const lines = isActive && c.id === activeChat ? liveLines : c.chat.lines
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  useWorkspaceUi.getState().setPage('thread')
                  switchChat(thread.id, c.id)
                }}
                aria-current={selected ? 'true' : undefined}
                className={`flex w-full items-center gap-[8px] rounded-lg px-[8px] py-[5px] text-left transition-colors ${
                  selected
                    ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200'
                    : 'hover:bg-slate-200/50'
                }`}
              >
                <span
                  className={`min-w-0 flex-1 truncate text-[12.5px] ${selected ? 'font-medium text-slate-900' : 'text-slate-600'}`}
                >
                  {lines.length === 0 && thread.seed ? thread.title : chatTitle(lines)}
                </span>
                <span className="flex-none text-[11px] text-slate-400">
                  {selected && dirty ? 'Unsaved' : ago(c.updatedAt)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** v8: one menu for everything a merchant can make for the cancel flow. */
function CreateMenu() {
  return <RowMenu label="Create" icon="plus" items={createMenuItems()} width={270} align="beside" />
}

const LIBRARY_ROWS: { kind: LibraryKind; label: string; icon: SIconName }[] = [
  { kind: 'offers', label: 'Offers', icon: 'gift' },
  { kind: 'reasons', label: 'Survey reasons', icon: 'message-square' },
  { kind: 'cards', label: 'Loss aversion cards', icon: 'shield' },
  { kind: 'redirects', label: 'Redirect pages', icon: 'external-link' },
]

function LibrarySection() {
  const page = useWorkspaceUi((s) => s.page)
  const kind = useWorkspaceUi((s) => s.libraryKind)
  return (
    <div className="mt-[12px] border-t border-slate-200 pt-[12px]">
      <div className="flex h-7 items-center px-[10px]">
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Library</span>
      </div>
      <div className="flex flex-col gap-[2px]">
        {LIBRARY_ROWS.map((r) => (
          <SettingRow
            key={r.kind}
            icon={r.icon}
            label={r.label}
            folded={false}
            active={page === 'library' && kind === r.kind}
            onClick={() => openLibrary(r.kind)}
          />
        ))}
      </div>
    </div>
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
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeId ? [activeId] : []))

  useEffect(() => {
    if (activeId) setExpanded((s) => (s.has(activeId) ? s : new Set(s).add(activeId)))
  }, [activeId])

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

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
        {!folded && <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-900">{V8 ? 'Retention' : 'Cancel experience'}</span>}
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
            {V8 ? (
              <CreateMenu />
            ) : (
              <button
                type="button"
                onClick={create}
                title="New experience"
                aria-label="New experience"
                className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900"
              >
                <SIcon name="plus" size={15} />
              </button>
            )}
          </div>
        )}
        {V8 ? (
          <>
            <SettingRow
              icon="layout-template"
              label="Templates and components"
              folded={folded}
              active={libraryShown}
              onClick={() => {
                setPage('thread')
                useOrchestration.getState().openTemplates(libraryTab)
              }}
            />
            <SettingRow
              icon="list-ordered"
              label="Play order and testing"
              folded={folded}
              active={page === 'order'}
              onClick={openOrder}
            />
          </>
        ) : (
          <>
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
          </>
        )}
        <div className="relative">
          <SettingRow icon="palette" label="Brand" folded={folded} active={brandOpen} onClick={() => setBrandOpen((v) => !v)} />
          {brandOpen && <BrandPopover onClose={() => setBrandOpen(false)} />}
        </div>
      </div>

      {!folded && V8 && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 px-[10px] pb-[10px] pt-[10px]">
          <PlaysTree />
          <LibrarySection />
        </div>
      )}
      {!folded && !V8 && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 px-[10px] pb-[10px] pt-[14px]">
          <div className="flex flex-col gap-[2px]">
            {orderedThreads(threads).map((t) => (
              <ExperienceFolder
                key={t.id}
                thread={t}
                open={expanded.has(t.id)}
                current={page === 'thread' && !libraryShown && t.id === activeId}
                onToggle={() => toggle(t.id)}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
