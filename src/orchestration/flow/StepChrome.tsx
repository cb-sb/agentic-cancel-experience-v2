import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { useStoreApi } from '@xyflow/react'
import { canAddToStep, countKind } from '../../lib/guardrails'
import { offerVariantPatch } from '../../lib/offerVariants'
import { useExperience, type AddableStepKind } from '../../store/useExperience'
import { useJourney } from '../../store/useJourney'
import { useOrchestration } from '../../store/useOrchestration'
import {
  COMPONENT_CAPS,
  type ComponentKind,
  type Experience,
  type OfferComponent,
} from '../../types/experience'
import { ConnectionPopover } from '../ConnectionPopover'
import { AddButton, AddMenu, type AddOption } from './AddMenu'
import { STEP_H, STEP_W, TOOLBAR_GAP, tierForZoom, type Transform } from './canvasTokens'
import { ScreenPin, useTransform } from './screen'
import { PlusIcon, StepToolbar, type OfferVariantSwitch, type StepMove } from './sharedUi'
import { dropPoints, nearestDrop, type DropPoint } from './stepDrag'
import { isTailStep, type StepSlot } from './stepGrid'
import type { FlowBranchLayout } from './types'

/**
 * Which step the floating chrome belongs to. Hover lives here rather than in the
 * node so that exactly one toolbar exists at a time: the old per-card toolbars
 * were laid out in world space, which is why neighbouring ones collided as the
 * canvas zoomed out and why they had to be capped, gapped and clamped.
 */
const SetHoverContext = createContext<(id: string | null) => void>(() => {})
export const useSetHoveredStep = () => useContext(SetHoverContext)

export function StepChromeProvider({
  children,
  onChange,
}: {
  children: ReactNode
  onChange: (id: string | null) => void
}) {
  return <SetHoverContext.Provider value={onChange}>{children}</SetHoverContext.Provider>
}

export interface ConnectionTarget {
  expId: string
  optId: string
  /** Pane coordinates of the click that opened it. */
  x: number
  y: number
}

/**
 * All floating canvas chrome, in one untransformed layer.
 *
 * Everything here is positioned by projecting a world point to the screen, so it
 * holds a constant size and can overlap its neighbours freely — which is what
 * transient chrome should do. Nothing in this layer is part of the world layout,
 * so nothing here can push a card out of the box reserved for it.
 */
export function StepChromeLayer({
  layouts,
  hoveredStepId,
  onHover,
  connection,
  onCloseConnection,
}: {
  layouts: FlowBranchLayout[]
  hoveredStepId: string | null
  onHover: (id: string | null) => void
  connection: ConnectionTarget | null
  onCloseConnection: () => void
}) {
  const transform = useTransform()
  const focusTarget = useOrchestration((s) => s.focusTarget)
  const previewOnly = useJourney((s) => s.previewOnly)
  const activeStepId = useExperience((s) => s.activeStepId)
  const layer = useRef<HTMLDivElement>(null)
  const drag = useStepDrag(layer)

  // Hover wins; otherwise the selected card keeps its toolbar, so the controls
  // stay reachable after a click without hunting for the card again. A drag
  // outranks both: the pointer leaves the card as soon as it starts moving, and
  // the toolbar it was started from has to survive the gesture.
  //
  // Only at full fidelity. Below it a card is an abstract of itself — there is
  // no detail on it worth acting on, and a constant-size toolbar next to a card
  // a third of its width reads as chrome for the enclosure, not for the step.
  const detailed = tierForZoom(transform.zoom) === 't3'
  const targetId = drag.stepId ?? (detailed ? hoveredStepId ?? activeStepId : null)

  const target = useMemo(() => {
    if (!targetId) return null
    for (const layout of layouts) {
      const slot = layout.grid?.slots.find((s) => s.step.id === targetId)
      if (slot && layout.experience) return { layout, slot, experience: layout.experience }
    }
    return null
  }, [layouts, targetId])

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {!previewOnly && target && !focusTarget && (
        <ScreenPin
          at={{
            x: target.layout.x + target.slot.x + STEP_W / 2,
            y: target.layout.y + target.slot.y,
          }}
          transform={transform}
          anchor="bottom-center"
          offset={{ x: 0, y: -TOOLBAR_GAP }}
          className="pointer-events-auto"
          onPointerEnter={() => onHover(target.slot.step.id)}
          onPointerLeave={() => onHover(null)}
        >
          <StepChromeToolbar
            experienceId={target.experience.id}
            stepId={target.slot.step.id}
            slot={target.slot}
            dragging={drag.stepId === target.slot.step.id}
            onGrab={() =>
              target.layout.grid &&
              drag.begin({
                experienceId: target.experience.id,
                stepId: target.slot.step.id,
                origin: { x: target.layout.x, y: target.layout.y },
                points: dropPoints(
                  target.layout.grid,
                  target.experience.steps,
                  target.slot.step.id,
                ),
              })
            }
          />
        </ScreenPin>
      )}

      {/* Which step is in the air. The cards themselves do not move until the
          drop, so without this there is nothing to say what is being carried. */}
      {drag.stepId && target && (
        <ScreenPin
          at={{ x: target.layout.x + target.slot.x, y: target.layout.y + target.slot.y }}
          transform={transform}
          className="pointer-events-none"
        >
          <div
            className="rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/40"
            style={{ width: STEP_W * transform.zoom, height: STEP_H * transform.zoom }}
          />
        </ScreenPin>
      )}

      {/* Where the step lands. Drawn in the gap rather than on a card, because
          what a drop changes is the order, and the order lives in the gaps. */}
      {drag.at && (
        <ScreenPin
          at={{ x: drag.origin.x + drag.at.x, y: drag.origin.y + drag.at.y }}
          transform={transform}
          className="pointer-events-none"
        >
          <div
            className="w-[3px] -translate-x-1/2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/15"
            style={{ height: drag.at.h * transform.zoom }}
          />
        </ScreenPin>
      )}

      {/* Every channel between columns is a place to insert a step. Screen-space
          chrome rather than a reserved slot in the grid: a slot in every gap
          would have made the enclosure half again as wide for four buttons. */}
      {detailed && !previewOnly && !focusTarget && !drag.stepId && (
        <StepGapAdds layouts={layouts} transform={transform} />
      )}

      {connection && (
        <div
          className="nowheel nopan pointer-events-auto absolute"
          style={{ left: connection.x, top: connection.y + 10 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ConnectionPopover
            expId={connection.expId}
            optId={connection.optId}
            onClose={onCloseConnection}
          />
        </div>
      )}

    </div>
  )
}

const STEP_KINDS: { kind: AddableStepKind; label: string; desc: string }[] = [
  { kind: 'offer', label: 'Save offer', desc: 'Discount, pause, plan change…' },
  { kind: 'survey', label: 'Reason survey', desc: 'Capture why they’re leaving' },
  { kind: 'loss_aversion', label: 'Loss aversion', desc: 'What they’ll keep / lose' },
  { kind: 'pricing_table', label: 'Pricing table', desc: 'Compare plans side by side' },
]

/** The step kinds still under their experience-wide cap. */
function stepOptions(
  experience: Experience,
  place: (kind: AddableStepKind) => void,
): AddOption[] {
  return STEP_KINDS.map((o) => {
    const cap = (COMPONENT_CAPS as Record<string, number | undefined>)[o.kind]
    const full = cap !== undefined && countKind(experience, o.kind) >= cap
    return {
      id: o.kind,
      label: o.label,
      desc: o.desc,
      disabledReason: full ? `Limit of ${cap} reached in this experience` : undefined,
      onPick: () => place(o.kind),
    }
  })
}

/**
 * Add a step in a gap.
 *
 * Faint until the pointer is in the channel, because there is one of these
 * between every pair of columns and five permanent buttons down the middle of a
 * flow would read as part of the flow.
 */
function StepGapAdds({
  layouts,
  transform,
}: {
  layouts: FlowBranchLayout[]
  transform: Transform
}) {
  const setActiveExperience = useExperience((s) => s.setActiveExperience)
  const addStep = useExperience((s) => s.addStep)
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <>
      {layouts.flatMap((layout) => {
        const experience = layout.experience
        if (!experience || !layout.grid) return []
        return layout.grid.gaps.map((gap) => {
          const id = `${experience.id}:${gap.beforeStepId}`
          const open = openId === id
          return (
            <ScreenPin
              key={id}
              at={{ x: layout.x + gap.x, y: layout.y + gap.y }}
              transform={transform}
              anchor="center"
              className="pointer-events-auto"
            >
              <div
                className={`group relative flex items-center justify-center transition-opacity ${
                  open ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                }`}
                style={{ width: 44, height: 44 }}
              >
                <AddButton
                  title={`Add a step before ${gap.beforeLabel}`}
                  open={open}
                  onToggle={() => setOpenId(open ? null : id)}
                >
                  <PlusIcon />
                </AddButton>
                {open && (
                  <AddMenu
                    onClose={() => setOpenId(null)}
                    sections={[
                      {
                        title: `Insert before ${gap.beforeLabel}`,
                        options: stepOptions(experience, (kind) => {
                          setActiveExperience(experience.id)
                          addStep(kind, { before: gap.beforeStepId })
                        }),
                      },
                    ]}
                  />
                )}
              </div>
            </ScreenPin>
          )
        })
      })}
    </>
  )
}

interface DragStart {
  experienceId: string
  stepId: string
  /** Enclosure origin, so drop points can stay layout-relative. */
  origin: { x: number; y: number }
  points: DropPoint[]
}

/**
 * Dragging a step to a new place in the flow.
 *
 * The gesture is owned here rather than by the toolbar or the card: the drop
 * position comes from the pointer against the *other* steps' geometry, and this
 * layer is the only place that has all of it. Nothing moves until the pointer
 * is released — reordering live would slide the cards out from under the drag
 * and make the next drop position a moving target.
 */
function useStepDrag(layer: RefObject<HTMLDivElement | null>) {
  const store = useStoreApi()
  const setActiveExperience = useExperience((s) => s.setActiveExperience)
  const reorderSteps = useExperience((s) => s.reorderSteps)

  const [drag, setDrag] = useState<(DragStart & { at: DropPoint | null }) | null>(null)
  const live = useRef<(DragStart & { at: DropPoint | null }) | null>(null)
  const put = useCallback((next: (DragStart & { at: DropPoint | null }) | null) => {
    live.current = next
    setDrag(next)
  }, [])

  const begin = useCallback(
    (start: DragStart) => {
      if (start.points.length) put({ ...start, at: null })
    },
    [put],
  )

  const active = Boolean(drag)
  useEffect(() => {
    if (!active) return

    const move = (e: PointerEvent) => {
      const d = live.current
      const box = layer.current?.getBoundingClientRect()
      if (!d || !box) return
      const [tx, , zoom] = store.getState().transform
      const world = (e.clientX - box.left - tx) / zoom - d.origin.x
      put({ ...d, at: nearestDrop(d.points, world) })
    }

    const end = (commit: boolean) => {
      const d = live.current
      put(null)
      if (!commit || !d?.at) return
      setActiveExperience(d.experienceId)
      reorderSteps(d.stepId, d.at.toId)
    }

    const up = () => end(true)
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') end(false)
    }

    // Held on the body: the pointer spends the drag outside the handle it
    // started on, and often outside the canvas altogether.
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', key)
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', key)
    }
  }, [active, layer, put, reorderSteps, setActiveExperience, store])

  return {
    begin,
    stepId: drag?.stepId ?? null,
    at: drag?.at ?? null,
    origin: drag?.origin ?? { x: 0, y: 0 },
  }
}

function StepChromeToolbar({
  experienceId,
  stepId,
  slot,
  dragging,
  onGrab,
}: {
  experienceId: string
  stepId: string
  slot: StepSlot
  dragging: boolean
  onGrab: () => void
}) {
  const experiences = useExperience((s) => s.experiences)
  const setActiveExperience = useExperience((s) => s.setActiveExperience)
  const reorderSteps = useExperience((s) => s.reorderSteps)
  const removeStep = useExperience((s) => s.removeStep)
  const addStep = useExperience((s) => s.addStep)
  const addComponent = useExperience((s) => s.addComponent)
  const setStepDisabled = useExperience((s) => s.setStepDisabled)
  const updateComponent = useExperience((s) => s.updateComponent)
  const focusStep = useOrchestration((s) => s.focusStep)

  const experience = experiences[experienceId]
  const step = experience?.steps.find((s) => s.id === stepId)
  if (!experience || !step || isTailStep(step)) return null

  const act = <T,>(fn: () => T) => {
    setActiveExperience(experienceId)
    return fn()
  }

  // Interchangeable offers stack vertically, so within a stack the moves are up
  // and down; everywhere else a step moves along the subscriber's path.
  const stacked = slot.rows > 1
  const move: StepMove = stacked
    ? {
        vertical: true,
        canPrev: slot.row > 0,
        canNext: slot.row < slot.rows - 1,
        onPrev: () => act(() => reorderSteps(step.id, siblingId(slot, slot.row - 1))),
        onNext: () => act(() => reorderSteps(step.id, siblingId(slot, slot.row + 2))),
        onDelete: () => act(() => removeStep(step.id)),
      }
    : {
        vertical: false,
        canPrev: Boolean(slot.prevCol),
        canNext: Boolean(slot.nextCol && !slot.nextCol.steps.some((s) => isTailStep(s.step))),
        onPrev: () => act(() => reorderSteps(step.id, slot.prevCol?.steps[0]?.step.id ?? '')),
        onNext: () => act(() => reorderSteps(step.id, slot.nextCol?.steps[0]?.step.id ?? '')),
        onDelete: () => act(() => removeStep(step.id)),
      }

  const offer = step.components.find((c): c is OfferComponent => c.kind === 'offer')
  const variant: OfferVariantSwitch | undefined = offer
    ? {
        category: offer.category,
        onSwitch: (category) => act(() => updateComponent(step.id, offer.id, offerVariantPatch(category))),
      }
    : undefined

  /**
   * What can join this card, in two granularities.
   *
   * A second component *inside* this step was only reachable from the focus
   * editor, which is why a survey with a loss-aversion card beside it looked
   * like something the canvas could not express. An interchangeable offer beside
   * it is the other axis, and it was the toolbar's one add button — so the two
   * live in one menu, labelled by where the thing lands.
   */
  const inside: AddOption[] = COMPONENT_KINDS.map((k) => {
    const allowed = canAddToStep(step, k.kind)
    const cap = (COMPONENT_CAPS as Record<string, number | undefined>)[k.kind]
    const full = cap !== undefined && countKind(experience, k.kind) >= cap
    return {
      id: `in:${k.kind}`,
      label: k.label,
      desc: k.desc,
      disabledReason: !allowed.ok
        ? allowed.reason
        : full
          ? `Limit of ${cap} reached in this experience`
          : undefined,
      onPick: () => act(() => addComponent(step.id, k.kind)),
    }
  })

  const beside: AddOption[] =
    offer && countKind(experience, 'offer') < COMPONENT_CAPS.offer
      ? [
          {
            id: 'beside:offer',
            label: 'Offer variation',
            desc: 'Another offer for this same moment',
            onPick: () => act(() => addStep('offer', { after: step.id })),
          },
        ]
      : []

  return (
    <StepToolbar
      move={move}
      disabled={step.disabled}
      variant={variant}
      dragging={dragging}
      onGrab={onGrab}
      add={[
        { title: 'Add to this step', options: inside },
        { title: 'Add beside it', options: beside },
      ]}
      onToggleDisabled={() => act(() => setStepDisabled(step.id, !step.disabled))}
      onFocus={() => focusStep({ experienceId, stepId: step.id })}
    />
  )
}

/** What a step can hold beside what it already has (see `canAddToStep`). */
const COMPONENT_KINDS: { kind: ComponentKind; label: string; desc: string }[] = [
  { kind: 'loss_aversion', label: 'Loss aversion card', desc: 'What they’ll keep / lose' },
  { kind: 'survey', label: 'Reason survey', desc: 'Ask why on this same screen' },
  { kind: 'offer', label: 'Save offer', desc: 'An offer inside this step' },
  { kind: 'pricing_table', label: 'Pricing table', desc: 'Compare plans side by side' },
]

/** `reorderSteps` inserts *before* the id given, so moving down is two along. */
const siblingId = (slot: StepSlot, row: number): string => slot.siblings[row] ?? ''

/**
 * Which card the floating chrome is following.
 *
 * Clearing is deferred by a beat because the toolbar sits in a different layer,
 * a gap above the card: without the grace period, reaching for a button would
 * cross empty canvas and dismiss the very toolbar being reached for.
 */
export function useHoveredStep() {
  const [hovered, setHovered] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const set = useCallback((id: string | null) => {
    if (timer.current) window.clearTimeout(timer.current)
    if (id) {
      setHovered(id)
      return
    }
    timer.current = window.setTimeout(() => setHovered(null), 140)
  }, [])

  useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), [])

  return { hovered, setHovered: set }
}
