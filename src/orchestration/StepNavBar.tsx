import { useState } from 'react'
import { isTailKind } from '../journey/types'
import { compactStepLabel } from '../lib/stepLabels'
import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { DEMO_STAGES, useEmptyDemoWalk, useEmptyJourneyDemo } from './emptyDemoFlag'

/**
 * The sequence, as a bar. Click focuses the step; drag rewrites `steps:` in
 * the journey file. Confirmation and outcomes stay locked at the tail.
 */
export function StepNavBar() {
  const file = useJourney((s) => s.file)
  const reorderSteps = useJourney((s) => s.reorderSteps)
  const experience = useExperience((s) => s.experience)
  const activeStepId = useExperience((s) => s.activeStepId)
  const setActiveStep = useExperience((s) => s.setActiveStep)
  const focusStep = useOrchestration((s) => s.focusStep)
  const [dragging, setDragging] = useState<string | null>(null)
  const emptyDemo = useEmptyJourneyDemo()
  const demoIndex = useEmptyDemoWalk((s) => s.index)
  const setDemoIndex = useEmptyDemoWalk((s) => s.setIndex)

  if (emptyDemo) {
    return (
      <div className="flex h-10 flex-none items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-5">
        {DEMO_STAGES.map((stage, i) => (
          <button
            key={stage.label}
            type="button"
            onClick={() => setDemoIndex(i)}
            className={`flex flex-none items-center rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
              demoIndex === i
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {stage.label}
          </button>
        ))}
        <span className="ml-2 text-[11px] text-slate-400">Demo — file not started</span>
      </div>
    )
  }

  if (file.steps.length === 0) {
    return (
      <div className="flex h-10 flex-none items-center border-b border-slate-200 bg-white px-5 text-[12px] text-slate-400">
        Prompt a journey and the steps will land here
      </div>
    )
  }

  return (
    <div className="flex h-10 flex-none items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-5">
      {file.steps.map((js) => {
        const step = experience.steps.find((s) => s.id === js.id)
        const label = step ? compactStepLabel(step) : js.kind.replace(/_/g, ' ')
        const locked = isTailKind(js.kind)
        const active = activeStepId === js.id
        const ghost = js.live === false
        return (
          <button
            key={js.id}
            type="button"
            draggable={!locked}
            onDragStart={() => setDragging(js.id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => {
              if (!locked && dragging && dragging !== js.id) e.preventDefault()
            }}
            onDrop={() => {
              if (dragging) reorderSteps(dragging, js.id)
              setDragging(null)
            }}
            onClick={() => {
              setActiveStep(js.id)
              if (step) focusStep({ experienceId: experience.id, stepId: step.id })
            }}
            className={`flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
              active
                ? 'border-slate-900 bg-slate-900 text-white'
                : ghost
                  ? 'border-dashed border-slate-300 bg-slate-50 text-slate-400'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            } ${dragging === js.id ? 'opacity-40' : ''}`}
            title={locked ? `${label} (locked)` : 'Drag to reorder'}
          >
            {locked && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            )}
            {label}
          </button>
        )
      })}
    </div>
  )
}
