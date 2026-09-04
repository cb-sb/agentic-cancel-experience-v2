import { useRef } from 'react'
import { usePresence } from '../../lib/usePresence'
import { useOrchestration } from '../../store/useOrchestration'
import { FocusDrawer } from './FocusDrawer'
import { FocusOverlay } from './FocusOverlay'
import { DRAWER_OUT_MS } from './tokens'
import { useFocusSession, type FocusSession } from './useFocusSession'

/**
 * Focus mode, in whichever presentation is currently being trialled.
 *
 * Both are fully built and switchable at runtime, including mid-edit, because
 * the only honest way to choose between them is to do the same piece of work
 * twice. They share the session, the card and the toolbar; what differs is how
 * much of the play stays reachable while you edit.
 */
export function FocusPresentation() {
  const presentation = useOrchestration((s) => s.focusPresentation)
  const session = useFocusSession()

  // The session vanishes the moment focus is dropped, but the card still has to
  // be on screen to leave. Holding the last one is what buys the exit its frames.
  const last = useRef<FocusSession | null>(null)
  if (session) last.current = session
  const shown = session ?? last.current

  const { alive, open } = usePresence(Boolean(session), DRAWER_OUT_MS)
  if (!alive || !shown) return null

  return presentation === 'drawer' ? (
    <FocusDrawer session={shown} open={open} />
  ) : (
    <FocusOverlay session={shown} open={open} />
  )
}