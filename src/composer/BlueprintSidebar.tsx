import { useState } from 'react'
import { useExperience } from '../store/useExperience'
import { BLUEPRINTS } from '../lib/blueprints'
import type { ShellLayout } from '../types/experience'

/**
 * Left layout navigation pill.
 * In collapsed state, it renders as a sleek pill containing the Modal / Full page
 * segmented control track with an expand chevron on the right.
 * When expanded, it drops down the child flow choices (One-Step to Six-Step).
 */

const LAYOUTS: { id: ShellLayout; label: string }[] = [
  { id: 'modal', label: 'Modal' },
  { id: 'fullpage_scroll', label: 'Full page' },
]

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-500 transition-transform duration-200"
      style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function BlueprintSidebar() {
  const blueprint = useExperience((s) => s.experience.blueprint)
  const selectBlueprint = useExperience((s) => s.selectBlueprint)
  const shell = useExperience((s) => s.experience.shell)
  const setShell = useExperience((s) => s.setShell)
  const [collapsed, setCollapsed] = useState(true)

  const flowLabel = (name: string) => name.replace(/\s*Flow$/, '')

  return (
    <div className="h-full px-3.5 pt-6">
      <div className="sticky top-6">
        <div className="overflow-hidden rounded-2xl bg-white px-4 py-4 shadow-[0px_12px_24px_0px_rgba(15,23,42,0.04)] outline outline-1 -outline-offset-1 outline-slate-200">
          <div className="flex flex-col gap-3">
            {/* Top row: hug-content segmented control + bordered chevron box. */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-1">
                {LAYOUTS.map((l) => {
                  const active = shell === l.id
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setShell(l.id)}
                      className={`whitespace-nowrap rounded-md px-3.5 py-2 text-[13px] transition-all ${
                        active
                          ? 'bg-white font-semibold text-slate-900 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]'
                          : 'font-medium text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {l.label}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? 'Show flows' : 'Hide flows'}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white outline outline-1 -outline-offset-1 outline-slate-200 transition-colors hover:bg-slate-50"
              >
                <ChevronIcon collapsed={collapsed} />
              </button>
            </div>

            {/* Flow choices — revealed on expand. Airy rows with circular radios. */}
            {!collapsed && (
              <div className="flex flex-col gap-0.5">
                {BLUEPRINTS.map((bp) => {
                  const active = bp.id === blueprint
                  return (
                    <button
                      key={bp.id}
                      type="button"
                      onClick={() => selectBlueprint(bp.id)}
                      className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active
                          ? 'bg-blue-50 outline outline-1 -outline-offset-1 outline-blue-200'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full ${
                          active
                            ? 'bg-white outline outline-2 -outline-offset-2 outline-blue-500'
                            : 'border-2 border-slate-300'
                        }`}
                      >
                        {active && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                      </span>
                      <span
                        className={`flex-1 text-[14px] font-medium ${active ? 'text-blue-600' : 'text-slate-500'}`}
                      >
                        {flowLabel(bp.name)}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
