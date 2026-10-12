import { SIcon, type SIconName } from '@chargebee/sting-react'
import { MVP, V8, V9 } from '../layout/layoutMode'
import { navItem } from '../layout/navStyle'
import { BETA_NAV, CANCEL_ROUTE, CLASSIC_HOME, NAV, type NavGroup, type NavLeaf, type NavLeafId } from './nav'
import { useGrowthShell } from './useGrowthShell'

function NavIcon({ name, className }: { name: SIconName; className?: string }) {
  return <SIcon name={name} size={16} className={className} />
}

function LeafButton({
  leaf,
  active,
  nested,
  compact,
}: {
  leaf: NavLeaf
  active: boolean
  nested?: boolean
  compact?: boolean
}) {
  const go = useGrowthShell((s) => s.go)

  if (V9 || MVP) {
    return (
      <button
        type="button"
        title={leaf.label}
        aria-current={active ? 'page' : undefined}
        onClick={() => go(leaf.id)}
        className={`${navItem(active)} flex h-10 w-full items-center text-left ${compact ? 'justify-center' : `gap-[10px] px-[10px] ${nested ? 'pl-[14px]' : ''}`}`}
      >
        <SIcon name={leaf.icon} size={18} className="slg-nav-icon flex-none" />
        {!compact && <span className="slg-nav-label min-w-0 flex-1 truncate">{leaf.label}</span>}
      </button>
    )
  }

  return (
    <button
      type="button"
      title={compact ? leaf.label : undefined}
      onClick={() => go(leaf.id)}
      className={`flex w-full items-center rounded-md text-left text-[13px] transition-colors ${
        compact
          ? `h-9 justify-center ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`
          : `gap-2.5 px-2.5 py-1.5 ${nested ? 'pl-8' : ''} ${
              active
                ? 'bg-slate-100 font-medium text-slate-900'
                : 'font-normal text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`
      }`}
    >
      <NavIcon name={leaf.icon} className={active ? 'text-slate-800' : 'text-slate-400'} />
      {!compact && <span className="truncate">{leaf.label}</span>}
    </button>
  )
}

function GroupBlock({ group, route, compact }: { group: NavGroup; route: NavLeafId; compact?: boolean }) {
  const open = useGrowthShell((s) => s.openGroups[group.id])
  const toggleGroup = useGrowthShell((s) => s.toggleGroup)
  const openGroup = useGrowthShell((s) => s.openGroup)
  const setNavOpen = useGrowthShell((s) => s.setNavOpen)
  const childActive = group.children.some((c) => c.id === route)

  if (compact && V9) {
    return (
      <button
        type="button"
        title={group.label}
        aria-current={childActive ? 'page' : undefined}
        onClick={() => {
          setNavOpen(true)
          openGroup(group.id)
        }}
        className={`${navItem(childActive)} flex h-10 w-full items-center justify-center`}
      >
        <SIcon name={group.icon} size={18} className="slg-nav-icon" />
      </button>
    )
  }

  if (V9 || MVP) {
    return (
      <div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggleGroup(group.id)}
          className={`${navItem(false, childActive)} flex h-10 w-full items-center gap-[10px] px-[10px] text-left`}
        >
          <SIcon name={group.icon} size={18} className="slg-nav-icon flex-none" />
          <span className="slg-nav-label min-w-0 flex-1 truncate">{group.label}</span>
          <SIcon name="chevron-down" size={16} className={`slg-nav-icon flex-none transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="slg-nav-tree mb-[2px] ml-[19px] mt-[2px] flex flex-col gap-[2px] border-l pl-[4px]">
            {group.children.map((leaf) => (
              <LeafButton key={leaf.id} leaf={leaf} active={leaf.id === route} nested />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (compact) {
    return (
      <button
        type="button"
        title={group.label}
        onClick={() => {
          setNavOpen(true)
          openGroup(group.id)
        }}
        className={`flex h-9 w-full items-center justify-center rounded-md ${
          childActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        }`}
      >
        <NavIcon name={group.icon} />
      </button>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => toggleGroup(group.id)}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
      >
        <NavIcon name={group.icon} className="text-slate-500" />
        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
        <SIcon
          name={open ? 'chevron-down' : 'chevron-right'}
          size={14}
          className="text-slate-400"
        />
      </button>
      {open && (
        <div className="mt-0.5">
          {group.children.map((leaf) => (
            <LeafButton key={leaf.id} leaf={leaf} active={leaf.id === route} nested />
          ))}
        </div>
      )}
    </div>
  )
}

function BetaButton({ compact }: { compact: boolean }) {
  const beta = useGrowthShell((s) => s.beta)
  const go = useGrowthShell((s) => s.go)
  const label = beta ? 'Exit Retention beta' : 'Retention beta'

  if (V9 || MVP) {
    return (
      <button
        type="button"
        title={label}
        onClick={() => go(beta ? CLASSIC_HOME : CANCEL_ROUTE)}
        className={`${navItem()} flex h-10 w-full items-center ${compact ? 'justify-center' : 'gap-[10px] px-[10px]'}`}
      >
        <SIcon name={beta ? 'arrow-left' : 'flask-conical'} size={18} className="slg-nav-icon flex-none" />
        {!compact && <span className="slg-nav-label min-w-0 flex-1 truncate text-left">{label}</span>}
      </button>
    )
  }

  return (
    <button
      type="button"
      title={label}
      onClick={() => go(beta ? CLASSIC_HOME : CANCEL_ROUTE)}
      className={`mb-0.5 flex w-full items-center rounded-md text-[13px] font-medium transition-colors ${
        beta ? 'text-slate-600 hover:bg-slate-50' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
      } ${compact ? 'h-9 justify-center' : 'gap-2.5 px-2.5 py-1.5'}`}
    >
      <NavIcon name={beta ? 'arrow-left' : 'flask-conical'} className={beta ? 'text-slate-400' : 'text-violet-600'} />
      {!compact && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
    </button>
  )
}

/**
 * Chargebee Growth left rail. Folded it is a 56px icon column — click the
 * Growth mark (or any section) to open labels. Open, it matches the live app.
 */
export function GrowthNav() {
  const route = useGrowthShell((s) => s.route)
  const navOpen = useGrowthShell((s) => s.navOpen)
  const toggleNav = useGrowthShell((s) => s.toggleNav)
  const beta = useGrowthShell((s) => s.beta)

  if (V9 || MVP) {
    return (
      <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
        <div className={`flex h-[60px] flex-none items-center gap-[8px] border-b border-slate-200 ${navOpen ? 'px-[10px]' : 'justify-center'}`}>
          <button
            type="button"
            onClick={toggleNav}
            title={navOpen ? 'Collapse navigation' : 'Open Growth navigation'}
            aria-label={navOpen ? 'Collapse navigation' : 'Open Growth navigation'}
            className="slg-nav-logo flex h-8 w-8 flex-none items-center justify-center bg-[var(--slg-orange-500)] text-[13px] font-bold text-white hover:bg-[var(--slg-orange-700)]"
          >
            G
          </button>
          {navOpen && (
            <button type="button" title="Switch site" className={`${navItem()} flex h-9 min-w-0 flex-1 items-center gap-[8px] px-[6px] text-left`}>
              <span className="flex flex-none items-center gap-[4px] bg-[var(--slg-color-bg-success-subtle)] px-[6px] py-[2px] text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--slg-green-700)]">
                <span className="h-[6px] w-[6px] rounded-full bg-[var(--slg-green-500)]" />
                Live
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">cbgrowthdemo.chargebee.com</span>
              <SIcon name="chevrons-up-down" size={16} className="slg-nav-icon flex-none" />
            </button>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-[8px] py-[10px]">
          <div className="flex flex-col gap-[2px]">
            {(beta ? BETA_NAV : NAV).map((entry) =>
              entry.kind === 'group' ? (
                <GroupBlock key={entry.group.id} group={entry.group} route={route} compact={!navOpen} />
              ) : (
                <LeafButton key={entry.leaf.id} leaf={entry.leaf} active={entry.leaf.id === route} compact={!navOpen} />
              ),
            )}
          </div>
        </nav>

        <div className="flex flex-none flex-col gap-[2px] border-t border-slate-200 px-[8px] py-[10px]">
          {!MVP && <BetaButton compact={!navOpen} />}
          <button type="button" title="Need help?" className={`${navItem()} flex h-10 w-full items-center ${navOpen ? 'gap-[10px] px-[10px]' : 'justify-center'}`}>
            <SIcon name="circle-help" size={18} className="slg-nav-icon flex-none" />
            {navOpen && <span className="slg-nav-label min-w-0 flex-1 truncate text-left">Need help?</span>}
          </button>
          <button type="button" title="John" className={`${navItem()} flex h-10 w-full items-center ${navOpen ? 'gap-[10px] px-[10px]' : 'justify-center'}`}>
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[var(--slg-neutral-900)] text-[10px] font-semibold text-white">
              J
            </span>
            {navOpen && <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium">John</span>}
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className={`flex-none ${navOpen ? 'p-2' : 'p-1.5'}`}>
        <button
          type="button"
          onClick={toggleNav}
          title={navOpen ? 'Collapse navigation' : 'Open Growth navigation'}
          className={`flex w-full items-center rounded-lg bg-[#0d1f1e] text-white transition-colors hover:bg-[#16302e] ${
            navOpen ? 'h-10 gap-2 px-2.5' : 'h-10 justify-center'
          }`}
        >
          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-white/10 text-[11px] font-bold">
            G
          </span>
          {navOpen && (
            <>
              <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">Growth</span>
              <SIcon name="panel-left" size={14} className="text-white/70" />
            </>
          )}
        </button>
      </div>

      {navOpen && (
        <div className="flex-none px-2 pb-2">
          <button
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-left text-[12px] text-slate-600"
            title="Site"
          >
            <span className="min-w-0 flex-1 truncate leading-tight">
              cbgrowthdemo_singlebr…
              <span className="mt-0.5 block truncate text-[11px] font-medium text-emerald-700">
                Growthdemo-chargeb
              </span>
            </span>
            <SIcon name="chevron-down" size={14} className="text-slate-400" />
          </button>
        </div>
      )}

      <nav className={`min-h-0 flex-1 overflow-y-auto ${navOpen ? 'px-2' : 'px-1.5'} py-1`}>
        <div className="space-y-0.5">
          {(beta ? BETA_NAV : NAV).map((entry) =>
            entry.kind === 'group' ? (
              <GroupBlock key={entry.group.id} group={entry.group} route={route} compact={!navOpen} />
            ) : (
              <LeafButton
                key={entry.leaf.id}
                leaf={entry.leaf}
                active={entry.leaf.id === route}
                compact={!navOpen}
              />
            ),
          )}
        </div>
      </nav>

      <div className={`flex-none border-t border-slate-100 ${navOpen ? 'p-2' : 'p-1.5'}`}>
        {V8 && <BetaButton compact={!navOpen} />}
        <button
          type="button"
          title="Need Help?"
          className={`flex w-full items-center rounded-md text-[13px] text-slate-600 hover:bg-slate-50 ${
            navOpen ? 'gap-2.5 px-2.5 py-1.5' : 'h-9 justify-center'
          }`}
        >
          <NavIcon name="circle-help" className="text-slate-400" />
          {navOpen && (
            <>
              <span className="min-w-0 flex-1 truncate text-left">Need Help?</span>
              <SIcon name="ellipsis" size={14} className="text-slate-400" />
            </>
          )}
        </button>
        <button
          type="button"
          title="John"
          className={`mt-0.5 flex w-full items-center rounded-md text-[13px] text-slate-700 hover:bg-slate-50 ${
            navOpen ? 'gap-2.5 px-2.5 py-1.5' : 'h-9 justify-center'
          }`}
        >
          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
            J
          </span>
          {navOpen && (
            <>
              <span className="min-w-0 flex-1 truncate text-left">John</span>
              <SIcon name="ellipsis" size={14} className="text-slate-400" />
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
