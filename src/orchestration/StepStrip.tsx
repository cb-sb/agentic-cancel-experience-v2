import { isTailKind, type JourneyStepFile } from '../journey/types'
import { useJourney } from '../store/useJourney'

const KIND_LABEL: Record<JourneyStepFile['kind'], string> = {
  loss_aversion: 'What you keep',
  survey: 'Why they’re leaving',
  offer: 'Save',
  pricing_table: 'Choose a plan',
  checkout: 'Checkout',
  confirmation: 'Confirm',
  outcome_saved: 'Saved',
  outcome_cancelled: 'Cancelled',
}

function visibleSteps(steps: JourneyStepFile[]) {
  return steps.filter((s) => s.kind !== 'outcome_saved' && s.kind !== 'outcome_cancelled')
}

/** Inline step chain in Copilot. Drag writes the same reorder as the canvas. */
export function StepStrip({
  onAccept,
  onReject,
}: {
  onAccept: () => void
  onReject: () => void
}) {
  const file = useJourney((s) => s.file)
  const reorderSteps = useJourney((s) => s.reorderSteps)
  const steps = visibleSteps(file.steps)

  return (
    <div className="mt-st overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-st py-ti">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Step chain</p>
        <p className="text-[13px] font-bold text-slate-900">
          {steps.length} screen{steps.length === 1 ? '' : 's'} a subscriber walks
        </p>
      </div>
      <ol className="divide-y divide-slate-100">
        {steps.map((step, index) => {
          const locked = isTailKind(step.kind)
          return (
            <li
              key={step.id}
              draggable={!locked}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/step-id', step.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                if (locked) return
                e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                const fromId = e.dataTransfer.getData('text/step-id')
                if (fromId) reorderSteps(fromId, step.id)
              }}
              className={`flex items-center gap-st px-st py-st ${locked ? '' : 'cursor-grab'}`}
            >
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-500">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-[13px] font-medium text-slate-800">
                {KIND_LABEL[step.kind]}
              </span>
              {!locked && (
                <span className="text-[11px] text-slate-400" aria-hidden>
                  Drag
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <div className="flex gap-ti border-t border-slate-100 p-st">
        <button
          type="button"
          onClick={onAccept}
          className="flex-1 rounded-xl bg-slate-900 px-st py-ti text-[13px] font-semibold text-white hover:bg-slate-800"
        >
          This order is right
        </button>
        <button
          type="button"
          onClick={onReject}
          className="rounded-xl px-st py-ti text-[12.5px] font-semibold text-slate-500 hover:bg-slate-50"
        >
          Start over
        </button>
      </div>
    </div>
  )
}
