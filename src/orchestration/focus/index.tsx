import { useEffect, useRef } from 'react'
import { usePresence } from '../../lib/usePresence'
import { useExperience } from '../../store/useExperience'
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
  const previewing = useExperience((s) => s.mode === 'play')
  const assistantOpen = useOrchestration((s) => s.assistantOpen)
  const setAssistantOpen = useOrchestration((s) => s.setAssistantOpen)
  const session = useFocusSession()

  // The session vanishes the moment focus is dropped, but the card still has to
  // be on screen to leave. Holding the last one is what buys the exit its frames.
  const last = useRef<FocusSession | null>(null)
  if (session) last.current = session
  const shown = session ?? last.current

  const { alive, open } = usePresence(Boolean(session), DRAWER_OUT_MS)

  useEffect(() => {
    if (previewing || !open || assistantOpen) return
    setAssistantOpen(true)
  }, [open, previewing, assistantOpen, setAssistantOpen])

  if (!alive || !shown) return null

  return (
    <div
      className={previewing ? 'pointer-events-none' : undefined}
      aria-hidden={previewing || undefined}
    >
      {presentation === 'drawer' ? (
        <FocusDrawer session={shown} open={open} />
      ) : (
        <FocusOverlay session={shown} open={open} />
      )}
    </div>
  )
}