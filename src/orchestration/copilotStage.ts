import type { JourneyFile } from '../journey/types'
import { useJourney } from '../store/useJourney'
import { useOrchestration } from '../store/useOrchestration'
import { useEmptyJourneyDemo } from './emptyDemoFlag'

export type CopilotStage = 'doors' | 'center' | 'rail'

export type SetupDoor = 'upload' | 'library' | 'yours' | 'guide' | 'acquire'
export type LibraryTab = 'ours' | 'yours'

function isBlankJourney(file: JourneyFile): boolean {
  return file.template === 'none' && file.steps.length === 0
}

/** Authoring context is enough to snap Copilot back to the rail. Play setup is tracked after. */
export function experienceContextReady(file: JourneyFile, stepStripShown: boolean): boolean {
  if (file.steps.length === 0) return false
  if (file.template === 'none' && file.source !== 'uploaded') return false
  if (file.source === 'uploaded' && !file.manifest?.confirmed) return false
  return stepStripShown
}

export function deriveCopilotStage(args: {
  file: JourneyFile
  setupDoor: SetupDoor | null
  stepStripShown: boolean
  emptyDemo: boolean
}): CopilotStage {
  if (args.emptyDemo) return 'rail'
  const blank = isBlankJourney(args.file)
  if (!args.setupDoor) return blank ? 'doors' : 'rail'
  if (experienceContextReady(args.file, args.stepStripShown)) return 'rail'
  return 'center'
}

export function useCopilotStage(): CopilotStage {
  const file = useJourney((s) => s.file)
  const setupDoor = useOrchestration((s) => s.setupDoor)
  const stepStripShown = useOrchestration((s) => s.stepStripShown)
  const emptyDemo = useEmptyJourneyDemo()
  return deriveCopilotStage({ file, setupDoor, stepStripShown, emptyDemo })
}
