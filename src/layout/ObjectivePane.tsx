import { useEffect, useState, type ReactNode } from 'react'
import { SIcon, type SIconName } from '@chargebee/sting-react'
import { openArchive, openConfigure, openLibrary, openOrder, openPlay } from '../plays/navigate'
import { audienceText } from '../plays/resolve'
import type { CancelPlay } from '../plays/types'
import { createPlay, usePlays } from '../plays/usePlays'
import { RowMenu, type MenuItem } from '../plays/ui'
import { useOrchestration } from '../store/useOrchestration'
import type { ShellLayout } from '../types/experience'
import { orderedThreads, useWorkspace, type ExperienceThread } from '../workspace/useWorkspace'
import { useWorkspaceUi, type LibraryKind } from '../workspace/useWorkspaceUi'
import { createMenuItems } from './createMenu'
import { SHELL_KIND, shellOf } from './experienceKind'
import { LooseRow, PlayRow } from './PlaysTree'
import { SettingRow } from './ThreadSidebar'
import { useRecent, type RecentItem } from './useRecent'

const RECENT_SHOWN = 8
const AUDIENCES_SHOWN = 3

const LIBRARY_ROWS: { kind: LibraryKind; label: string; icon: SIconName; add: string }[] = [
  { kind: 'offers', label: 'Offers', icon: 'gift', add: 'New offer' },
  { kind: 'reasons', label: 'Survey reasons', icon: 'message-square', add: 'New survey reason' },
  { kind: 'cards', label: 'Loss aversion cards', icon: 'shield', add: 'New loss aversion card' },
  { kind: 'redirects', label: 'Redirect pages', icon: 'external-link', add: 'New redirect page' },
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

/** A pane row. Its add control shows on hover, so creating something starts where that thing lives. */
function PaneRow({
  icon,
  label,
  active,
  onClick,
  add,
  trailing,
}: {
  icon: SIconName
  label: string
  active?: boolean
  onClick: () => void
  add?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className={`group flex h-9 items-center rounded-lg pr-[4px] transition-colors ${active ? 'bg-slate-200/70' : 'hover:bg-slate-200/50'}`}>
      <button
        type="button"
        onClick={onClick}
        className={`flex h-full min-w-0 flex-1 items-center gap-[10px] px-[10px] text-left text-[13px] font-medium ${active ? 'text-slate-900' : 'text-slate-700 hover:text-slate-900'}`}
      >
        <SIcon name={icon} size={16} className="flex-none text-slate-500" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {trailing}
      </button>
      {add && (
        <div className="flex flex-none opacity-0 transition-opacity group-hover:opacity-100 has-[:focus-visible]:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          {add}
        </div>
      )}
    </div>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900"
    >
      <SIcon name="plus" size={14} />
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

function openExperiences() {
  useOrchestration.getState().closeTemplates()
  useWorkspaceUi.getState().setPage('index')
}

function openTemplates() {
  useWorkspaceUi.getState().setPage('thread')
  useOrchestration.getState().openTemplates(useOrchestration.getState().libraryTab)
}

/** The layouts a new cancel experience can start in, then a template. */
function newExperienceItems(): MenuItem[] {
  return [
    ...(createMenuItems()[0].items ?? []),
    { label: 'From a template', icon: 'layout-template', hint: 'Start from a ready experience', onClick: openTemplates },
  ]
}

/** Recent items that still exist, newest first. */
function useLiveRecent(): RecentItem[] {
  const items = useRecent((s) => s.items)
  const plays = usePlays((s) => s.plays)
  const threads = useWorkspace((s) => s.threads)
  const live = items.filter((x) => (x.kind === 'play' ? plays.some((p) => p.id === x.id) : threads.some((t) => t.id === x.id)))
  if (live.length >= RECENT_SHOWN) return live.slice(0, RECENT_SHOWN)
  // Demo: top up with sample plays and experiences so every group shows on a fresh load.
  const has = (kind: RecentItem['kind'], id: string) => live.some((x) => x.kind === kind && x.id === id)
  const playFill = plays.filter((p) => !has('play', p.id)).map((p) => ({ kind: 'play' as const, id: p.id }))
  const expFill = orderedThreads(threads)
    .filter((t) => !has('experience', t.id) && (t.title !== 'New experience' || t.snapshot?.chat.lines.length))
    .map((t) => ({ kind: 'experience' as const, id: t.id }))
  const fill: RecentItem[] = []
  for (let i = 0; i < Math.max(playFill.length, expFill.length); i++) {
    if (playFill[i]) fill.push(playFill[i])
    if (expFill[i]) fill.push(expFill[i])
  }
  return [...live, ...fill].slice(0, RECENT_SHOWN)
}

interface AudienceUse {
  key: string
  name: string
  play: CancelPlay
}

/** The audiences of recent plays, each once: every play's own audience first, then sub-audiences. */
function audiencesOf(plays: CancelPlay[]): AudienceUse[] {
  const out: AudienceUse[] = []
  const pairs = [
    ...plays.map((p) => ({ p, a: p.audience })),
    ...plays.flatMap((p) => p.subAudiences.map((x) => ({ p, a: x.audience }))),
  ]
  for (const { p, a } of pairs) {
    const name = a.targetAll ? 'All subscribers' : audienceText(a)
    if (!name || out.some((x) => x.name === name)) continue
    out.push({ key: `${p.id}:${a.id}`, name, play: p })
  }
  return out.slice(0, AUDIENCES_SHOWN)
}

function GroupHead({ icon, title }: { icon: SIconName; title: string }) {
  return (
    <div className="flex h-7 items-center gap-[6px] px-[10px] pt-[4px]">
      <SIcon name={icon} size={11} className="flex-none text-slate-400" />
      <span className="text-[11px] font-semibold text-slate-500">{title}</span>
    </div>
  )
}

function AudienceRow({ use }: { use: AudienceUse }) {
  return (
    <button
      type="button"
      onClick={() => openConfigure(use.play.id, 1)}
      title={`Used in ${use.play.name}. Opens its audience.`}
      className="flex h-8 w-full min-w-0 items-center gap-[6px] rounded-lg pl-[10px] pr-[8px] text-left text-[12.5px] text-slate-700 transition-colors hover:bg-slate-200/50"
    >
      <span className="min-w-0 flex-1 truncate">{use.name}</span>
      <span className="max-w-[90px] flex-none truncate text-[11px] text-slate-400">{use.play.name}</span>
    </button>
  )
}

/** v9: one pane for an objective. Places that don't grow, then recent work grouped by type. */
export function ObjectivePane() {
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  const setSidebarOpen = useWorkspaceUi((s) => s.setSidebarOpen)
  const setSearchOpen = useWorkspaceUi((s) => s.setSearchOpen)
  const page = useWorkspaceUi((s) => s.page)
  const playId = useWorkspaceUi((s) => s.playId)
  const libraryKind = useWorkspaceUi((s) => s.libraryKind)
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const activeId = useWorkspace((s) => s.activeId)
  const plays = usePlays((s) => s.plays)
  const threads = useWorkspace((s) => s.threads)
  const archivedCount = usePlays((s) => s.archived.length) + useWorkspace((s) => s.archived.length)
  const recent = useLiveRecent()
  const folded = !sidebarOpen
  const inLibrary = page === 'library'
  const [libraryOpen, setLibraryOpen] = useState(inLibrary)
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (inLibrary) setLibraryOpen(true)
  }, [inLibrary])

  const toggle = (id: string) =>
    setOpen((s) => {
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

  const recentPlays = recent.filter((x) => x.kind === 'play').map((x) => plays.find((p) => p.id === x.id)).filter((p): p is CancelPlay => Boolean(p))
  const recentThreads = recent
    .filter((x) => x.kind === 'experience')
    .map((x) => threads.find((t) => t.id === x.id))
    .filter((t): t is ExperienceThread => Boolean(t))
  const byShell = new Map<ShellLayout, ExperienceThread[]>()
  for (const t of recentThreads) byShell.set(shellOf(t), [...(byShell.get(shellOf(t)) ?? []), t])
  const audiences = audiencesOf(recentPlays)
  const playOpen = (p: CancelPlay) => open.has(p.id) !== (page === 'play' && playId === p.id)

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-50">
      <div className={`flex h-[60px] flex-none items-center border-b border-slate-200 ${folded ? 'justify-center' : 'gap-[2px] px-[14px]'}`}>
        {!folded && <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-slate-900">Retention</span>}
        {!folded && <HeaderButton label="Search" icon="search" onClick={() => setSearchOpen(true)} />}
        <HeaderButton label={folded ? 'Open side panel' : 'Close side panel'} icon="panel-left" onClick={() => setSidebarOpen(folded)} />
      </div>

      <div className={`relative flex flex-none flex-col gap-[2px] py-[10px] ${folded ? 'px-[8px]' : 'px-[10px]'}`}>
        {folded ? (
          <>
            <SettingRow icon="search" label="Search" folded onClick={() => setSearchOpen(true)} />
            <SettingRow icon="list-ordered" label="Plays" folded active={page === 'order'} onClick={openOrder} />
            <SettingRow icon="layers" label="Experiences" folded active={page === 'index' || (page === 'thread' && templatesOpen)} onClick={openExperiences} />
            <SettingRow icon="library" label="Library" folded active={inLibrary} onClick={openLibraryRow} />
            <SettingRow icon="archive" label="Archive" folded active={page === 'archive'} onClick={openArchive} />
          </>
        ) : (
          <>
            <PaneRow icon="list-ordered" label="Plays" active={page === 'order'} onClick={openOrder} add={<AddButton label="New play" onClick={newPlay} />} />
            <PaneRow
              icon="layers"
              label="Experiences"
              active={page === 'index'}
              onClick={openExperiences}
              add={<RowMenu label="New experience" icon="plus" items={newExperienceItems()} width={270} align="beside" />}
            />
            <div className="ml-[18px] flex flex-col gap-[1px] border-l border-slate-200 pl-[6px]">
              <PaneRow icon="layout-template" label="Templates" active={page === 'thread' && templatesOpen} onClick={openTemplates} />
            </div>
            <PaneRow
              icon="library"
              label="Library"
              onClick={openLibraryRow}
              trailing={<SIcon name="chevron-right" size={13} className={`flex-none text-slate-400 transition-transform ${libraryOpen ? 'rotate-90' : ''}`} />}
            />
            {libraryOpen && (
              <div className="ml-[18px] flex flex-col gap-[1px] border-l border-slate-200 pl-[6px]">
                {LIBRARY_ROWS.map((r) => (
                  <PaneRow
                    key={r.kind}
                    icon={r.icon}
                    label={r.label}
                    active={page === 'library' && libraryKind === r.kind}
                    onClick={() => openLibrary(r.kind)}
                    add={<AddButton label={r.add} onClick={() => openLibrary(r.kind, true)} />}
                  />
                ))}
              </div>
            )}
            <PaneRow
              icon="archive"
              label="Archive"
              active={page === 'archive'}
              onClick={openArchive}
              trailing={archivedCount > 0 ? <span className="flex-none text-[11.5px] tabular-nums text-slate-400">{archivedCount}</span> : undefined}
            />
          </>
        )}
      </div>

      {!folded && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 px-[10px] pb-[10px] pt-[10px]">
          <SectionHead title="Recent" />
          {recent.length === 0 && (
            <p className="px-[10px] py-[4px] text-[12px] leading-snug text-slate-400">Plays and experiences you open show up here.</p>
          )}
          {recentPlays.length > 0 && (
            <div className="mb-[6px]">
              <GroupHead icon="list-ordered" title="Plays" />
              <div className="flex flex-col gap-[2px]">
                {recentPlays.map((p) => (
                  <PlayRow key={p.id} play={p} open={playOpen(p)} onToggle={() => toggle(p.id)} />
                ))}
              </div>
            </div>
          )}
          {(Object.keys(SHELL_KIND) as ShellLayout[])
            .filter((k) => byShell.has(k))
            .map((k) => (
              <div key={k} className="mb-[6px]">
                <GroupHead icon={SHELL_KIND[k].icon} title={SHELL_KIND[k].plural} />
                <div className="flex flex-col gap-[2px]">
                  {byShell.get(k)!.map((t) => (
                    <LooseRow key={t.id} thread={t} current={page === 'thread' && !templatesOpen && activeId === t.id} />
                  ))}
                </div>
              </div>
            ))}
          {audiences.length > 0 && (
            <div className="mb-[6px]">
              <GroupHead icon="users" title="Audiences" />
              <div className="flex flex-col gap-[2px]">
                {audiences.map((a) => (
                  <AudienceRow key={a.key} use={a} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
