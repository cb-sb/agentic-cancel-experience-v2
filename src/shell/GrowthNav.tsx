import { SIcon, type SIconName } from '@chargebee/sting-react'
import { NAV, type NavGroup, type NavLeaf, type NavLeafId } from './nav'
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

/**
 * Chargebee Growth left rail. Folded it is a 56px icon column — click the
 * Growth mark (or any section) to open labels. Open, it matches the live app.
 */
export function GrowthNav() {
  const route = useGrowthShell((s) => s.route)
  const navOpen = useGrowthShell((s) => s.navOpen)
  const toggleNav = useGrowthShell((s) => s.toggleNav)

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
          {NAV.map((entry) =>
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
