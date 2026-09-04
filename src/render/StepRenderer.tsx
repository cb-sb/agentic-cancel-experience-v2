import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { ExperienceComponent, Step } from '../types/experience'
import { useExperience } from '../store/useExperience'
import { useJourney } from '../store/useJourney'
import { LossAversionCard } from './components/LossAversionCard'
import { SurveyReasons } from './components/SurveyReasons'
import { OfferCard } from './components/OfferCard'
import { PricingTable } from './components/PricingTable'
import { ConfirmationCard } from './components/ConfirmationCard'
import { OutcomeCard } from './components/OutcomeCard'
import { useRenderCtx } from './RenderContext'
import { DummyCheckout } from '../runtime/DummyCheckout'
import { AddComponentSlot } from '../composer/AddComponentSlot'

/** Nearest ancestor that can scroll vertically (modal card, full-page viewport, etc.). */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if (overflowY === 'auto' || overflowY === 'scroll') return node
    node = node.parentElement
  }
  return null
}

function renderComponent(component: ExperienceComponent, dense = false, stacked = false) {
  switch (component.kind) {
    case 'loss_aversion':
      return <LossAversionCard component={component} dense={dense} />
    case 'survey':
      return <SurveyReasons component={component} />
    case 'offer':
      return <OfferCard component={component} stacked={stacked} />
    case 'pricing_table':
      return <PricingTable component={component} />
    case 'checkout':
      return <DummyCheckout component={component} />
    case 'confirmation':
      return <ConfirmationCard component={component} />
    case 'outcome':
      return <OutcomeCard component={component} />
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function RemoveComponentButton({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      title="Remove component"
      aria-label="Remove component"
      className="absolute -right-2.5 -top-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity hover:border-rose-200 hover:text-rose-500 group-hover/comp:opacity-100"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  )
}

/** Wraps a component column in Compose with a hover outline + remove affordance.
 * `protectWidth` keeps the column at its content min-width (used by the benefits
 * card so its lines never wrap — the paired column shrinks instead). */
function ComponentShell({
  children,
  style,
  compose,
  onRemove,
  protectWidth,
}: {
  children: ReactNode
  style?: CSSProperties
  compose: boolean
  onRemove?: () => void
  protectWidth?: boolean
}) {
  return (
    <div
      className={`group/comp relative rounded-xl ${protectWidth ? '' : 'min-w-0'} ${
        compose ? 'transition-all hover:outline hover:outline-1 hover:outline-blue-200 hover:outline-offset-[6px]' : ''
      }`}
      style={style}
    >
      {compose && onRemove && <RemoveComponentButton onRemove={onRemove} />}
      {children}
    </div>
  )
}

/** The benefits card (feature-list loss-aversion) is the width-protected one. */
function isBenefitsCard(c: ExperienceComponent): boolean {
  return c.kind === 'loss_aversion' && c.cardType === 'feature_list'
}

function SwapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
    </svg>
  )
}

/** Draggable divider handle between the two columns — a full-height guide line
 * with a grip, plus the "Swap sides" button centered above it (Compose only). */
function WidthDivider({ onSwap, onDrag }: { onSwap: () => void; onDrag: (clientX: number) => void }) {
  const dragging = useRef(false)
  return (
    <div className="flex flex-none flex-col items-center gap-3 self-stretch text-slate-500">
      <button
        type="button"
        onClick={onSwap}
        title="Swap sides"
        aria-label="Swap sides"
        className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600"
      >
        <SwapIcon />
      </button>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Drag to adjust column width"
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (dragging.current) onDrag(e.clientX)
        }}
        onPointerUp={(e) => {
          dragging.current = false
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        className="group/handle relative flex flex-1 cursor-col-resize touch-none select-none items-center justify-center px-2"
      >
        <span className="absolute inset-y-0 w-px bg-slate-200 transition-colors group-hover/handle:bg-blue-300" />
        <span className="relative z-10 h-10 w-1.5 rounded-full bg-slate-300 shadow-sm transition-colors group-hover/handle:bg-blue-500" />
      </div>
    </div>
  )
}

/** Compact swap control used when two components are stacked on mobile. */
function StackSwap({ onSwap }: { onSwap: () => void }) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onSwap}
        title="Swap order"
        aria-label="Swap order"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3 4 7l4 4M4 7h13M16 21l4-4-4-4M20 17H7" />
        </svg>
      </button>
    </div>
  )
}

/** Two components rendered side by side (tablet/desktop) or stacked (mobile). */
function TwoColumnStep({ step, stacked }: { step: Step; stacked: boolean }) {
  const { mode } = useRenderCtx()
  const compose = mode === 'compose'
  const previewOnly = useJourney((s) => s.previewOnly)
  const removeComponent = useExperience((s) => s.removeComponent)
  const updateStep = useExperience((s) => s.updateStep)
  const swap = useExperience((s) => s.swapStepComponents)
  const rowRef = useRef<HTMLDivElement>(null)

  const [left, right] = step.components
  const bothOffers = left.kind === 'offer' && right.kind === 'offer'
  const bothLA = left.kind === 'loss_aversion' && right.kind === 'loss_aversion'
  // The aside is compacted only for a classic supporting pairing (e.g. survey +
  // loss-aversion). Two loss-aversion cards both render in full so media shows.
  const asideDense = !stacked && !bothOffers && !bothLA
  const ratio = clamp(step.splitRatio ?? 0.6, 0.3, 0.7)

  // The width divider can starve a column until its text wraps to more lines,
  // growing the step taller than the surface and introducing a vertical scroll.
  // We remember the last ratio that fit and snap back the moment a drag would
  // overflow the nearest scrollable surface (modal card / full-page viewport).
  const lastGoodRatio = useRef(ratio)
  const pendingDrag = useRef(false)

  useLayoutEffect(() => {
    if (!pendingDrag.current) {
      lastGoodRatio.current = ratio
      return
    }
    pendingDrag.current = false
    const scroller = findScrollParent(rowRef.current)
    if (scroller && scroller.scrollHeight - scroller.clientHeight > 1) {
      updateStep(step.id, { splitRatio: lastGoodRatio.current })
    } else {
      lastGoodRatio.current = ratio
    }
  }, [ratio, step.id, updateStep])

  const onDrag = (clientX: number) => {
    const el = rowRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width === 0) return
    pendingDrag.current = true
    updateStep(step.id, { splitRatio: clamp((clientX - r.left) / r.width, 0.3, 0.7) })
  }

  // --- Mobile: stack the two components vertically. ---
  if (stacked) {
    return (
      <div className="flex min-h-full flex-col gap-5">
        <ComponentShell compose={compose && !previewOnly} onRemove={previewOnly ? undefined : () => removeComponent(step.id, left.id)}>
          {renderComponent(left, false, true)}
        </ComponentShell>
        {compose && !previewOnly ? <StackSwap onSwap={() => swap(step.id)} /> : bothOffers ? (
          <div className="text-center text-xs font-semibold text-slate-300">OR</div>
        ) : null}
        <ComponentShell compose={compose && !previewOnly} onRemove={previewOnly ? undefined : () => removeComponent(step.id, right.id)}>
          {renderComponent(right, false, true)}
        </ComponentShell>
      </div>
    )
  }

  // --- Tablet / desktop: side by side with a draggable width divider. ---
  return (
    <div ref={rowRef} className="flex h-full items-stretch gap-6">
      <ComponentShell
        compose={compose && !previewOnly}
        protectWidth={isBenefitsCard(left)}
        onRemove={previewOnly ? undefined : () => removeComponent(step.id, left.id)}
        style={{ flex: `${ratio} 1 0%` }}
      >
        {renderComponent(left, false, false)}
      </ComponentShell>
      {compose && !previewOnly ? (
        <WidthDivider onSwap={() => swap(step.id)} onDrag={onDrag} />
      ) : bothOffers ? (
        <div className="flex-none self-center text-xs font-semibold text-slate-300">OR</div>
      ) : null}
      <ComponentShell
        compose={compose && !previewOnly}
        protectWidth={isBenefitsCard(right)}
        onRemove={previewOnly ? undefined : () => removeComponent(step.id, right.id)}
        style={{ flex: `${1 - ratio} 1 0%` }}
      >
        {renderComponent(right, asideDense, false)}
      </ComponentShell>
    </div>
  )
}

export function StepRenderer({ step }: { step: Step }) {
  const { mode } = useRenderCtx()
  const compose = mode === 'compose'
  const previewOnly = useJourney((s) => s.previewOnly)
  const device = useExperience((s) => s.device)
  const stacked = device === 'mobile'

  // --- Two components: horizontal on tablet/desktop, stacked on mobile. ---
  if (step.components.length === 2) {
    return <TwoColumnStep step={step} stacked={stacked} />
  }

  // --- Single component + an "add" slot (Compose only). Stacks on mobile. ---
  // The component is prioritised and takes all remaining width; the add-component
  // affordance stays a compact fixed-width column beside it.
  const only = step.components[0]
  return (
    <div className={`flex h-full gap-6 ${stacked ? 'flex-col' : 'items-stretch gap-8'}`}>
      {only && <div className={stacked ? '' : 'min-w-0 flex-1'}>{renderComponent(only, false, stacked)}</div>}
      {compose && !previewOnly && <AddComponentSlot step={step} stacked={stacked} />}
    </div>
  )
}
