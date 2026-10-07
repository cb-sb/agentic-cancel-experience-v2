import { useEffect, useState, type ReactNode } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { GrowthLooseRow, GrowthPlayRow } from '../concierge/objective/GrowthPane'
import { useGrowthUi } from '../concierge/objective/useGrowthUi'
import { useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { useGrowthPlays, type GrowthPlay } from '../concierge/useGrowthPlays'
import { LooseRow, PlayRow } from '../layout/PlaysTree'
import { navItem } from '../layout/navStyle'
import { RowMenu } from '../plays/ui'
import type { CancelPlay } from '../plays/types'
import { usePlays } from '../plays/usePlays'
import { childrenOf, type NavLeafId } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { titleOf, useV10Rows } from './rows'
import { useAudiences } from './useAudiences'
import {
  createV10Audience,
  createV10CancelPage,
  createV10Experience,
  createV10Play,
  createV10RetentionPlay,
  openRef,
  useV10,
  type V10Ref,
} from './useV10'

const DESTINATIONS: { id: string; label: string; route: NavLeafId; match: (route: NavLeafId) => boolean }[] = [
  { id: 'home', label: 'Home', route: 'home', match: (route) => route === 'home' },
  { id: 'renewal', label: 'Renewal', route: 'renewal', match: (route) => route === 'renewal' },
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

/** Destinations, pins, the open play, and recents in one rail. */
export function V10Nav() {
  const route = useGrowthShell((s) => s.route)
  const reportsOpen = useGrowthShell((s) => s.openGroups.reports)
  const toggleGroup = useGrowthShell((s) => s.toggleGroup)
  const openGroup = useGrowthShell((s) => s.openGroup)
  const reportsCurrent = route.startsWith('reports')
  const reportsShown = reportsOpen && reportsCurrent
  const pins = useV10((state) => state.pins)
  const recent = useV10((state) => state.recent)
  const rows = useV10Rows()

  useEffect(() => {
    if (reportsCurrent) openGroup('reports')
  }, [openGroup, reportsCurrent])

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-[52px] flex-none items-center border-b border-slate-200 px-[14px]">
        <RowMenu
          label="New"
          icon="plus"
          align="left"
          width={220}
          text="New"
          items={[
            { label: 'Play', icon: 'workflow', onClick: createV10Play },
            { label: 'Retention play', icon: 'repeat', onClick: createV10RetentionPlay },
            { label: 'In-app offer', icon: 'gift', onClick: () => createV10Experience('in_app_offer') },
            { label: 'Pricing table', icon: 'table', onClick: () => createV10Experience('pricing_table') },
            { label: 'Cancel page', icon: 'file-text', onClick: createV10CancelPage },
            { label: 'Audience', icon: 'users', onClick: createV10Audience },
          ]}
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[8px] py-[12px]">
        <nav className="flex flex-col gap-[2px]" aria-label="Growth">
          {DESTINATIONS.filter((item) => item.id === 'home').map((item) => (
            <NavDestination key={item.id} item={item} route={route} />
          ))}
          <NavDestination
            item={{
              label: VIEWS.find((view) => view.route === route)?.label ?? 'Plays',
              route: VIEWS.find((view) => view.route === route)?.route ?? 'work.plays',
              match: (current) => VIEWS.some((view) => view.route === current),
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
        <OpenTree />
        <div className="flex flex-col gap-[2px]">
          {pins.length === 0 && recent.length === 0 && (
            <p className="px-[10px] text-[12px] text-slate-400">Plays, experiences and audiences you open show up here.</p>
          )}
          {pins.map((pin) => (
            <NavButton key={`pin:${pin.kind}:${pin.id}`} label={titleOf(rows, pin)} pinned marker onClick={() => openRef(pin)} />
          ))}
          {recent
            .filter((item) => !pins.some((pin) => pin.kind === item.kind && pin.id === item.id))
            .map((item) => (
              <NavButton key={`recent:${item.kind}:${item.id}`} label={titleOf(rows, item)} marker onClick={() => openRef(item)} />
            ))}
        </div>
      </div>
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
    <div>
      <div className="flex h-7 items-end px-[10px] pb-[4px]">
        <span className="truncate text-[12px] font-medium text-slate-500">{title}</span>
      </div>
      <div className="flex flex-col gap-[2px]">{children}</div>
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

/** The open play's full tree, the play an experience sits in, or the audience's own rules. */
function OpenTree() {
  const open = useV10((state) => state.open)
  const growth = useGrowthPlays((state) => state.plays)
  const retention = usePlays((state) => state.plays)
  const objective = open?.objective
  const growthPlayId = useGrowthUi((state) => (objective ? state.views[objective].playId : null))
  const retentionPlayId = useWorkspaceUi((state) => state.playId)
  if (!open) return null
  if (open.kind === 'audience') return <AudienceTree id={open.id} />
  const play = contextPlay(open, growth, retention, growthPlayId, retentionPlayId)
  if (play?.source === 'growth') return <GrowthBranch key={play.id} id={play.id} />
  if (play) return <RetentionBranch key={play.id} id={play.id} />
  if (open.kind === 'experience' && open.source === 'retention') return <LooseRetention id={open.id} />
  if (open.kind === 'experience' && open.source === 'growth') return <LooseGrowth id={open.id} />
  return null
}

function GrowthBranch({ id }: { id: string }) {
  const play = useGrowthPlays((state) => state.plays.find((item) => item.id === id))
  const [open, setOpen] = useState(true)
  if (!play) return null
  return <GrowthPlayRow play={play} open={open} onToggle={() => setOpen((value) => !value)} />
}

function RetentionBranch({ id }: { id: string }) {
  const play = usePlays((state) => state.plays.find((item) => item.id === id))
  const [open, setOpen] = useState(true)
  if (!play) return null
  return <PlayRow play={play} open={open} onToggle={() => setOpen((value) => !value)} />
}

function LooseGrowth({ id }: { id: string }) {
  const experience = useGrowthExperiences((state) => state.items.find((item) => item.id === id))
  if (!experience) return null
  return <GrowthLooseRow x={experience} current />
}

function LooseRetention({ id }: { id: string }) {
  const thread = useWorkspace((state) => state.threads.find((item) => item.id === id))
  if (!thread) return null
  return <LooseRow thread={thread} current />
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

