import { useEffect, useState } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { openLibrary, openOrder, openPlay } from '../plays/navigate'
import { createPlay, usePlays } from '../plays/usePlays'
import { RowMenu, type MenuItem } from '../plays/ui'
import { useOrchestration } from '../store/useOrchestration'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi, type LibraryKind } from '../workspace/useWorkspaceUi'
import { createMenuItems } from './createMenu'
import { LooseRow, PlayRow } from './PlaysTree'
import { BrandPopover, SettingRow } from './ThreadSidebar'
import { useRecent, type RecentItem } from './useRecent'

const RECENT_SHOWN = 5

const LIBRARY_ROWS: { kind: LibraryKind; label: string; icon: SIconName }[] = [
  { kind: 'offers', label: 'Offers', icon: 'gift' },
  { kind: 'reasons', label: 'Survey reasons', icon: 'message-square' },
  { kind: 'cards', label: 'Loss aversion cards', icon: 'shield' },
  { kind: 'redirects', label: 'Redirect pages', icon: 'external-link' },
]

function HeaderButton({ label, icon, onClick }: { label: string; icon: SIconName; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900"
    >
      <SIcon name={icon} size={16} />
    </button>
  )
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="flex h-7 items-center px-[10px]">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{title}</span>
    </div>
  )
}

function newPlay() {
  const id = createPlay()
  openPlay(id)
  useWorkspaceUi.getState().setRenaming(id)
}

function openTemplates() {
  useWorkspaceUi.getState().setPage('thread')
  useOrchestration.getState().openTemplates(useOrchestration.getState().libraryTab)
}

function newItems(): MenuItem[] {
  return [
    { label: 'Play', icon: 'target', hint: 'Who sees which experience', onClick: newPlay },
    ...createMenuItems(),
    { label: 'From a template', icon: 'layout-template', hint: 'Start an experience from a ready one', onClick: openTemplates },
  ]
}

/** Recent items that still exist: plays, and experiences that aren't in the play they were opened from. */
function useLiveRecent(): RecentItem[] {
  const items = useRecent((s) => s.items)
  const plays = usePlays((s) => s.plays)
  const threads = useWorkspace((s) => s.threads)
  return items.filter((x) => (x.kind === 'play' ? plays.some((p) => p.id === x.id) : threads.some((t) => t.id === x.id)))
}

function RecentRow({ item, open, onToggle }: { item: RecentItem; open: boolean; onToggle: () => void }) {
  const play = usePlays((s) => (item.kind === 'play' ? s.plays.find((p) => p.id === item.id) : undefined))
  const thread = useWorkspace((s) => (item.kind === 'experience' ? s.threads.find((t) => t.id === item.id) : undefined))
  const page = useWorkspaceUi((s) => s.page)
  const activeId = useWorkspace((s) => s.activeId)
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  if (play) return <PlayRow play={play} open={open} onToggle={onToggle} />
  if (thread) return <LooseRow thread={thread} current={page === 'thread' && !templatesOpen && activeId === thread.id} />
  return null
}

/** v9: one pane for an objective. Three places that don't grow, then what you're working on. */
export function ObjectivePane() {
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  const setSidebarOpen = useWorkspaceUi((s) => s.setSidebarOpen)
  const setSearchOpen = useWorkspaceUi((s) => s.setSearchOpen)
  const page = useWorkspaceUi((s) => s.page)
  const libraryKind = useWorkspaceUi((s) => s.libraryKind)
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const recent = useLiveRecent()
  const folded = !sidebarOpen
  const inLibrary = page === 'library' || (page === 'thread' && templatesOpen)
  const [libraryOpen, setLibraryOpen] = useState(inLibrary)
  const [brandOpen, setBrandOpen] = useState(false)
  const [workFolded, setWorkFolded] = useState(false)
  const [recentOpen, setRecentOpen] = useState<Set<string>>(new Set())
  const [working, ...rest] = recent
  const workingKey = working ? `${working.kind}:${working.id}` : null

  useEffect(() => {
    if (inLibrary) setLibraryOpen(true)
  }, [inLibrary])

  useEffect(() => {
    setWorkFolded(false)
  }, [workingKey])

  const toggleRecent = (id: string) =>
    setRecentOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const openLibraryRow = () => {
    if (folded) {
      setSidebarOpen(true)
      setLibraryOpen(true)
    } else setLibraryOpen((v) => !v)
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className={`flex h-[60px] flex-none items-center border-b border-slate-200 ${folded ? 'justify-center' : 'gap-[2px] px-[14px]'}`}>
        {!folded && <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-900">Retention</span>}
        {!folded && <HeaderButton label="Search" icon="search" onClick={() => setSearchOpen(true)} />}
        {!folded && (
          <div className="flex h-8 w-8 flex-none items-center justify-center">
            <RowMenu label="New" icon="plus" items={newItems()} width={270} align="beside" />
          </div>
        )}
        <HeaderButton label={folded ? 'Open side panel' : 'Close side panel'} icon="panel-left" onClick={() => setSidebarOpen(folded)} />
      </div>

      <div className={`relative flex flex-none flex-col gap-[2px] py-[10px] ${folded ? 'px-[8px]' : 'px-[10px]'}`}>
        {folded && <SettingRow icon="search" label="Search" folded onClick={() => setSearchOpen(true)} />}
        <SettingRow icon="list-ordered" label="Plays" folded={folded} active={page === 'order'} onClick={openOrder} />
        <SettingRow
          icon="layers"
          label="Experiences"
          folded={folded}
          active={page === 'index'}
          onClick={() => {
            useOrchestration.getState().closeTemplates()
            useWorkspaceUi.getState().setPage('index')
          }}
        />
        <SettingRow
          icon="library"
          label="Library"
          folded={folded}
          active={folded && inLibrary}
          onClick={openLibraryRow}
          trailing={<SIcon name="chevron-right" size={13} className={`flex-none text-slate-400 transition-transform ${libraryOpen ? 'rotate-90' : ''}`} />}
        />
        {!folded && libraryOpen && (
          <div className="ml-[18px] flex flex-col gap-[1px] border-l border-slate-200 pl-[6px]">
            <SettingRow icon="layout-template" label="Templates" folded={false} active={page === 'thread' && templatesOpen} onClick={openTemplates} />
            {LIBRARY_ROWS.map((r) => (
              <SettingRow
                key={r.kind}
                icon={r.icon}
                label={r.label}
                folded={false}
                active={page === 'library' && libraryKind === r.kind}
                onClick={() => openLibrary(r.kind)}
              />
            ))}
            <div className="relative">
              <SettingRow icon="palette" label="Brand" folded={false} active={brandOpen} onClick={() => setBrandOpen((v) => !v)} />
              {brandOpen && <BrandPopover onClose={() => setBrandOpen(false)} />}
            </div>
          </div>
        )}
      </div>

      {!folded && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 px-[10px] pb-[10px] pt-[10px]">
          <SectionHead title="Working on" />
          {working ? (
            <RecentRow item={working} open={!workFolded} onToggle={() => setWorkFolded((v) => !v)} />
          ) : (
            <p className="px-[10px] py-[4px] text-[12px] leading-snug text-slate-400">Open a play or an experience and it stays here while you work.</p>
          )}
          {rest.length > 0 && (
            <div className="mt-[12px] border-t border-slate-200 pt-[12px]">
              <SectionHead title="Recent" />
              <div className="flex flex-col gap-[2px]">
                {rest.slice(0, RECENT_SHOWN).map((x) => (
                  <RecentRow key={`${x.kind}:${x.id}`} item={x} open={recentOpen.has(x.id)} onToggle={() => toggleRecent(x.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
