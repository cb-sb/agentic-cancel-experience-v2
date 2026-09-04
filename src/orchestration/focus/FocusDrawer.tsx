import { useEffect, useRef } from 'react'
import { useOrchestration } from '../../store/useOrchestration'
import { FocusCard } from './FocusCard'
import { FocusChrome } from './FocusChrome'
import {
  DRAWER_IN_MS,
  DRAWER_OUT_MS,
  DRAWER_PAD,
  DRAWER_SLIDE,
  EASE_ENTER,
  EASE_LEAVE,
} from './tokens'
import { useFocusGeometry } from './useFocusGeometry'
import type { FocusSession } from './useFocusSession'

/**
 * Focus as a drawer: the card slides in from the right, the play stays behind
 * it rather than being replaced by it.
 *
 * The bet is that seeing where this card sits is worth the room the drawer
 * gives up. It floats over the canvas rather than taking a column, so opening
 * it does not reflow the play — the graph is exactly where it was, which is what
 * lets it read as context instead of as a thing that just moved. `FocusAutoPan`
 * slides the step being edited into whatever strip is left, so the drawer does
 * not cover its own subject.
 *
 * The play behind is context, not a second place to work: it sits under a scrim,
 * and a click anywhere on it closes the drawer. That costs the one thing the
 * live canvas bought — double-clicking a different step to bring it in — which
 * the arrows in the toolbar now have to carry alone.
 */
export function FocusDrawer({ session, open }: { session: FocusSession; open: boolean }) {
  const { drawerW, rightInset, scrimW, mode } = useFocusGeometry()
  const full = mode === 'full'

  useCollapsedAssistant(open)

  const ms = open ? DRAWER_IN_MS : DRAWER_OUT_MS
  const ease = open ? EASE_ENTER : EASE_LEAVE

  return (
    <>
      {/* Dimmed rather than blurred: the shape of the play is the whole reason
          it is still on screen. Not rendered at all once the drawer has taken
          the room, since there would be nothing behind it to dim. */}
      {scrimW > 0 && (
        <div
          data-focus-scrim
          aria-hidden
          onClick={session.exit}
          className="absolute inset-y-0 left-0 z-30 bg-slate-900/20 motion-reduce:transition-none"
          style={{
            right: rightInset + drawerW,
            opacity: open ? 1 : 0,
            transition: `opacity ${ms}ms ${ease}`,
          }}
        />
      )}

      <div
        data-focus-drawer
        className="absolute inset-y-0 z-40 flex flex-col border-l border-slate-200 bg-white shadow-[-8px_0_28px_rgba(15,23,42,0.08)] motion-reduce:transition-none"
        style={{
          width: drawerW,
          right: rightInset,
          opacity: open ? 1 : 0,
          transform: `translateX(${open ? 0 : DRAWER_SLIDE}px)`,
          transition: `opacity ${ms}ms ${ease}, transform ${ms}ms ${ease}`,
          // The card inside is text being edited at 1:1; promoting the layer
          // keeps the type off the subpixel grid only while it is moving.
          willChange: 'transform',
        }}
      >
        <FocusChrome session={session} dense={!full} />
        <div className="min-h-0 flex-1 bg-slate-100/60">
          <FocusCard session={session} padX={full ? 80 : DRAWER_PAD} />
        </div>
      </div>
    </>
  )
}

/**
 * Fold the assistant away while the drawer is open, and put it back after.
 *
 * The drawer's width comes out of the viewport, not out of the canvas column,
 * so the only question is what the strip beside it shows. A 360px chat pane
 * would fill most of that strip with a conversation the merchant is not having
 * right now, in place of the play they are editing. Collapsing to the 46px
 * strip is reversible and already a first-class state.
 *
 * Keyed to `open` rather than to mounting so that it unfolds as the drawer
 * leaves, not after: the two motions overlap instead of queueing.
 */
function useCollapsedAssistant(open: boolean) {
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (!open) return
    wasOpen.current = useOrchestration.getState().assistantOpen
    if (wasOpen.current) setAssistantOpen(false)
    return () => {
      if (wasOpen.current) setAssistantOpen(true)
    }
  }, [open, setAssistantOpen])
}
