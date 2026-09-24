import type { Experience } from '../types/experience'
import type { Play } from '../types/orchestration'
import type { JourneyFile } from '../journey/types'
import type { ConfirmedSetup } from '../orchestration/setupTracker'
import { EMPTY_JOURNEY } from '../journey/types'
import { restoreJourney, useJourney } from './useJourney'
import { useExperience } from './useExperience'
import { useOrchestration } from './useOrchestration'
import { useHistory, type HistoryEntry } from './useHistory'

const KEY = 'cancel-experience:draft:v2'

/** Setup progress flags that live on the orchestration store. */
export interface SetupFlags {
  confirmedSetup: ConfirmedSetup
  installConnected: boolean
  walkedOrSkipped: boolean
  dismissedStepNeedsWork: boolean
}

/** The state a draft or a history snapshot puts back onto the stores. */
export interface DraftPayload {
  journey: JourneyFile
  play: Play
  experiences: Record<string, Experience>
  activeExperienceId: string
  setup?: SetupFlags
}

interface Draft extends DraftPayload {
  v: 2
  savedAt: number
  setup: SetupFlags
  history: HistoryEntry[]
}

function readFlags(): SetupFlags {
  const s = useOrchestration.getState()
  return {
    confirmedSetup: s.confirmedSetup,
    installConnected: s.installConnected,
    walkedOrSkipped: s.walkedOrSkipped,
    dismissedStepNeedsWork: s.dismissedStepNeedsWork,
  }
}

/**
 * Put a saved payload back onto every store together — journey, play, the
 * authored experiences, and the setup flags. Shared by loadDraft and by the
 * Activity Monitor's restore.
 */
export function applyDraftPayload(p: DraftPayload): void {
  // Recompiles the journey and fans out derived play/experience patches first.
  restoreJourney(p.journey)

  const orchPatch: Record<string, unknown> = {
    play: { ...useOrchestration.getState().play, ...p.play },
  }
  if (p.setup) Object.assign(orchPatch, p.setup)
  useOrchestration.setState(orchPatch)

  // Overlay the exact authored experiences (keeps compose-only edits faithful).
  const exp = useExperience.getState()
  const active = p.activeExperienceId in p.experiences ? p.activeExperienceId : exp.activeExperienceId
  useExperience.setState({
    experiences: p.experiences,
    activeExperienceId: active,
    experience: p.experiences[active] ?? exp.experience,
  })
}

export function saveDraft(): void {
  const orch = useOrchestration.getState()
  const exp = useExperience.getState()
  const savedAt = Date.now()
  const draft: Draft = {
    v: 2,
    savedAt,
    play: orch.play,
    experiences: exp.experiences,
    activeExperienceId: exp.activeExperienceId,
    journey: useJourney.getState().file,
    setup: readFlags(),
    history: useHistory.getState().entries,
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    return
  }
  useOrchestration.setState({ savedAt, dirty: false })
}

export function loadDraft(): void {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    restoreJourney(EMPTY_JOURNEY)
    return
  }
  if (!raw) {
    restoreJourney(EMPTY_JOURNEY)
    return
  }

  try {
    const draft = JSON.parse(raw) as Draft
    if (draft.v !== 2 || !draft.journey) {
      restoreJourney(EMPTY_JOURNEY)
      return
    }
    applyDraftPayload({
      journey: draft.journey,
      play: draft.play,
      experiences: draft.experiences,
      activeExperienceId: draft.activeExperienceId,
      setup: draft.setup,
    })
    useOrchestration.setState({ savedAt: draft.savedAt, dirty: false })
    if (Array.isArray(draft.history)) useHistory.getState().hydrate(draft.history)
  } catch {
    restoreJourney(EMPTY_JOURNEY)
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
  useHistory.getState().clear()
}

export function watchForChanges() {
  const mark = () => {
    if (!useOrchestration.getState().dirty) useOrchestration.setState({ dirty: true })
  }

  let lastPlay = useOrchestration.getState().play
  useOrchestration.subscribe((s) => {
    if (s.play !== lastPlay) {
      lastPlay = s.play
      mark()
    }
  })

  let lastExperiences = useExperience.getState().experiences
  useExperience.subscribe((s) => {
    if (s.experiences !== lastExperiences) {
      lastExperiences = s.experiences
      mark()
    }
  })

  let lastJourney = useJourney.getState().file
  useJourney.subscribe((s) => {
    if (s.file !== lastJourney) {
      lastJourney = s.file
      mark()
    }
  })
}
