import { SIcon } from '@chargebee/sting-react'
import { NAV, type NavGroup, type NavLeaf, type NavLeafId } from './nav'
import { useGrowthShell } from './useGrowthShell'

function Mark() {
  return (
    <svg width="20" height="20" viewBox="0 0 31 30" fill="none" aria-hidden="true" className="flex-none">
      <path d="M30.3198 19.7041V30H20.0513L10.5044 14.9863L30.3198 19.7041Z" fill="#FF3300" />
      <path d="M13.4185 29.834C9.72756 29.3345 6.48065 27.4471 4.17725 24.7275L10.5044 14.9863L13.4185 29.834Z" fill="#FF3300" />
      <path d="M10.5044 14.9863L1.12451 18.3721C0.819239 17.2342 0.680176 16.0404 0.680176 14.8193C0.68021 13.7096 0.818606 12.6275 1.04053 11.5732L10.5044 14.9863Z" fill="#FF3300" />
      <path d="M30.3198 10.2686L10.5044 14.9863L20.0513 0H30.3198V10.2686Z" fill="#FF3300" />
      <path d="M10.5044 14.9863L4.17725 5.24512C6.48066 2.52546 9.72747 0.665956 13.4185 0.138672L10.5044 14.9863Z" fill="#FF3300" />
    </svg>
  )
}

function ItemButton({
  label,
  icon,
  active,
  expanded,
  nested,
  onClick,
}: {
  label: string
  icon?: NavLeaf['icon']
  active?: boolean
  expanded?: boolean
  nested?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      aria-expanded={expanded}
      onClick={onClick}
      className={`flex h-8 w-full items-center rounded-md text-left text-[14px] leading-5 text-[#1a1d21] ${
        nested ? 'pl-[28px]' : ''
      } ${active ? 'bg-[#f7f7f8] font-semibold shadow-[inset_0_0_0_1px_#e5e8ed]' : 'font-normal hover:bg-[#f7f7f8]'}`}
    >
      <span className="flex h-8 w-8 flex-none items-center justify-center">
        {icon && <SIcon name={icon} size={16} className={active ? 'text-[#1a1d21]' : 'text-[#62676d]'} />}
      </span>
      <span className="min-w-0 flex-1 truncate pr-[8px]">{label}</span>
      {expanded != null && (
        <SIcon name="chevron-down" size={16} className={`mr-[8px] flex-none text-[#62676d] transition-transform ${expanded ? '' : '-rotate-90'}`} />
      )}
    </button>
  )
}

function GroupBlock({ group, route }: { group: NavGroup; route: NavLeafId }) {
  const open = useGrowthShell((s) => s.openGroups[group.id])
  const toggleGroup = useGrowthShell((s) => s.toggleGroup)
  return (
    <div>
      <ItemButton label={group.label} icon={group.icon} expanded={open} onClick={() => toggleGroup(group.id)} />
      {open &&
        group.children.map((leaf) => (
          <LeafButton key={leaf.id} leaf={leaf} active={leaf.id === route} nested />
        ))}
    </div>
  )
}

function LeafButton({ leaf, active, nested }: { leaf: NavLeaf; active: boolean; nested?: boolean }) {
  const go = useGrowthShell((s) => s.go)
  return <ItemButton label={leaf.label} icon={leaf.icon} active={active} nested={nested} onClick={() => go(leaf.id)} />
}

/** Sting page-layout rail: product pill, site switcher, nav, help, and user. */
export function MvpNav() {
  const route = useGrowthShell((s) => s.route)
  return (
    <div className="grid h-full w-[260px] grid-rows-[auto_1fr_auto] bg-white">
      <div className="px-[12px] pb-[8px] pt-[12px]">
        <button
          type="button"
          className="flex h-9 w-full items-center gap-[8px] rounded-lg bg-[#012a38] px-[8px] text-[14px] font-semibold text-[#e6eaeb]"
        >
          <Mark />
          <span className="min-w-0 flex-1 truncate text-left">Growth</span>
          <SIcon name="chevron-right" size={16} className="flex-none text-[#e6eaeb]" />
        </button>
        <button
          type="button"
          className="mt-[8px] flex h-9 w-full items-center rounded-lg bg-[#e1e2e6] px-[12px] text-left text-[14px] font-semibold text-[#3e4247]"
        >
          <span className="min-w-0 flex-1 truncate">cbgrowthdemo</span>
          <SIcon name="chevron-right" size={16} className="flex-none" />
        </button>
      </div>
      <nav className="min-h-0 overflow-y-auto px-[12px]">
        <div className="flex flex-col gap-px pb-[16px]">
          {NAV.map((entry) =>
            entry.kind === 'group' ? (
              <GroupBlock key={entry.group.id} group={entry.group} route={route} />
            ) : (
              <LeafButton key={entry.leaf.id} leaf={entry.leaf} active={entry.leaf.id === route} />
            ),
          )}
        </div>
      </nav>
      <div className="flex flex-col gap-px p-[12px]">
        <button type="button" className="flex h-8 w-full items-center rounded-md text-left text-[14px] leading-5 text-[#1a1d21] hover:bg-[#f7f7f8]">
          <span className="flex h-8 w-8 flex-none items-center justify-center text-[#62676d]">
            <SIcon name="circle-help" size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate">Need help?</span>
        </button>
        <button type="button" className="flex h-8 w-full items-center rounded-md text-left text-[14px] leading-5 text-[#1a1d21] hover:bg-[#f7f7f8]">
          <span className="flex h-8 w-8 flex-none items-center justify-center">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1d21] text-[10px] font-semibold text-white">J</span>
          </span>
          <span className="min-w-0 flex-1 truncate">John</span>
        </button>
      </div>
    </div>
  )
}
