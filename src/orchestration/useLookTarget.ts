import { useOrchestration } from '../store/useOrchestration'
import type { SpotlightId } from './spotlight'

export type { SpotlightId }

/** Copilot’s current look-here target, or null once the pulse expires. */
export function useLookTarget(): SpotlightId | null {
  return useOrchestration((s) => s.spotlight)
}
