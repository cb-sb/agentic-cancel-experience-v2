import { useEffect, useRef, useState } from 'react'
import { SIcon } from '@chargebee/sting-react'
import { V10 } from '../layout/layoutMode'
import { SIDEBAR_FOLDED_W, SIDEBAR_W } from '../layout/ThreadSidebar'
import { useV10 } from '../v10/useV10'
import { useWorkspaceUi } from '../workspace/useWorkspaceUi'
import type { NavLeafId } from './nav'
import { ARC_APPS, useArcApp, type ArcAppId } from './useArcApp'
import { useGrowthShell } from './useGrowthShell'
import { SlantedTab } from './SlantedTab'

function paneInset(route: NavLeafId, sidebarOpen: boolean): number {
  if (route === 'work.plays' || route === 'work.experiences' || route === 'work.audiences') return SIDEBAR_W
  if (route === 'acquisition' || route === 'expansion' || route === 'experiences.cancel') {
    return sidebarOpen ? SIDEBAR_W : SIDEBAR_FOLDED_W
  }
  if (route.startsWith('people') || route.startsWith('reports')) return SIDEBAR_W
  return 0
}

const V10_TABS: { id: string; label: string; route: NavLeafId; match: (route: NavLeafId) => boolean; keep: boolean }[] = [
  { id: 'home', label: 'Home', route: 'home', match: (route) => route === 'home', keep: true },
  { id: 'plays', label: 'Plays', route: 'work.plays', match: (route) => route === 'work.plays', keep: true },
  { id: 'experiences', label: 'Experiences', route: 'work.experiences', match: (route) => route === 'work.experiences', keep: true },
  { id: 'audiences', label: 'Audiences', route: 'work.audiences', match: (route) => route === 'work.audiences', keep: true },
  { id: 'renewal', label: 'Renewal', route: 'renewal', match: (route) => route === 'renewal', keep: false },
  { id: 'reports', label: 'Reports', route: 'reports.cancels', match: (route) => route.startsWith('reports'), keep: false },
]

const GROWTH_TABS: { id: string; label: string; route: NavLeafId; match: (route: NavLeafId) => boolean; keep: boolean }[] = [
  { id: 'home', label: 'Home', route: 'home', match: (route) => route === 'home', keep: true },
  { id: 'acquisition', label: 'Acquisition', route: 'acquisition', match: (route) => route === 'acquisition', keep: true },
  { id: 'expansion', label: 'Expansion', route: 'expansion', match: (route) => route === 'expansion', keep: true },
  { id: 'retention', label: 'Retention', route: 'experiences.cancel', match: (route) => route === 'experiences.cancel', keep: true },
  { id: 'people', label: 'People', route: 'people.audiences', match: (route) => route.startsWith('people'), keep: true },
  { id: 'renewal', label: 'Renewal', route: 'renewal', match: (route) => route === 'renewal', keep: false },
  { id: 'reports', label: 'Reports', route: 'reports.cancels', match: (route) => route.startsWith('reports'), keep: false },
]

function useOverflow(count: number) {
  const row = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(0)
  useEffect(() => {
    const node = row.current
    if (!node) return
    const measure = () => {
      const tabs = [...node.querySelectorAll<HTMLElement>('[data-growth-tab]')]
      tabs.forEach((tab) => (tab.hidden = false))
      const pinned = tabs.filter((tab) => tab.dataset.keep === 'true')
      const extra = tabs.filter((tab) => tab.dataset.keep !== 'true')
      const width = (tab: HTMLElement) => tab.offsetWidth + 4
      const pinnedWidth = pinned.reduce((sum, tab) => sum + width(tab), 0)
      const room = node.clientWidth - pinnedWidth
      const allFit = extra.reduce((sum, tab) => sum + width(tab), 0) <= room
      let used = 88
      let shown = 0
      if (!allFit) {
        for (const tab of extra) {
          if (used + width(tab) > room) break
          used += width(tab)
          shown += 1
        }
      }
      setHidden(allFit ? 0 : extra.length - shown)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [count])
  return { row, hidden }
}

/** The Arc app switcher. Growth is the only app built in this prototype. */
export function ArcBar() {
  const app = useArcApp((s) => s.app)
  const setApp = useArcApp((s) => s.setApp)
  return (
    <header className="relative flex h-12 flex-none items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-slate-900 text-[12px] font-bold text-white">A</span>
        <span className="text-[14px] font-semibold text-slate-900">Arc</span>
      </div>
      <nav className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1" aria-label="Arc">
        {ARC_APPS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={app === item.id ? 'page' : undefined}
            onClick={() => setApp(item.id)}
            className={`flex h-7 flex-none items-center rounded-full px-3 font-mono text-[12px] font-medium uppercase tracking-[0.04em] ${
              app === item.id ? 'bg-black text-white' : 'text-slate-900 hover:bg-[#ececec]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <AccountMenu />
    </header>
  )
}

function AccountMenu() {
  const route = useGrowthShell((s) => s.route)
  const go = useGrowthShell((s) => s.go)
  const setApp = useArcApp((s) => s.setApp)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [])
  const openSettings = () => {
    setApp('growth')
    go('settings')
    setOpen(false)
  }
  return (
    <div ref={ref} className="relative flex flex-none items-center gap-1">
      <button type="button" title="Need help?" aria-label="Need help?" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
        <SIcon name="circle-help" size={16} />
      </button>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] font-medium text-slate-800 hover:bg-slate-100"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">J</span>
        John
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            onClick={openSettings}
            className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] ${route === 'settings' ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'}`}
          >
            <SIcon name="settings" size={14} /> Settings
          </button>
        </div>
      )}
    </div>
  )
}

/** Growth's destinations. Home and the three objectives stay visible; Renewal and Reports fold into More. */
export function GrowthTopNav() {
  const route = useGrowthShell((s) => s.route)
  const go = useGrowthShell((s) => s.go)
  const sidebarOpen = useWorkspaceUi((s) => s.sidebarOpen)
  const tabs = V10 ? V10_TABS : GROWTH_TABS
  const inset = paneInset(route, sidebarOpen)
  const { row, hidden } = useOverflow(tabs.length)
  const [moreOpen, setMoreOpen] = useState(false)
  const overflow = tabs.slice(tabs.length - hidden)
  const visible = tabs.slice(0, tabs.length - hidden)
  return (
    <div className="flex-none bg-slate-100 pt-6">
      <div className="grid items-end" style={{ gridTemplateColumns: `${inset}px minmax(0,1fr)` }}>
        <div />
        <div ref={row} data-growth-row className="flex min-w-0 items-end justify-center px-4">
          {tabs.map((tab, index) => (
            <SlantedTab
              key={tab.id}
              label={tab.label}
              first={index === 0}
              active={tab.match(route)}
              data-growth-tab
              data-keep={tab.keep ? 'true' : undefined}
              hidden={!visible.includes(tab)}
              aria-current={tab.match(route) ? 'page' : undefined}
              onClick={() => {
                if (V10 && (tab.route === 'work.plays' || tab.route === 'work.experiences' || tab.route === 'work.audiences')) useV10.getState().close()
                go(tab.route)
              }}
            />
          ))}
          <div className="relative" data-growth-more hidden={hidden === 0}>
            <SlantedTab label="More" active={false} aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)} />
            {moreOpen && hidden > 0 && (
              <div className="absolute left-0 top-10 z-30 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                {overflow.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      go(tab.route)
                      setMoreOpen(false)
                    }}
                    className={`flex h-8 w-full items-center rounded-md px-2 text-left text-[13px] ${tab.match(route) ? 'bg-slate-100 font-medium' : 'hover:bg-slate-50'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ArcAppPlaceholder({ app }: { app: ArcAppId }) {
  const label = ARC_APPS.find((item) => item.id === app)?.label ?? app
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-white text-center">
      <p className="text-[16px] font-semibold text-slate-900">{label}</p>
      <p className="max-w-sm text-[13px] text-slate-500">This Arc app is not in the prototype. Growth is.</p>
    </div>
  )
}
