import { useEffect, useMemo, useState } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { SOON, useRetentionSoon, type SoonPlace } from '../Soon'
import { openLibrary, openOrder, openPlay } from '../../plays/navigate'
import { audienceText } from '../../plays/resolve'
import type { CancelPlay } from '../../plays/types'
import { createPlay, usePlays } from '../../plays/usePlays'
import { RowMenu } from '../../plays/ui'
import { useOrchestration } from '../../store/useOrchestration'
import { orderedThreads, useWorkspace, type ExperienceThread } from '../../workspace/useWorkspace'
import { useWorkspaceUi, type LibraryKind } from '../../workspace/useWorkspaceUi'
import { createMenuItems } from '../../layout/createMenu'
import { LooseRow, PlayRow } from '../../layout/PlaysTree'
import { useRecent } from '../../layout/useRecent'
import { ObjectivePaneShell, PaneSection, type PaneRowSpec } from './ObjectivePaneShell'

const EXPERIENCE_PARTS: { kind: LibraryKind; label: string; icon: 'message-square' | 'shield' }[] = [
  { kind: 'reasons', label: 'Survey reasons', icon: 'message-square' },
  { kind: 'cards', label: 'Loss aversion cards', icon: 'shield' },
]

function openExperiences() {
  useOrchestration.getState().closeTemplates()
  useWorkspaceUi.getState().setPage('index')
}

function openTemplates() {
  useWorkspaceUi.getState().setPage('thread')
  useOrchestration.getState().openTemplates(useOrchestration.getState().libraryTab)
}

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

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-900">
      <SIcon name="plus" size={14} />
    </button>
  )
}

export function RetentionPane() {
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  const page = useWorkspaceUi((s) => s.page)
  const libraryKind = useWorkspaceUi((s) => s.libraryKind)
  const playId = useWorkspaceUi((s) => s.playId)
  const templatesOpen = useOrchestration((s) => s.templatesOpen)
  const threads = useWorkspace((s) => s.threads)
  const activeId = useWorkspace((s) => s.activeId)
  const plays = usePlays((s) => s.plays)
  const recentItems = useRecent((s) => s.items)
  const soon = useRetentionSoon((s) => s.place)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const folded = !sidebarOpen

  useEffect(() => {
    if (playId) setOpen((s) => (s.has(playId) ? s : new Set(s).add(playId)))
  }, [playId])

  const recent = useMemo(() => {
    const live = recentItems.filter((item) => item.kind === 'play' ? plays.some((p) => p.id === item.id) : threads.some((t) => t.id === item.id))
    const keys = new Set(live.map((item) => `${item.kind}:${item.id}`))
    const fill = [
      ...plays.map((p) => ({ kind: 'play' as const, id: p.id })),
      ...orderedThreads(threads).map((t) => ({ kind: 'experience' as const, id: t.id })),
    ].filter((item) => !keys.has(`${item.kind}:${item.id}`))
    return [...live, ...fill].slice(0, 8)
  }, [plays, recentItems, threads])

  const recentPlays = recent
    .filter((item) => item.kind === 'play')
    .map((item) => plays.find((play) => play.id === item.id))
    .filter((play): play is CancelPlay => Boolean(play))
  const recentThreads = recent
    .filter((item) => item.kind === 'experience')
    .map((item) => threads.find((thread) => thread.id === item.id))
    .filter((thread): thread is ExperienceThread => Boolean(thread))
  const onLibrary = (kind: LibraryKind) => page === 'library' && libraryKind === kind
  const inExperiences = page === 'index' || (page === 'thread' && templatesOpen) || onLibrary('reasons') || onLibrary('cards')
  const experienceRows: PaneRowSpec[] = [
    {
      id: 'all-experiences',
      label: 'All experiences',
      icon: 'layers',
      active: page === 'index',
      section: inExperiences && page !== 'index',
      showWhenFolded: true,
      onClick: openExperiences,
      add: <RowMenu label="New experience" icon="plus" items={createMenuItems()} width={270} align="beside" />,
    },
    { id: 'templates', label: 'Templates', icon: 'layout-template', active: page === 'thread' && templatesOpen, onClick: openTemplates },
    ...EXPERIENCE_PARTS.map((item) => ({
      id: item.kind,
      label: item.label,
      icon: item.icon,
      active: onLibrary(item.kind),
      onClick: () => openLibrary(item.kind),
      add: <AddButton label={`New ${item.label.toLowerCase().replace(/s$/, '')}`} onClick={() => openLibrary(item.kind, true)} />,
    })),
    {
      id: SOON.notifications.id,
      label: SOON.notifications.label,
      icon: SOON.notifications.icon,
      active: page === 'soon' && soon?.id === SOON.notifications.id,
      onClick: () => openSoon(SOON.notifications),
    },
  ]

  return (
    <ObjectivePaneShell
      title="Retention"
      folded={folded}
      onSearch={() => useWorkspaceUi.getState().setSearchOpen(true)}
      onToggle={() => useWorkspaceUi.getState().setSidebarOpen(folded)}
      topRows={[
        {
          id: 'plays',
          label: 'Plays',
          icon: 'list-ordered',
          active: page === 'order' || page === 'play',
          showWhenFolded: true,
          onClick: openOrder,
          add: <AddButton label="New play" onClick={newPlay} />,
        },
      ]}
      sections={[
        { id: 'experiences', title: 'Experiences', rows: experienceRows },
        {
          id: 'offers',
          title: 'Offers and pages',
          rows: [
            { id: 'offers', label: 'Offers', icon: 'gift', active: onLibrary('offers'), showWhenFolded: true, onClick: () => openLibrary('offers') },
            { id: 'redirects', label: 'Redirect pages', icon: 'external-link', active: onLibrary('redirects'), showWhenFolded: true, onClick: () => openLibrary('redirects') },
          ],
        },
        {
          id: 'reporting',
          title: 'Reporting',
          rows: [{
            id: SOON.performance.id,
            label: SOON.performance.label,
            icon: SOON.performance.icon,
            active: page === 'soon' && soon?.id === SOON.performance.id,
            showWhenFolded: true,
            onClick: () => openSoon(SOON.performance),
          }],
        },
      ]}
      recent={
        <>
          {recentPlays.length > 0 && (
            <PaneSection title="Recent plays">
              {recentPlays.map((play) => (
                <PlayRow
                  key={play.id}
                  play={play}
                  open={open.has(play.id)}
                  onToggle={() => setOpen((value) => {
                    const next = new Set(value)
                    if (next.has(play.id)) next.delete(play.id)
                    else next.add(play.id)
                    return next
                  })}
                />
              ))}
            </PaneSection>
          )}
          {recentThreads.length > 0 && (
            <PaneSection title="Recent experiences">
              {recentThreads.map((thread) => (
                <LooseRow key={thread.id} thread={thread} current={page === 'thread' && !templatesOpen && activeId === thread.id} />
              ))}
            </PaneSection>
          )}
          {recentPlays.length > 0 && (
            <PaneSection title="Recent audiences">
              {recentPlays.slice(0, 3).map((play) => (
                <button
                  key={play.id}
                  type="button"
                  onClick={() => openPlay(play.id)}
                  className="slg-nav-item flex h-8 w-full items-center gap-[10px] px-[10px] text-left text-[13px]"
                >
                  <SIcon name="users" size={14} className="slg-nav-icon" />
                  <span className="truncate">{play.audience.targetAll ? 'All subscribers' : audienceText(play.audience)}</span>
                </button>
              ))}
            </PaneSection>
          )}
        </>
      }
      footer={{
        id: SOON.archive.id,
        label: SOON.archive.label,
        icon: SOON.archive.icon,
        active: page === 'soon' && soon?.id === SOON.archive.id,
        onClick: () => openSoon(SOON.archive),
      }}
    />
  )
}
