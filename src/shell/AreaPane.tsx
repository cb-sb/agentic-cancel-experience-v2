import { SIcon } from '@chargebee/sting-react'
import { navItem } from '../layout/navStyle'
import { childrenOf, type NavGroupId, type NavLeafId } from './nav'
import { useGrowthShell } from './useGrowthShell'

const TITLES: Partial<Record<NavGroupId, string>> = {
  people: 'People',
  reports: 'Reports',
}

/** The left navigation of a Growth tab whose children used to live in the global rail. */
export function AreaPane({ group, route }: { group: 'people' | 'reports'; route: NavLeafId }) {
  const go = useGrowthShell((s) => s.go)
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-[60px] flex-none items-center border-b border-slate-200 px-[14px]">
        <span className="truncate text-[16px] font-semibold text-slate-900">{TITLES[group]}</span>
      </div>
      <nav className="flex flex-col gap-[2px] px-[10px] py-[10px]">
        {childrenOf(group).map((leaf) => (
          <button
            key={leaf.id}
            type="button"
            aria-current={route === leaf.id ? 'page' : undefined}
            onClick={() => go(leaf.id)}
            className={`${navItem(route === leaf.id)} flex h-8 w-full items-center gap-[10px] px-[10px] text-left`}
          >
            <SIcon name={leaf.icon} size={16} className="slg-nav-icon flex-none" />
            <span className="slg-pane-label min-w-0 flex-1 truncate">{leaf.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
