import type { Experience } from '../types/experience'
import type { Play } from '../types/orchestration'
import type { JourneyFile } from '../journey/types'
import { EMPTY_JOURNEY } from '../journey/types'
import { restoreJourney, useJourney } from './useJourney'
import { useExperience } from './useExperience'
import { useOrchestration } from './useOrchestration'

const KEY = 'cancel-experience:draft:v2'

interface Draft {
  v: 2
  savedAt: number
  play: Play
  experiences: Record<string, Experience>
  activeExperienceId: string
  journey: JourneyFile
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
    restoreJourney(draft.journey)
    useOrchestration.setState({
      play: { ...useOrchestration.getState().play, ...draft.play },
      savedAt: draft.savedAt,
      dirty: false,
    })
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
