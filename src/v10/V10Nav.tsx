import { useEffect, useState, type ReactNode } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { TYPE_LABEL, type GrowthExperience } from '../concierge/model'
import { GrowthLooseRow, GrowthPlayRow } from '../concierge/objective/GrowthPane'
import { useGrowthUi } from '../concierge/objective/useGrowthUi'
import { useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { useGrowthPlays, type GrowthPlay } from '../concierge/useGrowthPlays'
import { SHELL_KIND, shellOf } from '../layout/experienceKind'
import { HeaderButton } from '../layout/ObjectivePane'
import { LooseRow, PlayRow } from '../layout/PlaysTree'
import { navItem } from '../layout/navStyle'
import { SettingRow } from '../layout/ThreadSidebar'
import { RowMenu } from '../plays/ui'
import type { CancelPlay } from '../plays/types'
import { usePlays } from '../plays/usePlays'
import { childrenOf, type NavLeafId } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useWorkspace, type ExperienceThread } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { titleOf, useV10Rows } from './rows'
import { useAudiences } from './useAudiences'
import {
  createV10Audience,
  createV10CancelPage,
  createV10Experience,
  createV10GrowthPlay,
  createV10Play,
  createV10RetentionPlay,
  openRef,
  useV10,
  type V10Ref,
} from './useV10'

const DESTINATIONS: { id: string; label: string; route: NavLeafId; match: (route: NavLeafId) => boolean }[] = [
  { id: 'home', label: 'Home', route: 'home', match: (route) => route === 'home' },
  { id: 'renewal', label: 'Revenue optimization', route: 'renewal', match: (route) => route === 'renewal' },
]

const VIEWS: { label: string; route: NavLeafId }[] = [
  { label: 'Plays', route: 'work.plays' },
  { label: 'Experiences', route: 'work.experiences' },
  { label: 'Audiences', route: 'work.audiences' },
]

function visit(route: NavLeafId) {
  useV10.getState().close()
  useGrowthShell.getState().go(route)
}

const NEW_ITEMS = [
  {
    label: 'Acquisition play',
    icon: 'rocket' as const,
    items: [
      { label: 'In-app offer play', icon: 'gift' as const, onClick: () => createV10GrowthPlay('acquisition', 'in_app_offer') },
      { label: 'Pricing table play', icon: 'table' as const, onClick: () => createV10GrowthPlay('acquisition', 'pricing_table') },
      { label: 'Empty play', icon: 'workflow' as const, onClick: createV10Play },
    ],
  },
  {
    label: 'Expansion play',
    icon: 'arrow-up-right' as const,
    items: [
      { label: 'In-app offer play', icon: 'gift' as const, onClick: () => createV10GrowthPlay('expansion', 'in_app_offer') },
      { label: 'Pricing table play', icon: 'table' as const, onClick: () => createV10GrowthPlay('expansion', 'pricing_table') },
      { label: 'Empty play', icon: 'workflow' as const, onClick: () => createV10GrowthPlay('expansion') },
    ],
  },
  { label: 'Retention play', icon: 'repeat' as const, onClick: createV10RetentionPlay },
  {
    label: 'In-app offer',
    icon: 'gift' as const,
    items: [
      { label: 'For Acquisition', icon: 'rocket' as const, onClick: () => createV10Experience('in_app_offer', 'acquisition') },
      { label: 'For Expansion', icon: 'arrow-up-right' as const, onClick: () => createV10Experience('in_app_offer', 'expansion') },
    ],
  },
  {
    label: 'Pricing table',
    icon: 'table' as const,
    items: [
      { label: 'For Acquisition', icon: 'rocket' as const, onClick: () => createV10Experience('pricing_table', 'acquisition') },
      { label: 'For Expansion', icon: 'arrow-up-right' as const, onClick: () => createV10Experience('pricing_table', 'expansion') },
    ],
  },
  { label: 'Cancel page', icon: 'file-text' as const, onClick: createV10CancelPage },
  { label: 'Audience', icon: 'users' as const, onClick: createV10Audience },
]

function inBuild(route: NavLeafId) {
  return VIEWS.some((view) => view.route === route)
}

/** Destinations stay put. What you open is grouped underneath, and the rail can fold to icons. */
export function V10Nav() {
  const route = useGrowthShell((s) => s.route)
  const reportsOpen = useGrowthShell((s) => s.openGroups.reports)
  const toggleGroup = useGrowthShell((s) => s.toggleGroup)
  const openGroup = useGrowthShell((s) => s.openGroup)
  const sidebarOpen = useWorkspaceUi((state) => state.sidebarOpen)
  const setSidebarOpen = useWorkspaceUi((state) => state.setSidebarOpen)
  const reportsCurrent = route.startsWith('reports')
  const reportsShown = reportsOpen && reportsCurrent && sidebarOpen
  const folded = !sidebarOpen
  const buildRoute = inBuild(route) ? route : 'work.plays'
  const tree = useV10((state) => state.tree)
  const treeAt = useV10((state) => state.treeAt)
  const treeKey = tree ? `${tree.kind}:${tree.source}:${tree.id}` : ''
  const [recentOpen, setRecentOpen] = useState(true)

  useEffect(() => {
    if (reportsCurrent) openGroup('reports')
  }, [openGroup, reportsCurrent])

  useEffect(() => {
    setRecentOpen(treeKey === '')
  }, [treeKey, treeAt])

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className={`flex h-[52px] flex-none items-center border-b border-slate-200 ${folded ? 'justify-center' : 'gap-[4px] px-[14px]'}`}>
        {!folded && <RowMenu label="New" icon="plus" align="left" width={220} text="New" items={NEW_ITEMS} className="mr-auto" />}
        <HeaderButton label={folded ? 'Open side panel' : 'Close side panel'} icon="panel-left" onClick={() => setSidebarOpen(folded)} />
      </div>
      {folded ? (
        <div className="flex min-h-0 flex-1 flex-col gap-[2px] px-[8px] py-[10px]">
          <div className="flex h-10 items-center justify-center">
            <RowMenu label="New" icon="plus" align="beside" width={220} items={NEW_ITEMS} />
          </div>
          <SettingRow icon="home" label="Home" folded active={route === 'home'} onClick={() => visit('home')} />
          <SettingRow icon="layers" label="Build" folded active={inBuild(route)} onClick={() => visit(buildRoute)} />
          <SettingRow icon="repeat" label="Revenue optimization" folded active={route === 'renewal'} onClick={() => visit('renewal')} />
          <SettingRow icon="bar-chart" label="Reports" folded active={reportsCurrent} onClick={() => visit('reports.cancels')} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <nav className="flex flex-col gap-[2px] px-[8px] py-[12px]" aria-label="Growth">
            {DESTINATIONS.filter((item) => item.id === 'home').map((item) => (
              <NavDestination key={item.id} item={item} route={route} />
            ))}
            <NavDestination
              item={{
                label: 'Build',
                route: buildRoute,
                match: inBuild,
              }}
              route={route}
            />
            {DESTINATIONS.filter((item) => item.id === 'renewal').map((item) => (
              <NavDestination key={item.id} item={item} route={route} />
            ))}
            <button
              type="button"
              aria-expanded={reportsShown}
              onClick={() => {
                if (reportsCurrent) toggleGroup('reports')
                else visit('reports.cancels')
              }}
              className={`${navItem(false, reportsCurrent)} flex h-10 w-full items-center gap-[8px] px-[10px] text-left text-[13px]`}
            >
              <span className="min-w-0 flex-1 truncate">Reports</span>
              <SIcon name="chevron-down" size={16} className={`slg-nav-icon flex-none transition-transform ${reportsShown ? 'rotate-180' : ''}`} />
            </button>
            {reportsShown && (
              <div className="slg-nav-tree mb-[2px] ml-[19px] flex flex-col gap-[2px] border-l pl-[4px]">
                {childrenOf('reports').map((leaf) => (
                  <button
                    key={leaf.id}
                    type="button"
                    aria-current={route === leaf.id ? 'page' : undefined}
                    onClick={() => visit(leaf.id)}
                    className={`${navItem(route === leaf.id)} flex h-8 w-full items-center px-[10px] text-left text-[13px]`}
                  >
                    <span className="min-w-0 flex-1 truncate">{leaf.label}</span>
                  </button>
                ))}
              </div>
            )}
          </nav>
          {tree && (
            <>
              <div className="h-px flex-none bg-slate-300" role="separator" />
              <div className="bg-slate-100 px-[8px] py-[12px]">
                <OpenTree tree={tree} />
              </div>
              <div className="h-px flex-none bg-slate-300" role="separator" />
            </>
          )}
          <div className="px-[8px] py-[8px]">
            <button
              type="button"
              aria-expanded={recentOpen}
              onClick={() => setRecentOpen((value) => !value)}
              className="flex h-9 w-full items-center gap-[6px] rounded-md px-[10px] text-left hover:bg-slate-100"
            >
              <SIcon name="chevron-right" size={13} className={`flex-none text-slate-400 transition-transform ${recentOpen ? 'rotate-90' : ''}`} />
              <span className="slg-pane-head">Recent</span>
            </button>
            {recentOpen && (
              <div className="pt-[8px]">
                <RecentGroups focus={tree} />
              </div>
            )}
          </div>
          <div className="h-px flex-none bg-slate-300" role="separator" />
        </div>
      )}
    </aside>
  )
}

function NavDestination({
  item,
  route,
}: {
  item: { label: string; route: NavLeafId; match: (route: NavLeafId) => boolean }
  route: NavLeafId
}) {
  return (
    <button
      type="button"
      aria-current={item.match(route) ? 'page' : undefined}
      onClick={() => visit(item.route)}
      className={`${navItem(item.match(route))} flex h-10 w-full items-center px-[10px] text-left text-[13px]`}
    >
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="flex h-7 items-end px-[10px] pb-[4px]">
        <span className="slg-pane-head truncate">{title}</span>
      </div>
      {children}
    </div>
  )
}

function sameRef(a: V10Ref, b: V10Ref) {
  return a.kind === b.kind && a.source === b.source && a.id === b.id
}

function experienceTitle(item: V10Ref, threads: ExperienceThread[], growth: GrowthExperience[]): string {
  if (item.source === 'retention') {
    const thread = threads.find((entry) => entry.id === item.id)
    const shell = thread ? shellOf(thread) : 'modal'
    return SHELL_KIND[shell].plural
  }
  const found = growth.find((entry) => entry.id === item.id)
  const label = found ? TYPE_LABEL[found.type].toLowerCase() : 'experience'
  const plural = label.endsWith('s') ? label : `${label}s`
  return plural.charAt(0).toUpperCase() + plural.slice(1)
}

/** The play, experience, or audience last clicked, with its tree open. */
function OpenTree({ tree }: { tree: V10Ref | null }) {
  const treeAt = useV10((state) => state.treeAt)
  const growthPlays = useGrowthPlays((state) => state.plays)
  const retentionPlays = usePlays((state) => state.plays)
  const objective = tree?.objective
  const growthPlayId = useGrowthUi((state) => (objective ? state.views[objective].playId : null))
  const retentionPlayId = useWorkspaceUi((state) => state.playId)
  const [openKey, setOpenKey] = useState<string | null>(null)
  useEffect(() => {
    setOpenKey(null)
  }, [treeAt])
  if (!tree) return null
  const context = contextPlay(tree, growthPlays, retentionPlays, growthPlayId, retentionPlayId)
  const shown = tree.kind === 'audience' ? null : context
  const key = shown ? `${shown.source}:${shown.id}` : `${tree.kind}:${tree.source}:${tree.id}`
  if (tree.kind === 'audience') return <AudienceTree id={tree.id} />
  if (shown) return <RecentPlay item={shown} open={openKey !== key} onToggle={() => setOpenKey((current) => (current === key ? null : key))} />
  return <RecentExperience item={tree} pinned={false} />
}

/** Pins and what you opened, split the way the objective pane splits them. */
function RecentGroups({ focus }: { focus: V10Ref | null }) {
  const pins = useV10((state) => state.pins)
  const recent = useV10((state) => state.recent)
  const open = useV10((state) => state.open)
  const rows = useV10Rows()
  const growthPlays = useGrowthPlays((state) => state.plays)
  const retentionPlays = usePlays((state) => state.plays)
  const threads = useWorkspace((state) => state.threads)
  const growthExperiences = useGrowthExperiences((state) => state.items)
  const objective = focus?.objective
  const growthPlayId = useGrowthUi((state) => (objective ? state.views[objective].playId : null))
  const retentionPlayId = useWorkspaceUi((state) => state.playId)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const context = focus ? contextPlay(focus, growthPlays, retentionPlays, growthPlayId, retentionPlayId) : null
  const skip = (item: V10Ref) => Boolean((focus && sameRef(item, focus)) || (context && item.kind === 'play' && sameRef(item, context)))

  const items: V10Ref[] = []
  const push = (ref: V10Ref) => {
    if (!items.some((item) => sameRef(item, ref))) items.push(ref)
  }
  for (const pin of pins) push(pin)
  if (open?.kind === 'play') push(open)
  if (context) push(context)
  for (const item of recent) push(item)

  const plays = items.filter((item) => item.kind === 'play' && !skip(item))
  const audiences = items.filter((item) => item.kind === 'audience' && !skip(item))
  const shownExperience = (id: string) =>
    open?.kind === 'experience' &&
    open.id === id &&
    plays.some((play) => {
      if (!expanded.has(`${play.source}:${play.id}`)) return false
      const tree = play.source === 'growth' ? growthPlays.find((item) => item.id === play.id) : retentionPlays.find((item) => item.id === play.id)
      return tree?.variants.some((variant) => variant.experienceId === id)
    })
  const experienceGroups: { title: string; items: V10Ref[] }[] = []
  for (const item of items.filter((entry) => entry.kind === 'experience' && !skip(entry) && !shownExperience(entry.id))) {
    const title = experienceTitle(item, threads, growthExperiences)
    const group = experienceGroups.find((entry) => entry.title === title)
    if (group) group.items.push(item)
    else experienceGroups.push({ title, items: [item] })
  }
  const pinned = (item: V10Ref) => pins.some((pin) => sameRef(pin, item))

  if (plays.length === 0 && experienceGroups.length === 0 && audiences.length === 0) {
    return <p className="px-[10px] text-[12px] text-slate-400">Plays, experiences and audiences you open show up here.</p>
  }

  return (
    <div className="flex flex-col gap-[16px]">
      {plays.length > 0 && (
        <Section title="Plays">
          {plays.map((play) => {
            const key = `${play.source}:${play.id}`
            return <RecentPlay key={key} item={play} open={expanded.has(key)} onToggle={() => setExpanded((current) => {
              const next = new Set(current)
              if (next.has(key)) next.delete(key)
              else next.add(key)
              return next
            })} />
          })}
        </Section>
      )}
      {experienceGroups.map((group) => (
        <Section key={group.title} title={group.title}>
          {group.items.map((item) => (
            <RecentExperience key={`${item.source}:${item.id}`} item={item} pinned={pinned(item)} />
          ))}
        </Section>
      ))}
      {audiences.length > 0 && (
        <Section title="Audiences">
          {audiences.map((item) => (
            <NavButton
              key={item.id}
              label={titleOf(rows, item)}
              pinned={pinned(item)}
              marker
              current={open?.kind === 'audience' && open.id === item.id}
              onClick={() => openRef(item)}
            />
          ))}
        </Section>
      )}
    </div>
  )
}

function RecentPlay({ item, open, onToggle }: { item: V10Ref; open: boolean; onToggle: () => void }) {
  const growth = useGrowthPlays((state) => state.plays.find((play) => play.id === item.id))
  const retention = usePlays((state) => state.plays.find((play) => play.id === item.id))
  if (item.source === 'growth') return growth ? <GrowthPlayRow play={growth} open={open} onToggle={onToggle} /> : null
  return retention ? <PlayRow play={retention} open={open} onToggle={onToggle} /> : null
}

function RecentExperience({ item, pinned }: { item: V10Ref; pinned: boolean }) {
  const current = useV10((state) => state.open?.kind === 'experience' && state.open.id === item.id && state.open.source === item.source)
  const growth = useGrowthExperiences((state) => state.items.find((entry) => entry.id === item.id))
  const thread = useWorkspace((state) => state.threads.find((entry) => entry.id === item.id))
  const row = item.source === 'growth' ? (growth ? <GrowthLooseRow x={growth} current={current} /> : null) : thread ? <LooseRow thread={thread} current={current} /> : null
  if (!row) return null
  return (
    <div className="relative">
      {pinned && <SIcon name="pin" size={13} className="slg-nav-icon absolute left-[10px] top-[9px]" />}
      {row}
    </div>
  )
}

function contextPlay(open: V10Ref, growth: GrowthPlay[], retention: CancelPlay[], growthPlayId: string | null, retentionPlayId: string | null): V10Ref | null {
  if (open.kind === 'play') return open
  if (open.kind !== 'experience') return null
  const holds = (play: { id: string; variants: { experienceId: string }[] }) => play.variants.some((variant) => variant.experienceId === open.id)
  if (open.source === 'growth') {
    const preferred = growth.find((play) => play.id === growthPlayId && holds(play)) ?? growth.find(holds)
    return preferred ? { kind: 'play', source: 'growth', id: preferred.id, objective: preferred.objective } : null
  }
  const preferred = retention.find((play) => play.id === retentionPlayId && holds(play)) ?? retention.find(holds)
  return preferred ? { kind: 'play', source: 'retention', id: preferred.id } : null
}

function AudienceTree({ id }: { id: string }) {
  const audience = useAudiences((state) => state.items.find((item) => item.id === id))
  const growth = useGrowthPlays((state) => state.plays)
  const retention = usePlays((state) => state.plays)
  if (!audience) return null
  const used = (item: { savedAudienceId?: string | null; name?: string } | undefined) => item?.savedAudienceId === id || item?.name === audience.name
  const growthPlays = growth.filter((play) => used(play.audience) || play.subAudiences.some((sub) => used(sub.audience)))
  const retentionPlays = retention.filter((play) => used(play.audience) || play.subAudiences.some((sub) => used(sub.audience)))
  return (
    <Section title={audience.name}>
      <NavButton label="Rules" current onClick={() => undefined} />
      {growthPlays.map((play) => (
        <NavButton key={play.id} label={play.name} onClick={() => openRef({ kind: 'play', source: 'growth', id: play.id, objective: play.objective })} />
      ))}
      {retentionPlays.map((play) => (
        <NavButton key={play.id} label={play.name} onClick={() => openRef({ kind: 'play', source: 'retention', id: play.id })} />
      ))}
    </Section>
  )
}

function NavButton({ label, onClick, pinned, marker, current }: { label: string; onClick: () => void; pinned?: boolean; marker?: boolean; current?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-current={current ? 'page' : undefined} className={`${navItem(current)} flex h-8 w-full items-center gap-[8px] px-[10px] text-left text-[13px]`}>
      {marker && (
        <span className="flex w-[14px] flex-none items-center justify-center">
          {pinned && <SIcon name="pin" size={13} className="slg-nav-icon" />}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

