import type { CSSProperties, ReactNode } from 'react'
import { useStore } from '@xyflow/react'
import { projectToScreen, tierForWidth, type Tier, type Transform } from './canvasTokens'

/**
 * Zoom, rounded to a step. The interior of every card is re-laid-out when this
 * changes, so a continuous value would mean re-flowing every node on every frame
 * of a pinch. Forty steps across the range is finer than the eye follows.
 */
const ZOOM_STEPS = 40

export function useQuantisedZoom(): number {
  return useStore((s) => Math.round(s.transform[2] * ZOOM_STEPS) / ZOOM_STEPS)
}

export function useTransform(): Transform {
  return useStore((s) => ({ x: s.transform[0], y: s.transform[1], zoom: s.transform[2] }))
}

/**
 * Scale that holds a piece of chrome at a constant on-screen size, up to `cap`.
 *
 * The cap stops chrome growing out of the world space around it, and past it the
 * chrome shrinks with the canvas like anything else — the honest outcome, since
 * at that zoom there is genuinely no room. It is required rather than defaulted:
 * every caller has a different amount of room, and inheriting someone else's
 * ceiling is how the enclosure title ended up capped at the wire dot's.
 */
export function useCounterScale(cap: number): number {
  const zoom = useQuantisedZoom()
  return Math.min(cap, 1 / Math.max(zoom, 0.01))
}

export interface ScreenSize {
  /** Interior width the content is laid out in. */
  w: number
  h: number
  /** Interior size over world size — where a world offset lands inside. */
  k: number
  /** Fidelity the on-screen size supports. */
  tier: Tier
}

/**
 * A fixed world-space box whose contents are authored at the smaller of their
 * world size and their on-screen size.
 *
 * The box is `w` x `h` world units at every zoom, so the layout around it never
 * moves. Inside:
 *
 * - Zoomed in (past 1:1) the interior is its natural world size and simply rides
 *   the canvas transform, so moving closer makes the card bigger, as it should.
 * - Zoomed out, the interior is laid out at the box's *on-screen* size and
 *   scaled back up to fill it, so a 12px font stays 12px on screen. The room the
 *   content has shrinks instead of the type, and that shrinking room is what
 *   drops the tier.
 *
 * Nothing measures the mounted result, so there is no feedback loop; and the
 * scale comes from the rounded interior size rather than from `1/zoom`, so the
 * interior fills the box exactly and reserve cannot disagree with render by a
 * rounding error.
 */
export function ScreenBox({
  w,
  h,
  className,
  style,
  children,
  ...rest
}: {
  w: number
  h: number
  className?: string
  style?: CSSProperties
  children: (size: ScreenSize) => ReactNode
  /** Marks the box as chrome, exempting it from the reserve/render audit. */
  'data-chrome'?: boolean
}) {
  const zoom = useQuantisedZoom()
  const iw = Math.max(1, Math.round(w * Math.min(1, zoom)))
  const scale = w / iw
  const ih = h / scale
  const tier = tierForWidth(w * zoom)

  return (
    <div style={{ width: w, height: h, ...style }} className={className} {...rest}>
      <div
        style={{
          width: iw,
          height: ih,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children({ w: iw, h: ih, k: iw / w, tier })}
      </div>
    </div>
  )
}

/**
 * Chrome pinned to a world point but drawn at constant size, without being
 * parented to a scaled node. Used for the pieces that must not shrink: the
 * enclosure title, the step toolbar, the add affordances.
 */
export function ScreenPin({
  at,
  anchor = 'top-left',
  offset = { x: 0, y: 0 },
  transform,
  className,
  children,
  ...handlers
}: {
  /** World point the chrome hangs from. */
  at: { x: number; y: number }
  anchor?: 'top-left' | 'bottom-left' | 'bottom-center' | 'top-right' | 'center'
  /** Nudge in screen pixels, applied after projection. */
  offset?: { x: number; y: number }
  /** Supply the transform when several pins share one; omit to read the store. */
  transform?: Transform
  className?: string
  children: ReactNode
  onPointerEnter?: () => void
  onPointerLeave?: () => void
}) {
  const live = useTransform()
  const p = projectToScreen(at, transform ?? live)
  const translate: Record<string, string> = {
    'top-left': '0, 0',
    'bottom-left': '0, -100%',
    'bottom-center': '-50%, -100%',
    'top-right': '-100%, 0',
    center: '-50%, -50%',
  }
  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: p.x + offset.x,
        top: p.y + offset.y,
        transform: `translate(${translate[anchor]})`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      {...handlers}
    >
      {children}
    </div>
  )
}
