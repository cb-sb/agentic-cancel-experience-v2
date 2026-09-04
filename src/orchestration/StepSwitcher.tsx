import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  alternativeKind,
  buildStepColumns,
  type AlternativeKind,
  type StepColumn,
} from '../lib/stepColumns'
import { stepLabel, tabLabel } from '../lib/stepLabels'
import { useExperience } from '../store/useExperience'
import { useOrchestration } from '../store/useOrchestration'
import type { Experience, Step } from '../types/experience'

const isTail = (s: Step) => s.stage === 'confirmation' || s.stage === 'outcome'

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

/**
 * Moving between the cards of one experience, in the focus toolbar.
 *
 * Navigation only. Reordering used to live here as drag-and-drop, which meant
 * every tab carried a grip and the strip needed insertion markers — a lot of
 * chrome for an action that is better done on the canvas, where the arrangement
 * being changed is actually visible. The step toolbar there does it.
 *
 * The strip mirrors the canvas: one entry per column, so three interchangeable
 * offers read as one step with three variants rather than as three steps that
 * confusingly all claim the same position. A column of alternatives is one tab
 * naming the current one, with the rest behind a caret.
 */
export function StepSwitcher({ experience }: { experience: Experience }) {
  const activeStepId = useExperience((s) => s.activeStepId)
  const setActiveExperience = useExperience((s) => s.setActiveExperience)
  const focusStep = useOrchestration((s) => s.focusStep)

  const columns = buildStepColumns(experience.steps)

  // A disabled column is never reached, so it takes no number — the numbering a
  // subscriber would experience, not a count of what exists.
  let counted = 0
  const numbers = columns.map((c) => (c.steps.some(({ step }) => !step.disabled) ? ++counted : null))

  const tailAt = columns.findIndex((c) => c.steps.some(({ step }) => isTail(step)))
  const split = tailAt === -1 ? columns.length : tailAt

  const open = (step: Step) => {
    setActiveExperience(experience.id)
    focusStep({ experienceId: experience.id, stepId: step.id })
  }

  const render = (column: StepColumn, i: number) => (
    <Column
      key={column.steps[0].step.id}
      column={column}
      number={numbers[i]}
      activeStepId={activeStepId}
      onOpen={open}
    />
  )

  return (
    <div className="flex items-center gap-1">
      {columns.slice(0, split).map((c, i) => render(c, i))}

      {split < columns.length && (
        <>
          <span className="mx-1 h-5 w-px flex-none bg-slate-200" aria-hidden />
          {columns.slice(split).map((c, i) => render(c, split + i))}
        </>
      )}
    </div>
  )
}

/**
 * One step. A column of interchangeable variants becomes a bordered group whose
 * number sits outside the pills, so the number labels the step and the pills
 * label the choices within it.
 */
function Column({
  column,
  number,
  activeStepId,
  onOpen,
}: {
  column: StepColumn
  number: number | null
  activeStepId: string | null
  onOpen: (step: Step) => void
}) {
  const locked = column.steps.some(({ step }) => isTail(step))

  if (column.steps.length === 1) {
    const { step } = column.steps[0]
    return (
      <Tab
        step={step}
        lead={<Lead number={number} locked={locked} />}
        active={step.id === activeStepId}
        onOpen={onOpen}
      />
    )
  }

  return (
    <AlternativesTab
      column={column}
      number={number}
      locked={locked}
      activeStepId={activeStepId}
      onOpen={onOpen}
    />
  )
}

const GROUP_LABEL: Record<AlternativeKind, string> = {
  offer: 'Offer',
  outcome: 'Outcome',
}

/**
 * A column of alternatives, as one tab: `Offer: Discount`, with the others
 * behind a caret.
 *
 * The strip already grouped them, with a shared number and a border, and three
 * same-shaped pills in a row still read as three steps. What is actually true
 * is that the step is "the offer" and which offer is a choice inside it — so
 * the tab is the step and the dropdown is the choice.
 *
 * Which variant you are working on stays a canvas act as well; this is the same
 * choice reached from the rail, not a second home for it.
 */
function AlternativesTab({
  column,
  number,
  locked,
  activeStepId,
  onOpen,
}: {
  column: StepColumn
  number: number | null
  locked: boolean
  activeStepId: string | null
  onOpen: (step: Step) => void
}) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const show = () => {
    const r = box.current?.getBoundingClientRect()
    if (r) setAt({ left: r.left, top: r.bottom + 6 })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  const kind = alternativeKind(column.steps[0].step) ?? 'offer'
  // The one being edited, or the one a subscriber would meet first.
  const current =
    column.steps.find(({ step }) => step.id === activeStepId)?.step ?? column.steps[0].step
  const active = column.steps.some(({ step }) => step.id === activeStepId)

  return (
    <div ref={box} className="relative flex-none">
      <div
        className={`flex h-8 items-center rounded-lg pl-2 pr-0.5 transition-colors ${
          active ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-100'
        }`}
      >
        <Lead number={number} locked={locked} />
        <button
          type="button"
          onClick={() => onOpen(current)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-current={active ? 'true' : undefined}
          title={`${GROUP_LABEL[kind]} · ${column.steps.length} alternatives — only one is shown`}
          className={`flex items-center gap-1 px-1.5 text-[12px] font-semibold ${
            active ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <span className={active ? 'text-indigo-400' : 'text-slate-400'}>
            {GROUP_LABEL[kind]}:
          </span>
          <span className="max-w-[120px] truncate">{tabLabel(current)}</span>
        </button>
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : show())}
          onPointerDown={(e) => e.stopPropagation()}
          aria-expanded={open}
          aria-label={`Choose which ${GROUP_LABEL[kind].toLowerCase()} to edit`}
          className={`flex h-7 w-6 items-center justify-center rounded-md transition-colors ${
            active ? 'text-indigo-500 hover:bg-indigo-100/70' : 'text-slate-400 hover:bg-slate-200/70'
          }`}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* In a portal, and positioned from the tab's own box: the strip scrolls
          horizontally, so anything absolutely placed inside it is clipped by
          the scroller the moment it hangs below. */}
      {open && at && createPortal(
        <div
          className="fixed z-50 min-w-[190px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
          style={{ left: at.left, top: at.top }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-2 pb-1 pt-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
            {column.steps.length} {GROUP_LABEL[kind].toLowerCase()}s · one is shown
          </div>
          {column.steps.map(({ step }) => (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                setOpen(false)
                onOpen(step)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-semibold transition-colors ${
                step.id === activeStepId
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{stepLabel(step)}</span>
              {step.disabled && (
                <span className="flex-none text-[10.5px] font-semibold text-slate-400">Off</span>
              )}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

function Lead({ number, locked }: { number: number | null; locked: boolean }) {
  return (
    <span className="flex flex-none items-center gap-1 text-slate-400/90" aria-hidden>
      {locked && <LockIcon />}
      {number !== null && <span className="text-[10.5px] font-bold tabular-nums">{number}</span>}
    </span>
  )
}

function Tab({
  step,
  lead,
  active,
  onOpen,
}: {
  step: Step
  lead?: ReactNode
  active: boolean
  onOpen: (step: Step) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(step)}
      onPointerDown={(e) => e.stopPropagation()}
      aria-current={active ? 'true' : undefined}
      title={
        step.disabled
          ? `${stepLabel(step)} — disabled, subscribers never see it`
          : stepLabel(step)
      }
      // Tinted rather than white, because a tab sits either on the white bar or
      // inside a grey variant group and has to read as current on both.
      className={`flex h-8 flex-none items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition-colors ${
        active
          ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'
          : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-900'
      }`}
    >
      {lead}
      {step.disabled && (
        <span className="h-1.5 w-1.5 flex-none rounded-full bg-slate-400" aria-hidden />
      )}
      <span
        className={`max-w-[132px] truncate ${
          step.disabled ? 'text-slate-400 line-through decoration-slate-400/70' : ''
        }`}
      >
        {tabLabel(step)}
      </span>
    </button>
  )
}
