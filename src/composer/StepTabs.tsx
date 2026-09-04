import { Fragment, useState } from 'react'
import { useExperience } from '../store/useExperience'
import type { Step } from '../types/experience'

const stageLabel: Record<Step['stage'], string> = {
  value_reinforcement: 'Loss aversion',
  entry_offer: 'Entry offer',
  route_detection: 'Survey reasons',
  save_mechanic: 'Offer',
  checkout: 'Checkout',
  confirmation: 'Confirmation',
  outcome: 'Outcome',
}

function GripDots() {
  return (
    <span className="flex-none text-slate-300 transition-colors group-hover:text-slate-400" aria-hidden>
      <svg width="9" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="2.5" cy="2.5" r="1.2" />
        <circle cx="7.5" cy="2.5" r="1.2" />
        <circle cx="2.5" cy="7" r="1.2" />
        <circle cx="7.5" cy="7" r="1.2" />
        <circle cx="2.5" cy="11.5" r="1.2" />
        <circle cx="7.5" cy="11.5" r="1.2" />
      </svg>
    </span>
  )
}

function LockIcon() {
  return (
    <span className="flex-none text-slate-400" aria-hidden title="Locked to the end">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="11" width="16" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </span>
  )
}

/**
 * Vertical indicator rendered in the gap between two tabs to show exactly where
 * a dragged tab will drop. A blue bar with a dot at the top and bottom.
 */
function InsertionLine({ active }: { active: boolean }) {
  return (
    <span aria-hidden className="relative self-stretch" style={{ width: 4, margin: '0 3px' }}>
      <span
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full transition-all"
        style={{
          width: active ? 3 : 0,
          background: '#2563eb',
          boxShadow: active ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
        }}
      />
      {active && (
        <>
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full" style={{ background: '#2563eb' }} />
          <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full" style={{ background: '#2563eb' }} />
        </>
      )}
    </span>
  )
}

export function StepTabs() {
  const steps = useExperience((s) => s.experience.steps)
  const activeStepId = useExperience((s) => s.activeStepId)
  const setActiveStep = useExperience((s) => s.setActiveStep)
  const reorderSteps = useExperience((s) => s.reorderSteps)

  const [dragId, setDragId] = useState<string | null>(null)
  const [overGap, setOverGap] = useState<number | null>(null)

  // Confirmation + outcome form a locked unit pinned to the end of the flow.
  const isTailStage = (s: Step) => s.stage === 'confirmation' || s.stage === 'outcome'
  const groupStart = (() => {
    const i = steps.findIndex(isTailStage)
    return i === -1 ? steps.length : i
  })()
  const maxGap = groupStart

  const dragIndex = dragId ? steps.findIndex((s) => s.id === dragId) : -1

  const commitDrop = () => {
    if (dragId && overGap !== null) {
      const clamped = Math.min(overGap, maxGap)
      const target = steps[clamped]
      // Inserting before `target`; a no-op if it's the source or the slot right after it.
      if (target && clamped !== dragIndex && clamped !== dragIndex + 1) {
        reorderSteps(dragId, target.id)
      } else if (!target && dragIndex !== -1) {
        // Drop at the very end (no confirmation present).
        const last = steps[steps.length - 1]
        if (last && last.id !== dragId) reorderSteps(dragId, last.id)
      }
    }
    setDragId(null)
    setOverGap(null)
  }

  const gapActive = (g: number) =>
    dragId !== null &&
    overGap === Math.min(g, maxGap) &&
    g <= maxGap &&
    g !== dragIndex &&
    g !== dragIndex + 1

  const renderTab = (step: Step, i: number) => {
    const active = step.id === activeStepId
    const locked = isTailStage(step)
    return (
      <button
        key={step.id}
        type="button"
        draggable={!locked}
        onClick={() => setActiveStep(step.id)}
        onDragStart={(e) => {
          if (locked) return
          setDragId(step.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={(e) => {
          if (!dragId || dragId === step.id || locked) return
          e.preventDefault()
          const rect = e.currentTarget.getBoundingClientRect()
          const after = e.clientX > rect.left + rect.width / 2
          setOverGap(Math.min(after ? i + 1 : i, maxGap))
        }}
        onDrop={(e) => {
          e.preventDefault()
          commitDrop()
        }}
        onDragEnd={() => {
          setDragId(null)
          setOverGap(null)
        }}
        className="group flex-none rounded-xl border bg-white px-3 py-2 text-left shadow-sm transition-all"
        style={{
          cursor: locked ? 'pointer' : 'grab',
          borderColor: active ? '#2563eb' : '#e2e8f0',
          background: active ? '#eff6ff' : '#fff',
          boxShadow: active
            ? '0 6px 16px -8px rgba(37,99,235,0.4)'
            : '0 1px 2px rgba(15,23,42,0.06)',
          opacity: dragId === step.id ? 0.4 : 1,
        }}
      >
        <div className="flex items-center gap-2">
          {locked ? <LockIcon /> : <GripDots />}
          <div>
            <div
              className={`whitespace-nowrap text-[13px] font-semibold ${active ? 'text-blue-700' : 'text-slate-600'}`}
            >
              {stageLabel[step.stage]}
            </div>
            <div className="whitespace-nowrap text-[10px] text-slate-400">
              Step {i + 1} of {steps.length}
            </div>
          </div>
        </div>
      </button>
    )
  }

  const flowSteps = steps.slice(0, groupStart)
  const tailSteps = steps.slice(groupStart)

  return (
    <div className="mb-4 flex items-stretch">
      {flowSteps.map((step, i) => (
        <Fragment key={step.id}>
          <InsertionLine active={gapActive(i)} />
          {renderTab(step, i)}
        </Fragment>
      ))}
      <InsertionLine active={gapActive(groupStart)} />

      {/* Confirmation + Outcome: one locked unit, set apart with extra padding. */}
      {tailSteps.length > 0 && (
        <div className="ml-4 flex items-stretch gap-1.5 rounded-2xl bg-slate-100/70 p-1 ring-1 ring-slate-200/80">
          {tailSteps.map((step, gi) => renderTab(step, groupStart + gi))}
        </div>
      )}
    </div>
  )
}
