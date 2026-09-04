import { useState } from 'react'
import type { Step } from '../types/experience'
import { BrandingPanel } from './BrandingPanel'
import { StepEditor } from './StepEditor'

type Tab = 'settings' | 'brand'

const TABS: { id: Tab; label: string }[] = [
  { id: 'settings', label: 'Settings' },
  { id: 'brand', label: 'Brand' },
]

/**
 * The inspector for the focused step.
 *
 * Two tabs, because the pane answers two questions with different reach:
 * settings belong to this step, brand belongs to every step at once. Stacked in
 * one scroll — how this used to read — the brand controls sat below the whole
 * step and nothing said that a colour changed there would move the other steps
 * too.
 */
export function StepInspector({ step }: { step: Step }) {
  const [tab, setTab] = useState<Tab>('settings')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Underline tabs, spanning the pane: the top level of the inspector has
          to out-rank the group switch below it, so it is the wider, larger and
          plainer of the two. Anything enclosed here would compete with it. */}
      <div className="flex flex-none items-center justify-center gap-7 border-b border-slate-200 px-4">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-px border-b-[3px] px-1.5 py-3 text-[14px] tracking-[-0.01em] transition-colors ${
              tab === id
                ? 'border-slate-900 font-bold text-slate-900'
                : 'border-transparent font-medium text-slate-400 hover:text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'settings' ? <StepEditor step={step} /> : <BrandingPanel />}
      </div>
    </div>
  )
}
