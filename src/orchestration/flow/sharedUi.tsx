import { useEffect, useState, type ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeMetrics } from '../../types/orchestration'
import { AddMenu, type AddSection } from './AddMenu'
import { DOT_MAX_SCALE, TOOLBAR_H, WIRE_COLOR } from './canvasTokens'
import { useCounterScale } from './screen'
import type { OfferCategory } from '../../types/experience'
import { OFFER_VARIANTS, offerVariantLabel } from '../../lib/offerVariants'

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

function Chip({ label, value, tone = 'slate' }: { label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>
      {label} <span className="tabular-nums">{value}</span>
    </span>
  )
}

export function MetricChips({ metrics }: { metrics: NodeMetrics }) {
  if (!metrics.sessions) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <Chip label="Save" value={pct(metrics.saveRate)} tone="emerald" />
      <Chip label="Accept" value={pct(metrics.acceptRate)} tone="sky" />
      <Chip label="Deflect" value={pct(metrics.deflectRate)} tone="violet" />
    </div>
  )
}

/** Placement is owned by the caller so the pin can live in screen space. */
export function AnnotatePin({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="nowheel nopan hidden h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-md ring-2 ring-white transition-colors hover:bg-slate-700 group-hover:flex"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title="Annotate"
    >
      <CommentIcon />
    </button>
  )
}

function CommentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    </svg>
  )
}

export function ChevronIcon({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: -90, down: 90, left: 180, right: 0 }[dir]
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.6 6.6A18.5 18.5 0 0 0 2 12s3 8 10 8a9.1 9.1 0 0 0 5.4-1.6M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  )
}

export function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function ToolbarBtn({
  title,
  disabled,
  danger,
  onClick,
  children,
}: {
  title: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={`nowheel nopan flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:opacity-25 ${
        danger
          ? 'text-slate-500 enabled:hover:bg-rose-50 enabled:hover:text-rose-600'
          : 'text-slate-600 enabled:hover:bg-slate-100 enabled:text-slate-900'
      }`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) onClick()
      }}
    >
      {children}
    </button>
  )
}

export interface StepMove {
  vertical: boolean
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  onDelete: () => void
}

export function FocusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  )
}

/** Switching an offer's type from the step toolbar re-templates its card copy. */
export interface OfferVariantSwitch {
  category: OfferCategory
  onSwitch: (category: OfferCategory) => void
}

function TagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
      <circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

function OfferVariantControl({
  variant,
  open,
  setOpen,
}: {
  variant: OfferVariantSwitch
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const { category, onSwitch } = variant
  return (
    <div className="relative">
      <button
        type="button"
        title="Switch offer type"
        className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-bold uppercase tracking-wide transition-colors ${
          open ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
      >
        <TagIcon />
        {offerVariantLabel(category)}
        <ChevronIcon dir="down" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-left shadow-xl">
            <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Offer type
            </div>
            {OFFER_VARIANTS.map((v) => (
              <button
                key={v.category}
                type="button"
                className={`flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left hover:bg-slate-50 ${
                  v.category === category ? 'bg-slate-50' : ''
                }`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onSwitch(v.category)
                  setOpen(false)
                }}
              >
                <span
                  className={`text-[12.5px] ${
                    v.category === category ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                  }`}
                >
                  {v.label}
                </span>
                <span className="truncate text-[11px] text-slate-400">{v.title}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="5.5" r="1.6" />
      <circle cx="15" cy="5.5" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18.5" r="1.6" />
      <circle cx="15" cy="18.5" r="1.6" />
    </svg>
  )
}

/**
 * Picks the step up. A press rather than a click, so the pointer that started
 * the gesture is the one that carries it — the drop position is tracked by the
 * chrome layer, which is the only thing that knows where the other steps are.
 */
function DragHandle({ dragging, onGrab }: { dragging: boolean; onGrab: () => void }) {
  return (
    <button
      type="button"
      title="Drag to move this step along the flow"
      className={`nowheel nopan flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
        dragging
          ? 'cursor-grabbing bg-slate-100 text-slate-900'
          : 'cursor-grab text-slate-400 hover:bg-slate-100 hover:text-slate-700'
      }`}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onGrab()
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <GripIcon />
    </button>
  )
}

/**
 * Deleting a step throws away copy that was written for it, and the toolbar it
 * is triggered from sits under a moving pointer — so it asks. The question
 * takes over the pill rather than opening a dialog: the answer belongs beside
 * the card it is about, and a modal over a canvas loses which card that was.
 */
function DeleteConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onCancel])

  return (
    <>
      <span className="whitespace-nowrap pl-2 pr-0.5 text-[12px] font-semibold text-slate-700">
        Delete this step?
      </span>
      <button
        type="button"
        className="nowheel nopan rounded-full px-2 py-1 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onCancel()
        }}
      >
        Keep
      </button>
      <button
        type="button"
        className="nowheel nopan rounded-full bg-rose-600 px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-rose-700"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onConfirm()
        }}
      >
        Delete
      </button>
    </>
  )
}

/**
 * Actions on one step. It lives in the screen-space chrome layer and only ever
 * exists once, for whichever card is under the pointer — so unlike the old
 * per-card toolbars it has no neighbours to collide with, and needs no scale
 * cap, no reserved gap and no width clamp.
 *
 * Grouped by what the action touches: where the step sits, what it is, and
 * whether it runs at all — with the two irreversible ones last, and the
 * destructive one gated behind a question.
 */
export function StepToolbar({
  move,
  disabled,
  variant,
  dragging,
  onGrab,
  add,
  onToggleDisabled,
  onFocus,
}: {
  move: StepMove
  disabled?: boolean
  /** Present for offer steps, whose type can be swapped in place. */
  variant?: OfferVariantSwitch
  dragging?: boolean
  /** Picks the step up for a drag; the chrome layer owns the gesture. */
  onGrab?: () => void
  /** What can join this step: a component inside it, or a variant beside it. */
  add?: AddSection[]
  onToggleDisabled: () => void
  /** Open this card in the editor, on its own. */
  onFocus?: () => void
}) {
  const { vertical, canPrev, canNext, onPrev, onNext, onDelete } = move
  const [menuOpen, setMenuOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const canAdd = (add ?? []).some((s) => s.options.length)

  return (
    <div
      data-screen-px={TOOLBAR_H}
      className="nowheel nopan flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-1 py-0.5 shadow-md"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {confirming ? (
        <DeleteConfirm
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            onDelete()
          }}
        />
      ) : (
        <>
          {variant && (
            <>
              <OfferVariantControl variant={variant} open={menuOpen} setOpen={setMenuOpen} />
              <span className="mx-0.5 h-4 w-px bg-slate-200" />
            </>
          )}

          {/* Position: drag for anywhere along the flow, arrows for one place at
              a time — and for a stack of offer variants, where dragging moves a
              step along the path rather than within the column. */}
          {onGrab && <DragHandle dragging={Boolean(dragging)} onGrab={onGrab} />}
          <ToolbarBtn title={vertical ? 'Move up' : 'Move left'} disabled={!canPrev} onClick={onPrev}>
            <ChevronIcon dir={vertical ? 'up' : 'left'} />
          </ToolbarBtn>
          <ToolbarBtn title={vertical ? 'Move down' : 'Move right'} disabled={!canNext} onClick={onNext}>
            <ChevronIcon dir={vertical ? 'down' : 'right'} />
          </ToolbarBtn>

          <span className="mx-0.5 h-4 w-px bg-slate-200" />

          {canAdd && (
            <div className="relative">
              <ToolbarBtn title="Add to this step" onClick={() => setAddOpen((v) => !v)}>
                <PlusIcon />
              </ToolbarBtn>
              {addOpen && (
                <AddMenu sections={add ?? []} onClose={() => setAddOpen(false)} />
              )}
            </div>
          )}
          {onFocus && (
            <ToolbarBtn title="Expand this step to edit it (or double-click)" onClick={onFocus}>
              <FocusIcon />
            </ToolbarBtn>
          )}
          <ToolbarBtn title={disabled ? 'Enable step' : 'Disable step'} onClick={onToggleDisabled}>
            {disabled ? <EyeIcon /> : <EyeOffIcon />}
          </ToolbarBtn>
          <ToolbarBtn title="Delete step" danger onClick={() => setConfirming(true)}>
            <TrashIcon />
          </ToolbarBtn>
        </>
      )}
    </div>
  )
}

/**
 * Compact on purpose: it is the only affordance left in the split's column, and
 * a full-width button there would read as a node in the graph rather than an
 * action on it. Counter-scaled by its node so it stays clickable when zoomed out.
 */
export function AddBranchButton({
  mode,
  scale,
  onClick,
}: {
  mode: import('../../types/orchestration').SplitMode
  scale: number
  onClick: () => void
}) {
  const label =
    mode === 'audience' ? 'Add sub-audience' : mode === 'percent' ? 'Add variant' : 'Add A/B variant'
  return (
    <button
      type="button"
      className="nowheel nopan flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-indigo-400 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-indigo-600 transition-colors hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
      style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={label}
    >
      <span className="text-indigo-500">
        <PlusIcon />
      </span>
      {label}
    </button>
  )
}

import type { PlacedNodeMeta } from './types'
import type { ScreenSize } from './screen'
import { iconForNode } from './icons'

/**
 * The wire's origin, drawn as a solid dot. Targets stay invisible: marking both
 * ends doubles the marks without telling the merchant anything more, and the
 * dot's job is to show where traffic leaves from.
 */
export function WireHandles({ source = true, target = true }: { source?: boolean; target?: boolean }) {
  // The anchor stays in world units so React Flow keeps measuring it on the
  // card's edge; only the dot drawn inside it counter-scales.
  const scale = useCounterScale(DOT_MAX_SCALE)
  return (
    <>
      {target && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2 !w-2 !min-h-0 !min-w-0 !border-0 !opacity-0"
        />
      )}
      {source && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2 !w-2 !min-h-0 !min-w-0 !border-0 !bg-transparent"
        >
          <span
            className="absolute left-1/2 top-1/2 block rounded-full"
            style={{
              width: 7,
              height: 7,
              background: WIRE_COLOR,
              transform: `translate(-50%, -50%) scale(${scale})`,
            }}
          />
        </Handle>
      )}
    </>
  )
}

/**
 * A branch or split card. Same box at every tier — only how much of the card's
 * identity it spells out changes, which is decided by the room the `ScreenBox`
 * around it reports rather than by a zoom threshold read from somewhere else.
 *
 * Omitting `onSelect` makes the card scenery: a label on the wire that reports
 * what runs there and intercepts nothing.
 */
export function NodeCard({
  node,
  selected,
  onSelect,
  isSplit,
  size,
}: {
  node: PlacedNodeMeta
  selected: boolean
  onSelect?: () => void
  isSplit?: boolean
  size: ScreenSize
}) {
  const icon = node.icon ?? iconForNode(node.id, node.dashed, isSplit)
  const compact = size.tier === 't0'
  const full = size.tier === 't2' || size.tier === 't3'
  // A card 22px tall on screen has room for one line and nothing else. Dropping
  // the icon there is the difference between a truncated name and a clipped one.
  const showIcon = !compact || size.h >= 34

  const shell = `flex h-full w-full flex-col overflow-hidden rounded-xl border text-left shadow-sm ${
    compact ? 'justify-center px-1.5 py-0.5' : 'p-3'
  } ${node.dashed ? 'border-dashed bg-slate-50/80' : 'bg-white'} ${
    selected
      ? 'border-slate-900 ring-2 ring-slate-900/10'
      : node.dashed
      ? 'border-slate-300'
      : 'border-slate-200'
  }`

  const body = (
    <>
      <div className="flex min-h-0 flex-none items-center gap-1.5">
        {showIcon && (
          <span
            className={`flex flex-none items-center justify-center rounded-lg text-white ${
              compact ? 'h-4 w-4' : 'h-7 w-7'
            } ${node.dashed ? 'bg-slate-400' : 'bg-slate-900'}`}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {!compact && (
            <div className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {node.kicker}
            </div>
          )}
          <div
            className={`truncate font-bold leading-tight text-slate-900 ${
              compact ? 'text-[11px]' : 'text-[14px]'
            }`}
          >
            {node.title}
          </div>
        </div>
      </div>
      {full && node.subtitle && (
        <div className="mt-1.5 truncate text-[12px] text-slate-500">{node.subtitle}</div>
      )}
      {full && node.metrics && <MetricChips metrics={node.metrics} />}
    </>
  )

  // An inert card keeps neither the button semantics nor `nowheel nopan`: with
  // nothing to click it should hand pan and zoom to the canvas underneath, the
  // way the background does, instead of being a dead spot that swallows drags.
  if (!onSelect) return <div className={shell}>{body}</div>

  return (
    <button
      type="button"
      className={`nowheel nopan transition-all hover:shadow-md ${shell}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onSelect}
    >
      {body}
    </button>
  )
}
