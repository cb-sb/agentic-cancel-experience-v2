import { useEffect, type ReactNode } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { setGrowthView } from '../concierge/objective/useGrowthUi'
import { useGrowthExperiences } from '../concierge/useGrowthExperiences'
import { useGrowthPlays } from '../concierge/useGrowthPlays'
import { navItem } from '../layout/navStyle'
import { openConfigure } from '../plays/navigate'
import { audienceText, fallbackVariant, pagesIn } from '../plays/resolve'
import { RowMenu } from '../plays/ui'
import { audienceUnset } from '../plays/playOps'
import { usePlays } from '../plays/usePlays'
import { childrenOf, type NavLeafId } from '../shell/nav'
import { useGrowthShell } from '../shell/useGrowthShell'
import { useWorkspace } from '../workspace/useWorkspace'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import { titleOf, useV10Rows } from './rows'
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
  const open = useV10((state) => state.open)
  const rows = useV10Rows()
  const play = open?.kind === 'play' ? open : null

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
        {play && <PlayNest refItem={play} />}
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

function NavButton({ label, onClick, pinned, marker }: { label: string; onClick: () => void; pinned?: boolean; marker?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`${navItem()} flex h-8 w-full items-center gap-[8px] px-[10px] text-left text-[13px]`}>
      {marker && (
        <span className="flex w-[14px] flex-none items-center justify-center">
          {pinned && <SIcon name="pin" size={13} className="slg-nav-icon" />}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

function PlayNest({ refItem }: { refItem: V10Ref }) {
  const growth = useGrowthPlays((state) => state.plays.find((play) => play.id === refItem.id))
  const retention = usePlays((state) => state.plays.find((play) => play.id === refItem.id))
  const play = refItem.source === 'growth' ? growth : retention
  if (!play) return null
  const openExperienceRow = (id: string, source: V10Ref['source'], objective?: V10Ref['objective']) =>
    openRef({ kind: 'experience', source, id, objective })
  return (
    <Section title={play.name}>
      <NavButton label={play.audience.targetAll ? 'All subscribers' : audienceUnset(play.audience) ? 'No audience yet' : audienceText(play.audience)} onClick={() => focusPlay(refItem, 1)} />
      {play.splitBy === 'segments' ? (
        <>
          {play.subAudiences.map((sub, index) => (
            <div key={sub.id} className="ml-[12px]">
              <NavButton label={audienceUnset(sub.audience) ? `Sub-audience ${index + 1}` : audienceText(sub.audience)} onClick={() => focusPlay(refItem, 2)} />
              {pagesIn(play, sub.id).map((variant) => (
                <ExperienceLine key={variant.id} experienceId={variant.experienceId} source={refItem.source} objective={refItem.objective} onOpen={openExperienceRow} />
              ))}
            </div>
          ))}
          <div className="ml-[12px]">
            <NavButton label="Fallback" onClick={() => focusPlay(refItem, 2)} />
            {fallbackVariant(play) && (
              <ExperienceLine experienceId={fallbackVariant(play)!.experienceId} source={refItem.source} objective={refItem.objective} onOpen={openExperienceRow} />
            )}
          </div>
        </>
      ) : (
        play.variants.map((variant) => (
          <ExperienceLine key={variant.id} experienceId={variant.experienceId} source={refItem.source} objective={refItem.objective} onOpen={openExperienceRow} />
        ))
      )}
    </Section>
  )
}

function focusPlay(refItem: V10Ref, step: 1 | 2) {
  useWorkspaceUi.getState().setConfigureStep(refItem.id, step)
  if (refItem.source === 'growth' && refItem.objective) setGrowthView(refItem.objective, { page: 'play', playId: refItem.id, playTab: 'configure' })
  else openConfigure(refItem.id, step)
  openRef(refItem)
}

function ExperienceLine({
  experienceId,
  source,
  objective,
  onOpen,
}: {
  experienceId: string
  source: V10Ref['source']
  objective?: V10Ref['objective']
  onOpen: (id: string, source: V10Ref['source'], objective?: V10Ref['objective']) => void
}) {
  const growthName = useGrowthExperiences((state) => state.items.find((item) => item.id === experienceId)?.name)
  const threadName = useWorkspace((state) => state.threads.find((thread) => thread.id === experienceId)?.title)
  const name = source === 'growth' ? growthName : threadName
  if (!name) return null
  return (
    <button type="button" onClick={() => onOpen(experienceId, source, objective)} className={`${navItem()} ml-[16px] flex h-8 w-[calc(100%-16px)] items-center px-[10px] text-left text-[13px]`}>
      <span className="truncate">{name}</span>
    </button>
  )
}
