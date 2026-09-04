export const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const BoltIcon = () => (
  <svg {...iconProps}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
)

export const UsersIcon = () => (
  <svg {...iconProps}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

export const SplitIcon = () => (
  <svg {...iconProps}>
    <path d="M6 3v4a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v4M6 3H3m3 0h3M18 21h-3m3 0h3M6 21H3m3 0h3" />
  </svg>
)

export const FlowIcon = () => (
  <svg {...iconProps}>
    <path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" />
  </svg>
)

export const HoldoutIcon = () => (
  <svg {...iconProps}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="M9 12h6" />
  </svg>
)

export function iconForNode(id: string, dashed?: boolean, isSplit?: boolean) {
  if (id === 'node_trigger') return <BoltIcon />
  if (id === 'node_audience') return <UsersIcon />
  if (isSplit) return <SplitIcon />
  if (dashed) return <HoldoutIcon />
  return <FlowIcon />
}
