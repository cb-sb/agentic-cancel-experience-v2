import { Fragment, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { SButton, SIcon } from '@chargebee/sting-react'
import { isTailKind, type JourneyStepFile } from '../journey/types'
import { StepOutline } from './flow/tiers/StepOutline'
import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import { COPILOT_UI } from './copilotUi'
import type { Step } from '../types/experience'

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

const THUMB_W = 184
const THUMB_H = 124
const GAP_IDLE = 22
const GAP_DRAG = 32
const DRAG_THRESHOLD = 6

function visibleSteps(steps: JourneyStepFile[]) {
  return steps.filter((s) => s.kind !== 'outcome_saved' && s.kind !== 'outcome_cancelled')
}

function GrabHandle() {
  return (
    <span className="flex h-[14px] w-[10px] flex-none items-center justify-center text-slate-300" aria-hidden>
      <svg width="8" height="12" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="3" cy="2" r="1.1" />
        <circle cx="7" cy="2" r="1.1" />
        <circle cx="3" cy="7" r="1.1" />
        <circle cx="7" cy="7" r="1.1" />
        <circle cx="3" cy="12" r="1.1" />
        <circle cx="7" cy="12" r="1.1" />
      </svg>
    </span>
  )
}

/** Drop marker sits in the gap, halfway between two thumbs. */
function SlotGap({
  insert,
  dragging,
  chevron,
}: {
  insert: boolean
  dragging: boolean
  chevron: boolean
}) {
  const w = insert ? GAP_DRAG : dragging && chevron ? GAP_DRAG : chevron ? GAP_IDLE : 0
  return (
    <li
      className="relative flex flex-none items-center justify-center self-start"
      style={{ width: w, height: THUMB_H }}
      aria-hidden
    >
      {insert ? (
        <span
          className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-full"
          style={{
            width: 2,
            height: THUMB_H,
            background: COPILOT_UI.send,
            boxShadow: `0 0 0 3px ${COPILOT_UI.send}22`,
          }}
        />
      ) : (
        chevron &&
        !dragging && (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-slate-300">
            <path
              d="M5.5 2.5 11 8l-5.5 5.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )
      )}
    </li>
  )
}

function StepThumb({
  fileStep,
  compiled,
  index,
  locked,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  fileStep: JourneyStepFile
  compiled: Step | undefined
  index: number
  locked: boolean
  dragging: boolean
  onPointerDown: (id: string, e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const label = KIND_LABEL[fileStep.kind]
  return (
    <div
      data-strip-thumb
      onPointerDown={(e) => {
        if (locked) return
        onPointerDown(fileStep.id, e)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label={`${index + 1}. ${label}${locked ? ' (locked)' : ', drag to reorder'}`}
      className={`flex flex-none select-none flex-col items-center ${
        locked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
      } ${dragging ? 'opacity-40' : ''}`}
      style={{ width: THUMB_W, touchAction: locked ? undefined : 'none' }}
      title={locked ? `${label} stays last` : 'Drag to reorder'}
    >
      <div
        className="relative overflow-hidden rounded-[12px]"
        style={{ width: THUMB_W, height: THUMB_H }}
      >
        {compiled ? (
          <StepOutline step={compiled} w={THUMB_W} h={THUMB_H} selected={false} density="strip" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[12px] border border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-700">
            {label}
          </div>
        )}
        {locked && (
          <span className="absolute right-[8px] top-[8px] z-10 flex h-[22px] w-[22px] items-center justify-center rounded-md bg-white/95 text-slate-400 shadow-sm">
            <SIcon name="lock" size={12} />
          </span>
        )}
      </div>
      <p className="mt-[10px] flex w-full items-center justify-center gap-[6px] px-[2px] text-[13px] font-semibold leading-[18px] text-slate-800">
        {!locked && <GrabHandle />}
        <span className="tabular-nums text-[12px] font-semibold text-slate-400">{index + 1}</span>
        <span className="min-w-0 truncate">{label}</span>
      </p>
    </div>
  )
}

function insertIndexFromX(
  clientX: number,
  list: HTMLElement,
  count: number,
  lastLocked: boolean,
) {
  const thumbs = list.querySelectorAll('[data-strip-thumb]')
  let next = count
  thumbs.forEach((el, i) => {
    const r = el.getBoundingClientRect()
    if (clientX < r.left + r.width / 2 && next === count) next = i
  })
  if (lastLocked) next = Math.min(next, count - 1)
  return next
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
  const compiledSteps = useExperience((s) => s.experience.steps)
  const steps = visibleSteps(file.steps)
  const listRef = useRef<HTMLOListElement>(null)
  const originRef = useRef<{ id: string; x: number; y: number; pointerId: number } | null>(null)
  const dragRef = useRef<string | null>(null)
  const insertRef = useRef<number | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [insertIndex, setInsertIndex] = useState<number | null>(null)

  const fromIndex = dragging ? steps.findIndex((s) => s.id === dragging) : -1
  const lastLocked = steps.length > 0 && isTailKind(steps[steps.length - 1].kind)
  const noop =
    insertIndex != null && (insertIndex === fromIndex || insertIndex === fromIndex + 1)
  const lineAt = dragging && insertIndex != null && !noop ? insertIndex : null

  const finishDrag = (target?: HTMLElement) => {
    const origin = originRef.current
    if (origin && target) {
      try {
        target.releasePointerCapture(origin.pointerId)
      } catch {
        /* already released */
      }
    }
    originRef.current = null
    dragRef.current = null
    insertRef.current = null
    setDragging(null)
    setInsertIndex(null)
  }

  const commitDrop = (target?: HTMLElement) => {
    const id = dragRef.current
    const dest = insertRef.current
    const from = id ? steps.findIndex((s) => s.id === id) : -1
    const skip = dest != null && (dest === from || dest === from + 1)
    if (id && dest != null && !skip) {
      const to = steps[Math.min(dest, steps.length - 1)]
      if (to) reorderSteps(id, to.id)
    }
    finishDrag(target)
  }

  const onPointerDown = (id: string, e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    originRef.current = { id, x: e.clientX, y: e.clientY, pointerId: e.pointerId }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const origin = originRef.current
    if (!origin) return
    if (!dragRef.current) {
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < DRAG_THRESHOLD) return
      dragRef.current = origin.id
      setDragging(origin.id)
    }
    if (!listRef.current) return
    const next = insertIndexFromX(e.clientX, listRef.current, steps.length, lastLocked)
    insertRef.current = next
    setInsertIndex(next)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current) commitDrop(e.currentTarget)
    else finishDrag(e.currentTarget)
  }

  return (
    <div className="mt-[12px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-end justify-between gap-[12px] px-[16px] pb-[10px] pt-[14px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Step chain
          </p>
          <p className="mt-[2px] text-[14px] font-bold leading-[20px] text-slate-900">
            {steps.length} screen{steps.length === 1 ? '' : 's'} a subscriber walks
          </p>
        </div>
        <p className="pb-[2px] text-[12px] text-slate-400">Drag to reorder</p>
      </div>
      <ol
        ref={listRef}
        className="flex items-start overflow-x-auto px-[16px] py-[16px]"
        style={{
          backgroundColor: '#f8fafc',
          backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
          backgroundSize: '12px 12px',
        }}
      >
        {steps.map((step, index) => {
          const locked = isTailKind(step.kind)
          const compiled = compiledSteps.find((s) => s.id === step.id)
          return (
            <Fragment key={step.id}>
              <SlotGap
                insert={lineAt === index}
                dragging={Boolean(dragging)}
                chevron={index > 0}
              />
              <li className="flex-none">
                <StepThumb
                  fileStep={step}
                  compiled={compiled}
                  index={index}
                  locked={locked}
                  dragging={dragging === step.id}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                />
              </li>
            </Fragment>
          )
        })}
      </ol>
      <div className="flex items-center justify-end gap-[8px] border-t border-slate-100 px-[16px] py-[12px]">
        <SButton size="small" variant="neutral-ghost" className="w-auto shrink-0" onClick={onReject}>
          Start over
        </SButton>
        <SButton size="small" variant="primary" className="w-auto shrink-0" onClick={onAccept}>
          This order is right
        </SButton>
      </div>
    </div>
  )
}
