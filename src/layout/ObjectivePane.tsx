import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { navItem } from './navStyle'
import { SettingRow } from './ThreadSidebar'
import { useRecent, type RecentItem } from './useRecent'
import { CONCIERGE } from './layoutMode'
import { SOON, useRetentionSoon, type SoonPlace } from '../concierge/Soon'

const RECENT_SHOWN = 8
const AUDIENCES_SHOWN = 3

const EXPERIENCE_PARTS: { kind: LibraryKind; label: string; icon: SIconName; add: string }[] = [
  { kind: 'reasons', label: 'Survey reasons', icon: 'message-square', add: 'New survey reason' },
  { kind: 'cards', label: 'Loss aversion cards', icon: 'shield', add: 'New loss aversion card' },
]

const OWN_ITEMS: { kind: LibraryKind; label: string; icon: SIconName; add: string }[] = [
  { kind: 'offers', label: 'Offers', icon: 'gift', add: 'New offer' },
  { kind: 'redirects', label: 'Redirect pages', icon: 'external-link', add: 'New redirect page' },
]

export function HeaderButton({ label, icon, onClick }: { label: string; icon: SIconName; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`${navItem()} flex h-8 w-8 flex-none items-center justify-center`}
    >
      <SIcon name={icon} size={18} className="slg-nav-icon" />
    </button>
  )
}

/** A pane row. Its add control shows on hover, so creating something starts where that thing lives. */
export function PaneRow({
  icon,
  label,
  active,
  section,
  onClick,
  add,
  trailing,
}: {
  icon: SIconName
  label: string
  active?: boolean
  section?: boolean
  onClick: () => void
  add?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className={`group relative flex h-8 items-center ${navItem(active, section)}`}>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className="flex h-full min-w-0 flex-1 items-center gap-[10px] px-[10px] text-left"
      >
        <SIcon name={icon} size={16} className="slg-nav-icon flex-none" />
        <span className="slg-pane-label min-w-0 flex-1 truncate">{label}</span>
        {trailing}
      </button>
      {add && (
        <div className="absolute right-[6px] top-1/2 flex -translate-y-1/2 bg-inherit pl-[4px] opacity-0 transition-opacity group-hover:opacity-100 has-[:focus-visible]:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          {add}
        </div>
      )}
    </div>
  )
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
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

/** A group's name above its rows, in sentence case. */
function SectionHead({ title }: { title: string }) {
  return (
    <div className="flex h-7 items-end px-[10px] pb-[4px]">
      <span className="slg-pane-head">{title}</span>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <SectionHead title={title} />
      {children}
    </div>
  )
}

/** Concierge: places in the pane that aren't built yet. */
function openSoon(place: SoonPlace) {
  useOrchestration.getState().closeTemplates()
  useRetentionSoon.setState({ place })
  useWorkspaceUi.getState().setPage('soon')
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

/** Recent items with a steady order: opening one that's already listed leaves it in place, and new ones join at the top. */
function useLiveRecent(): RecentItem[] {
  const next = useRecentPick()
  const shown = useRef<RecentItem[]>([])
  const key = (x: RecentItem) => `${x.kind}:${x.id}`
  const keep = new Set(next.map(key))
  const before = new Set(shown.current.map(key))
  const steady = [...next.filter((x) => !before.has(key(x))), ...shown.current.filter((x) => keep.has(key(x)))]
  shown.current = steady
  return steady
}

/** Recent items that still exist, newest first. */
function useRecentPick(): RecentItem[] {
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

function AudienceRow({ use }: { use: AudienceUse }) {
  return (
    <button
      type="button"
      onClick={() => openConfigure(use.play.id, 1)}
      title={`Used in ${use.play.name}. Opens its audience.`}
      className={`${navItem()} group flex h-8 w-full min-w-0 items-center gap-[6px] pl-[36px] pr-[8px] text-left text-[13px] font-normal`}
    >
      <span className="min-w-0 flex-1 truncate">{use.name}</span>
      <span className="hidden max-w-[96px] flex-none truncate text-[11.5px] text-slate-400 group-hover:block">{use.play.name}</span>
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
  const soon = useRetentionSoon((s) => s.place)
  const onSoon = (place: SoonPlace) => page === 'soon' && soon?.id === place.id
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const activeId = useWorkspace((s) => s.activeId)
  const plays = usePlays((s) => s.plays)
  const threads = useWorkspace((s) => s.threads)
  const archivedCount = usePlays((s) => s.archived.length) + useWorkspace((s) => s.archived.length)
  const recent = useLiveRecent()
  const folded = !sidebarOpen
  const onLibrary = (kind: LibraryKind) => page === 'library' && libraryKind === kind
  const inExperiences = page === 'index' || (page === 'thread' && templatesOpen) || onLibrary('reasons') || onLibrary('cards')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const inPlay = (page === 'play' || page === 'thread') && playId ? playId : null
  useEffect(() => {
    if (inPlay) setOpen((s) => (s.has(inPlay) ? s : new Set(s).add(inPlay)))
  }, [inPlay])

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const recentPlays = recent.filter((x) => x.kind === 'play').map((x) => plays.find((p) => p.id === x.id)).filter((p): p is CancelPlay => Boolean(p))
  const recentThreads = recent
    .filter((x) => x.kind === 'experience')
    .map((x) => threads.find((t) => t.id === x.id))
    .filter((t): t is ExperienceThread => Boolean(t))
  const byShell = new Map<ShellLayout, ExperienceThread[]>()
  for (const t of recentThreads) byShell.set(shellOf(t), [...(byShell.get(shellOf(t)) ?? []), t])
  const audiences = audiencesOf(recentPlays)
  const playOpen = (p: CancelPlay) => open.has(p.id)
  const openedInPlay = recentPlays.some(
    (p) => p.id === playId && open.has(p.id) && p.variants.some((v) => v.experienceId === activeId),
  )

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className={`flex h-[60px] flex-none items-center border-b border-slate-200 ${folded ? 'justify-center' : 'gap-[2px] px-[14px]'}`}>
        {!folded && <span className="min-w-0 flex-1 truncate font-[family-name:var(--slg-font-family-emphasis)] text-[16px] font-semibold text-[var(--slg-neutral-900)]">Retention</span>}
        {!folded && <HeaderButton label="Search" icon="search" onClick={() => setSearchOpen(true)} />}
        <HeaderButton label={folded ? 'Open side panel' : 'Close side panel'} icon="panel-left" onClick={() => setSidebarOpen(folded)} />
      </div>

      {folded ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-[2px] px-[8px] py-[10px]">
            <SettingRow icon="search" label="Search" folded onClick={() => setSearchOpen(true)} />
            <SettingRow icon="list-ordered" label="Plays" folded active={page === 'order'} onClick={openOrder} />
            <SettingRow icon="layers" label="Experiences" folded active={inExperiences} onClick={openExperiences} />
            {OWN_ITEMS.map((r) => (
              <SettingRow key={r.kind} icon={r.icon} label={r.label} folded active={onLibrary(r.kind)} onClick={() => openLibrary(r.kind)} />
            ))}
            {CONCIERGE && (
              <SettingRow icon={SOON.performance.icon} label={SOON.performance.label} folded active={onSoon(SOON.performance)} onClick={() => openSoon(SOON.performance)} />
            )}
          </div>
          <div className="flex-none border-t border-slate-200 px-[8px] py-[8px]">
            <SettingRow icon="archive" label="Archive" folded active={page === 'archive'} onClick={openArchive} />
          </div>
        </>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[10px] pb-[16px] pt-[10px]">
            <PaneRow icon="list-ordered" label="Plays" active={page === 'order'} onClick={openOrder} add={<AddButton label="New play" onClick={newPlay} />} />

            <Section title="Experiences">
              <PaneRow
                icon="layers"
                label="All experiences"
                active={page === 'index'}
                onClick={openExperiences}
                add={<RowMenu label="New experience" icon="plus" items={newExperienceItems()} width={270} align="beside" />}
              />
              <PaneRow icon="layout-template" label="Templates" active={page === 'thread' && templatesOpen} onClick={openTemplates} />
              {EXPERIENCE_PARTS.map((r) => (
                <PaneRow
                  key={r.kind}
                  icon={r.icon}
                  label={r.label}
                  active={onLibrary(r.kind)}
                  onClick={() => openLibrary(r.kind)}
                  add={<AddButton label={r.add} onClick={() => openLibrary(r.kind, true)} />}
                />
              ))}
              {CONCIERGE && (
                <PaneRow
                  icon={SOON.notifications.icon}
                  label={SOON.notifications.label}
                  active={onSoon(SOON.notifications)}
                  onClick={() => openSoon(SOON.notifications)}
                />
              )}
            </Section>

            <Section title="Offers and pages">
              {OWN_ITEMS.map((r) => (
                <PaneRow
                  key={r.kind}
                  icon={r.icon}
                  label={r.label}
                  active={onLibrary(r.kind)}
                  onClick={() => openLibrary(r.kind)}
                  add={<AddButton label={r.add} onClick={() => openLibrary(r.kind, true)} />}
                />
              ))}
            </Section>

            {CONCIERGE && (
              <Section title="Reporting">
                <PaneRow
                  icon={SOON.performance.icon}
                  label={SOON.performance.label}
                  active={onSoon(SOON.performance)}
                  onClick={() => openSoon(SOON.performance)}
                />
              </Section>
            )}

            {recent.length === 0 && (
              <Section title="Recent">
                <p className="px-[10px] py-[4px] text-[12px] leading-snug text-slate-400">Plays and experiences you open show up here.</p>
              </Section>
            )}
            {recentPlays.length > 0 && (
              <Section title="Recent plays">
                {recentPlays.map((p) => (
                  <PlayRow key={p.id} play={p} open={playOpen(p)} onToggle={() => toggle(p.id)} />
                ))}
              </Section>
            )}
            {(Object.keys(SHELL_KIND) as ShellLayout[])
              .filter((k) => byShell.has(k))
              .map((k) => (
                <Section key={k} title={`Recent ${SHELL_KIND[k].plural.toLowerCase()}`}>
                  {byShell.get(k)!.map((t) => (
                    <LooseRow key={t.id} thread={t} current={page === 'thread' && !templatesOpen && activeId === t.id && !openedInPlay} />
                  ))}
                </Section>
              ))}
            {audiences.length > 0 && (
              <Section title="Recent audiences">
                {audiences.map((a) => (
                  <AudienceRow key={a.key} use={a} />
                ))}
              </Section>
            )}
          </div>

          <div className="flex-none border-t border-slate-200 px-[10px] py-[8px]">
            <PaneRow
              icon="archive"
              label="Archive"
              active={page === 'archive'}
              onClick={openArchive}
              trailing={archivedCount > 0 ? <span className="flex-none text-[11.5px] tabular-nums text-slate-400">{archivedCount}</span> : undefined}
            />
          </div>
        </>
      )}
    </aside>
  )
}
